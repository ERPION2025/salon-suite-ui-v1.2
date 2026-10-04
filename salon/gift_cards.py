"""Salon Suite > Gift Cards.

Accounting (no parallel ledger):
  Sell    -> submitted Sales Invoice for item GIFT-CARD whose line books to
             the "Gift Card Liability" account (money received is owed as
             future services, not revenue yet). Paid like any invoice.
  Redeem  -> when a client pays an invoice with a gift card (invoice popup >
             Record Payment > Gift Card), a submitted Journal Entry debits
             Gift Card Liability and credits the client's receivable against
             that invoice - the revenue was already on the service invoice.
  Expire  -> daily job marks cards past their expiry date as Expired (the
             remaining balance stays on the liability account for the
             accountant to release).
"""

import json

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, today

from salon.salon.permissions import (
	check_cost_center_access,
	get_user_scope,
	require_salon_role,
)

GIFT_ITEM = "GIFT-CARD"
GIFT_GROUP = "Gift Cards"
LIABILITY_NAME = "Gift Card Liability"


# ---------------------------------------------------------------------------
# One-time setup (after_migrate + lazily)
# ---------------------------------------------------------------------------
def get_liability_account(company, create=True):
	abbr = frappe.get_cached_value("Company", company, "abbr")
	name = f"{LIABILITY_NAME} - {abbr}"
	if frappe.db.exists("Account", name) or not create:
		return name if frappe.db.exists("Account", name) else None
	parent = frappe.db.get_value(
		"Account",
		{"company": company, "is_group": 1, "root_type": "Liability", "account_name": "Current Liabilities"},
		"name",
	) or frappe.db.get_value(
		"Account", {"company": company, "is_group": 1, "root_type": "Liability"}, "name", order_by="lft desc"
	)
	if not parent:
		frappe.throw(_("No Liability group account found for {0}").format(company))
	acc = frappe.get_doc(
		{
			"doctype": "Account",
			"account_name": LIABILITY_NAME,
			"parent_account": parent,
			"company": company,
			"root_type": "Liability",
			"report_type": "Balance Sheet",
			"is_group": 0,
		}
	)
	acc.flags.ignore_permissions = True
	acc.insert()
	return acc.name


def ensure_gift_card_setup(company=None):
	if not frappe.db.exists("DocType", "Item"):
		return
	if not frappe.db.exists("Item Group", GIFT_GROUP):
		frappe.get_doc(
			{"doctype": "Item Group", "item_group_name": GIFT_GROUP, "parent_item_group": "All Item Groups", "is_group": 0}
		).insert(ignore_permissions=True)
	if not frappe.db.exists("Item", GIFT_ITEM):
		uom = "Nos" if frappe.db.exists("UOM", "Nos") else frappe.db.get_value("UOM", {}, "name")
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": GIFT_ITEM,
				"item_name": "Gift Card",
				"item_group": GIFT_GROUP,
				"stock_uom": uom,
				"is_stock_item": 0,
				"is_sales_item": 1,
				"is_purchase_item": 0,
				"include_item_in_manufacturing": 0,
			}
		).insert(ignore_permissions=True)
	for c in [company] if company else frappe.get_all("Company", pluck="name"):
		get_liability_account(c)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def _card_filters():
	scope = get_user_scope()
	return {} if scope["is_admin"] else {"cost_center": scope["cost_center"]}


@frappe.whitelist()
def get_gift_cards():
	require_salon_role()
	filters = _card_filters()
	cards = frappe.get_all(
		"Salon Gift Card",
		filters=filters,
		fields=[
			"name", "code", "status", "value", "balance", "issue_date", "expiry_date", "customer",
			"recipient_name", "cost_center", "sales_invoice",
		],
		order_by="creation desc",
		limit_page_length=300,
	)
	for c in cards:
		c["customer_name"] = frappe.db.get_value("Customer", c.customer, "customer_name") if c.customer else None
	month_start = getdate(today()).replace(day=1)
	sold_month = sum(flt(c.value) for c in cards if c.issue_date and getdate(c.issue_date) >= month_start)
	redeemed_month = flt(
		frappe.db.sql(
			"""select coalesce(sum(r.amount), 0) from `tabSalon Gift Card Redemption` r
			join `tabSalon Gift Card` g on g.name = r.parent
			where r.posting_date >= %(start)s {cond}""".format(
				cond="and g.cost_center = %(cc)s" if filters.get("cost_center") else ""
			),
			{"start": month_start, "cc": filters.get("cost_center")},
		)[0][0]
	)
	return {
		"cards": cards,
		"active": len([c for c in cards if c.status == "Active"]),
		"outstanding": sum(flt(c.balance) for c in cards if c.status == "Active"),
		"sold_month": sold_month,
		"redeemed_month": redeemed_month,
	}


@frappe.whitelist()
def get_gift_card(code):
	require_salon_role()
	code = (code or "").strip().upper()
	if not frappe.db.exists("Salon Gift Card", code):
		frappe.throw(_("No gift card {0}").format(code))
	card = frappe.get_doc("Salon Gift Card", code)
	out = card.as_dict()
	out["customer_name"] = frappe.db.get_value("Customer", card.customer, "customer_name") if card.customer else None
	out["usable"] = card.status == "Active" and (not card.expiry_date or getdate(card.expiry_date) >= getdate(today()))
	return out


