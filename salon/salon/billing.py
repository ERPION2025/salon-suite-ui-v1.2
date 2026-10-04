"""Sales invoicing + payments for Salon Suite.

Every sale pushed from the suite (a completed booking, a package sold from
Client 360) becomes a SUBMITTED Sales Invoice straight away - revenue is on
the books immediately and nothing waits as a draft in the POS register.
Payment is recorded separately (invoice popup > Record Payment), which
creates and submits a Payment Entry against the invoice.
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate, today

from salon.salon.permissions import (
	check_cost_center_access,
	get_pos_profile_for_cost_center,
	require_salon_role,
)


def make_sales_invoice(customer, cost_center, items, before_submit=None):
	"""Create and SUBMIT a Sales Invoice for a branch.

	Company, warehouse and price list come from the branch's POS Profile.
	`before_submit(si)` runs after insert and before submit - use it to
	link the invoice back to its source record so on_submit hooks
	(commission, subscription activation) can find it.

	Returns the Sales Invoice name.
	"""
	pos_profile_name = get_pos_profile_for_cost_center(cost_center)
	if not pos_profile_name:
		frappe.throw(
			_(
				"No POS Profile is set up for {0}. Create one under Salon Suite > POS Profiles "
				"before billing this branch."
			).format(cost_center)
		)
	pos_profile = frappe.get_cached_doc("POS Profile", pos_profile_name)

	si = frappe.new_doc("Sales Invoice")
	si.customer = customer
	si.company = pos_profile.company
	si.currency = frappe.get_cached_value("Company", pos_profile.company, "default_currency")
	si.posting_date = nowdate()
	si.due_date = nowdate()
	si.cost_center = cost_center
	si.pos_profile = pos_profile_name
	if pos_profile.selling_price_list:
		si.selling_price_list = pos_profile.selling_price_list
	si.set_warehouse = pos_profile.warehouse
	for row in items:
		si.append(
			"items",
			{
				"item_code": row["item_code"],
				"qty": row.get("qty") or 1,
				"rate": row.get("rate") or 0,
				"cost_center": cost_center,
				"warehouse": pos_profile.warehouse,
			},
		)
	# Products sold over the counter (stock items) leave the branch's store
	# room with the invoice, the same way the POS register handles them.
	if any(frappe.get_cached_value("Item", row["item_code"], "is_stock_item") for row in items):
		si.update_stock = 1
	si.flags.ignore_permissions = True
	si.insert()
	if before_submit:
		before_submit(si)
	si.submit()
	return si.name


# ---------------------------------------------------------------------------
# Invoice popup API
# ---------------------------------------------------------------------------
def _modes_for_company(company):
	return frappe.db.sql(
		"""select mop.name, acc.account_type
		from `tabMode of Payment` mop
		join `tabMode of Payment Account` mpa on mpa.parent = mop.name
		join `tabAccount` acc on acc.name = mpa.default_account
		where mpa.company = %s and mop.enabled = 1
		order by mop.name""",
		company,
		as_dict=True,
	)


@frappe.whitelist()
def get_invoice_details(name):
	require_salon_role()
	si = frappe.get_doc("Sales Invoice", name)
	check_cost_center_access(si.cost_center)

	payments = []
	# Payments taken in the POS register itself.
	for p in si.get("payments") or []:
		if flt(p.amount):
			payments.append(
				{"date": si.posting_date, "mode_of_payment": p.mode_of_payment, "amount": p.amount, "reference": None}
			)
	# Payments recorded later (Payment Entry).
	payments += frappe.db.sql(
		"""select pe.posting_date as date, pe.mode_of_payment, ref.allocated_amount as amount,
			pe.name as reference
		from `tabPayment Entry Reference` ref
		join `tabPayment Entry` pe on pe.name = ref.parent
		where ref.reference_doctype = 'Sales Invoice' and ref.reference_name = %s and pe.docstatus = 1
		order by pe.posting_date""",
		name,
		as_dict=True,
	)

	booking = frappe.db.get_value("Salon Booking", {"sales_invoice": name}, "name")
	subscription = frappe.db.get_value("Package Subscription", {"sales_invoice": name}, "name")

	return {
		"name": si.name,
		"docstatus": si.docstatus,
		"status": si.status,
		"customer": si.customer,
		"customer_name": si.customer_name,
		"posting_date": si.posting_date,
		"cost_center": si.cost_center,
		"company": si.company,
		"currency": si.currency,
		"is_pos": si.is_pos,
		"items": [
			{"item_code": i.item_code, "item_name": i.item_name, "qty": i.qty, "rate": i.rate, "amount": i.amount}
			for i in si.items
		],
		"net_total": si.net_total,
		"total_taxes_and_charges": si.total_taxes_and_charges,
		"discount_amount": si.discount_amount,
		"grand_total": si.rounded_total or si.grand_total,
		"outstanding_amount": si.outstanding_amount,
		"payments": payments,
		"booking": booking,
		"subscription": subscription,
		"modes_of_payment": _modes_for_company(si.company),
	}


@frappe.whitelist()
def submit_invoice(name):
	"""Submit a legacy DRAFT invoice (earlier builds left booking/package
	invoices as POS drafts). Converted to a normal invoice so it can be
	submitted unpaid and settled with Record Payment."""
	require_salon_role()
	si = frappe.get_doc("Sales Invoice", name)
	check_cost_center_access(si.cost_center)
	if si.docstatus != 0:
		frappe.throw(_("{0} is already submitted").format(name))
	if si.is_pos and not any(flt(p.amount) for p in si.get("payments") or []):
		si.is_pos = 0
		si.set("payments", [])
	si.flags.ignore_permissions = True
	si.save()
	si.submit()
	return si.name


@frappe.whitelist()
def record_payment(invoice, mode_of_payment, amount, posting_date=None, reference_no=None, reference_date=None):
	"""Create + submit a Payment Entry against a submitted Sales Invoice."""
	require_salon_role()
	si = frappe.get_doc("Sales Invoice", invoice)
	check_cost_center_access(si.cost_center)
	if si.docstatus != 1:
		frappe.throw(_("Submit {0} before recording a payment").format(invoice))

	amount = flt(amount)
	outstanding = flt(si.outstanding_amount)
	if amount <= 0:
		frappe.throw(_("Enter the amount received"))
	if amount > outstanding + 0.005:
		frappe.throw(_("Amount is more than what is owed ({0})").format(outstanding))

	account, account_type = None, None
	for m in _modes_for_company(si.company):
		if m.name == mode_of_payment:
			account_type = m.account_type
			account = frappe.db.get_value(
				"Mode of Payment Account", {"parent": mode_of_payment, "company": si.company}, "default_account"
			)
	if not account:
		frappe.throw(_("Mode of Payment {0} has no account for {1}").format(mode_of_payment, si.company))
	if account_type == "Bank" and not reference_no:
		frappe.throw(_("Enter the card / transfer reference number"))

	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	pe = get_payment_entry("Sales Invoice", si.name, party_amount=amount, bank_account=account)
	pe.mode_of_payment = mode_of_payment
	pe.posting_date = getdate(posting_date) if posting_date else getdate(today())
	pe.paid_to = account
	pe.paid_amount = amount
	pe.received_amount = amount
	for ref in pe.references:
		if ref.reference_doctype == "Sales Invoice" and ref.reference_name == si.name:
			ref.allocated_amount = amount
	pe.reference_no = reference_no or si.name
	pe.reference_date = getdate(reference_date) if reference_date else pe.posting_date
	pe.cost_center = si.cost_center
	pe.flags.ignore_permissions = True
	pe.insert()
	pe.submit()
	return {"payment_entry": pe.name, "outstanding": frappe.db.get_value("Sales Invoice", si.name, "outstanding_amount")}