@frappe.whitelist()
def sell_gift_card(data):
	"""Issue a card and bill it (submitted invoice to the liability account).
	The invoice is then paid from the invoice popup like any other."""
	require_salon_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)

	scope = get_user_scope()
	branch = data.get("cost_center") if scope["is_admin"] else scope["cost_center"]
	if not branch:
		frappe.throw(_("Pick the branch selling the card"))
	check_cost_center_access(branch)
	if not data.get("customer"):
		frappe.throw(_("Pick the client buying the card"))
	value = flt(data.get("value"))
	if value <= 0:
		frappe.throw(_("Enter the card value"))

	company = frappe.db.get_value("Cost Center", branch, "company")
	ensure_gift_card_setup(company)
	liability = get_liability_account(company)

	validity = cint(data.get("validity_days") or 365)
	card = frappe.get_doc(
		{
			"doctype": "Salon Gift Card",
			"value": value,
			"balance": value,
			"status": "Active",
			"issue_date": today(),
			"expiry_date": add_days(today(), validity) if validity > 0 else None,
			"customer": data.customer,
			"recipient_name": data.get("recipient_name"),
			"recipient_email": data.get("recipient_email"),
			"recipient_mobile": data.get("recipient_mobile"),
			"message": data.get("message"),
			"cost_center": branch,
			"company": company,
		}
	)
	card.flags.ignore_permissions = True
	card.insert()

	from salon.salon.billing import make_sales_invoice

	si = make_sales_invoice(
		data.customer,
		branch,
		[{"item_code": GIFT_ITEM, "qty": 1, "rate": value, "income_account": liability}],
		before_submit=lambda inv: card.db_set("sales_invoice", inv.name),
	)
	return {"code": card.code, "sales_invoice": si}


@frappe.whitelist()
def redeem_gift_card(invoice, code, amount, posting_date=None):
	"""Pay (part of) a submitted Sales Invoice with a gift card."""
	require_salon_role()
	si = frappe.get_doc("Sales Invoice", invoice)
	check_cost_center_access(si.cost_center)
	if si.docstatus != 1:
		frappe.throw(_("Submit {0} before taking a payment").format(invoice))

	code = (code or "").strip().upper()
	if not frappe.db.exists("Salon Gift Card", code):
		frappe.throw(_("No gift card {0}").format(code))
	card = frappe.get_doc("Salon Gift Card", code)
	if card.status != "Active":
		frappe.throw(_("Gift card {0} is {1}").format(code, card.status))
	if card.expiry_date and getdate(card.expiry_date) < getdate(today()):
		frappe.throw(_("Gift card {0} expired on {1}").format(code, frappe.format(card.expiry_date, {"fieldtype": "Date"})))
	if card.company and card.company != si.company:
		frappe.throw(_("This gift card belongs to {0}").format(card.company))
	if card.sales_invoice == si.name:
		frappe.throw(_("A gift card can't pay for its own purchase"))

	amount = flt(amount)
	if amount <= 0:
		frappe.throw(_("Enter the amount to take from the card"))
	if amount > flt(card.balance) + 0.005:
		frappe.throw(_("The card only has {0} left").format(frappe.format(card.balance, {"fieldtype": "Currency"})))
	if amount > flt(si.outstanding_amount) + 0.005:
		frappe.throw(_("Amount is more than what is owed ({0})").format(si.outstanding_amount))

	liability = get_liability_account(si.company)
	je = frappe.get_doc(
		{
			"doctype": "Journal Entry",
			"voucher_type": "Journal Entry",
			"company": si.company,
			"posting_date": getdate(posting_date) if posting_date else getdate(today()),
			"user_remark": _("Gift card {0} redeemed against {1}").format(code, si.name),
			"accounts": [
				{"account": liability, "debit_in_account_currency": amount, "cost_center": si.cost_center},
				{
					"account": si.debit_to,
					"party_type": "Customer",
					"party": si.customer,
					"credit_in_account_currency": amount,
					"reference_type": "Sales Invoice",
					"reference_name": si.name,
					"cost_center": si.cost_center,
				},
			],
		}
	)
	je.flags.ignore_permissions = True
	je.insert()
	je.submit()

	card.balance = flt(card.balance) - amount
	card.append(
		"redemptions",
		{"posting_date": je.posting_date, "sales_invoice": si.name, "journal_entry": je.name, "amount": amount},
	)
	if card.balance <= 0.005:
		card.balance = 0
		card.status = "Fully Redeemed"
	card.flags.ignore_permissions = True
	card.save()
	return {"journal_entry": je.name, "balance": card.balance}


def expire_gift_cards():
	"""Scheduler (daily)."""
	for name in frappe.get_all(
		"Salon Gift Card", filters={"status": "Active", "expiry_date": ["<", today()]}, pluck="name"
	):
		frappe.db.set_value("Salon Gift Card", name, "status", "Expired")
	frappe.db.commit()
