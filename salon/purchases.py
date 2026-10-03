"""Salon Suite > Purchases.

One simple screen over native ERPNext Purchase Invoices. Every purchase is
a submitted Purchase Invoice against the branch's Cost Center, so it lands
in GL - and therefore in P&L by Branch - with no parallel ledger:

  Consumables       stock items, update_stock=1 -> Stock In Hand. Expensed
                    later, WHEN CONSUMED (the booking's Material Issue
                    Stock Entry posts to the expense account by branch).
  Retail Products   stock items, update_stock=1 -> Stock In Hand. Expensed
                    as Cost of Goods Sold when sold through POS.
  Overheads & Bills non-stock -> the chosen Expense account, immediately.
  Equipment         non-stock -> the chosen Expense account, immediately.
  Assets            non-stock -> the chosen Fixed Asset account (balance
                    sheet, not P&L). Depreciation is not automated here.

Paid now  -> is_paid=1, cash/bank account from the Mode of Payment.
On credit -> normal payable; "Mark paid" creates a Payment Entry later.
"""

import json

import frappe
from frappe import _
from frappe.utils import flt, getdate, today

from salon.salon.permissions import (
	check_cost_center_access,
	get_pos_profile_for_cost_center,
	get_user_scope,
	require_salon_role,
	resolve_cost_center_filter,
)

STOCK_CATEGORIES = ("Consumables", "Retail Products")
EXPENSE_CATEGORIES = ("Overheads & Bills", "Equipment")
ASSET_CATEGORIES = ("Assets",)
CATEGORIES = STOCK_CATEGORIES + EXPENSE_CATEGORIES + ASSET_CATEGORIES

ITEM_GROUP = "Salon Purchases"
EXPENSE_ITEM = "SALON-EXPENSE"
ASSET_ITEM = "SALON-ASSET-PURCHASE"

# Expense accounts that are system-managed and make no sense as a bill line.
EXCLUDED_EXPENSE_ACCOUNT_TYPES = (
	"Cost of Goods Sold",
	"Stock Adjustment",
	"Depreciation",
	"Round Off",
	"Expenses Included In Valuation",
	"Expenses Included In Asset Valuation",
	"Stock Received But Not Billed",
)


def ensure_purchase_items():
	"""Generic non-stock Items the bill lines for overheads / equipment /
	assets hang off (the real classification is the account on the line).
	Idempotent; also called from after_migrate."""
	if not frappe.db.exists("DocType", "Item"):
		return
	if not frappe.db.exists("Item Group", ITEM_GROUP):
		parent = "All Item Groups" if frappe.db.exists("Item Group", "All Item Groups") else None
		frappe.get_doc(
			{"doctype": "Item Group", "item_group_name": ITEM_GROUP, "parent_item_group": parent, "is_group": 0}
		).insert(ignore_permissions=True)
	uom = "Nos" if frappe.db.exists("UOM", "Nos") else frappe.db.get_value("UOM", {}, "name")
	for code, name in ((EXPENSE_ITEM, "Salon Expense / Bill"), (ASSET_ITEM, "Salon Asset Purchase")):
		if frappe.db.exists("Item", code):
			continue
		frappe.get_doc(
			{
				"doctype": "Item",
				"item_code": code,
				"item_name": name,
				"item_group": ITEM_GROUP,
				"stock_uom": uom,
				"is_stock_item": 0,
				"is_purchase_item": 1,
				"is_sales_item": 0,
				"include_item_in_manufacturing": 0,
			}
		).insert(ignore_permissions=True)


@frappe.whitelist()
def get_purchase_setup():
	"""Everything the New Purchase dialog needs in one call."""
	require_salon_role()
	scope = get_user_scope()

	branch_filters = {"is_group": 0, "disabled": 0}
	if not scope["is_admin"]:
		branch_filters["name"] = scope["cost_center"]
	branches = frappe.get_all(
		"Cost Center", filters=branch_filters, fields=["name", "cost_center_name", "company"], order_by="name"
	)
	companies = sorted({b.company for b in branches})
	for b in branches:
		profile = get_pos_profile_for_cost_center(b.name)
		b["warehouse"] = frappe.db.get_value("POS Profile", profile, "warehouse") if profile else None

	by_company = {}
	for company in companies:
		expense_accounts = frappe.get_all(
			"Account",
			filters={
				"company": company,
				"root_type": "Expense",
				"is_group": 0,
				"disabled": 0,
				"account_type": ["not in", EXCLUDED_EXPENSE_ACCOUNT_TYPES],
			},
			fields=["name", "account_name"],
			order_by="account_name",
		)
		asset_accounts = frappe.get_all(
			"Account",
			filters={"company": company, "account_type": "Fixed Asset", "is_group": 0, "disabled": 0},
			fields=["name", "account_name"],
			order_by="account_name",
		)
		warehouses = frappe.get_all(
			"Warehouse",
			filters={"company": company, "is_group": 0, "disabled": 0},
			fields=["name", "warehouse_name"],
			order_by="warehouse_name",
		)
		modes = frappe.db.sql(
			"""select mop.name from `tabMode of Payment` mop
			join `tabMode of Payment Account` mpa on mpa.parent = mop.name
			where mpa.company = %s and ifnull(mpa.default_account, '') != '' and mop.enabled = 1
			order by mop.name""",
			company,
			pluck=True,
		)
		by_company[company] = {
			"expense_accounts": expense_accounts,
			"asset_accounts": asset_accounts,
			"warehouses": warehouses,
			"modes_of_payment": modes,
		}

	suppliers = frappe.get_all(
		"Supplier", filters={"disabled": 0}, pluck="supplier_name", order_by="supplier_name", limit_page_length=500
	)

	return {
		"is_admin": scope["is_admin"],
		"branches": branches,
		"companies": by_company,
		"suppliers": suppliers,
		"categories": CATEGORIES,
		"stock_categories": STOCK_CATEGORIES,
		"asset_categories": ASSET_CATEGORIES,
	}


@frappe.whitelist()
def get_purchases(cost_center=None, limit=50):
	require_salon_role()
	cost_center = resolve_cost_center_filter(cost_center)

	filters = {"docstatus": 1, "custom_salon_purchase_category": ["is", "set"]}
	if cost_center:
		filters["cost_center"] = cost_center

	rows = frappe.get_all(
		"Purchase Invoice",
		filters=filters,
		fields=[
			"name", "posting_date", "supplier", "supplier_name", "bill_no", "cost_center",
			"custom_salon_purchase_category as category", "grand_total", "rounded_total",
			"outstanding_amount", "is_paid", "status", "currency",
		],
		order_by="posting_date desc, creation desc",
		limit_page_length=min(int(limit or 50), 200),
	)

	month_start = getdate(today()).replace(day=1)
	month_filters = dict(filters)
	month_filters["posting_date"] = [">=", month_start]
	month = frappe.get_all(
		"Purchase Invoice",
		filters=month_filters,
		fields=["custom_salon_purchase_category as category", "grand_total", "rounded_total", "outstanding_amount"],
	)
	totals = {c: 0 for c in CATEGORIES}
	unpaid = 0
	for m in month:
		totals[m.category] = totals.get(m.category, 0) + flt(m.rounded_total or m.grand_total)
	for r in frappe.get_all(
		"Purchase Invoice",
		filters=dict(filters, outstanding_amount=[">", 0]),
		fields=["outstanding_amount"],
	):
		unpaid += flt(r.outstanding_amount)

	return {
		"purchases": rows,
		"month_start": month_start,
		"month_totals": totals,
		"expensed_now": sum(totals[c] for c in EXPENSE_CATEGORIES),
		"stock_bought": sum(totals[c] for c in STOCK_CATEGORIES),
		"assets_bought": sum(totals[c] for c in ASSET_CATEGORIES),
		"unpaid": unpaid,
	}


def _get_or_create_supplier(supplier_name):
	supplier_name = (supplier_name or "").strip()
	if not supplier_name:
		frappe.throw(_("Enter who you bought from (supplier)"))
	existing = frappe.db.get_value("Supplier", {"supplier_name": supplier_name}, "name") or (
		supplier_name if frappe.db.exists("Supplier", supplier_name) else None
	)
	if existing:
		return existing
	group = frappe.db.get_single_value("Buying Settings", "supplier_group") or frappe.db.get_value(
		"Supplier Group", {"is_group": 0}, "name"
	)
	supplier = frappe.get_doc(
		{"doctype": "Supplier", "supplier_name": supplier_name, "supplier_group": group, "supplier_type": "Company"}
	)
	supplier.insert(ignore_permissions=True)
	return supplier.name


def _resolve_branch(cost_center):
	scope = get_user_scope()
	if scope["is_admin"]:
		if not cost_center:
			frappe.throw(_("Pick the branch this purchase is for"))
	else:
		cost_center = scope["cost_center"]
	check_cost_center_access(cost_center)
	return cost_center


def _get_cash_account(mode_of_payment, company):
	account = frappe.db.get_value(
		"Mode of Payment Account", {"parent": mode_of_payment, "company": company}, "default_account"
	)
	if not account:
		frappe.throw(
			_("Mode of Payment {0} has no default Cash/Bank account for {1}").format(mode_of_payment, company)
		)
	return account


@frappe.whitelist()
def create_purchase(data):
	require_salon_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)

	category = data.get("category")
	if category not in CATEGORIES:
		frappe.throw(_("Pick what kind of purchase this is"))

	cost_center = _resolve_branch(data.get("cost_center"))
	company = frappe.db.get_value("Cost Center", cost_center, "company")
	supplier = _get_or_create_supplier(data.get("supplier"))
	posting_date = getdate(data.get("posting_date") or today())
	lines = data.get("lines") or []

	pi = frappe.new_doc("Purchase Invoice")
	pi.company = company
	pi.supplier = supplier
	pi.posting_date = posting_date
	pi.set_posting_time = 1
	pi.bill_no = (data.get("bill_no") or "").strip() or None
	pi.bill_date = posting_date if pi.bill_no else None
	pi.cost_center = cost_center
	pi.custom_salon_purchase_category = category
	pi.remarks = (data.get("notes") or "").strip() or None

	if category in STOCK_CATEGORIES:
		warehouse = data.get("warehouse")
		if not warehouse:
			profile = get_pos_profile_for_cost_center(cost_center)
			warehouse = frappe.db.get_value("POS Profile", profile, "warehouse") if profile else None
		if not warehouse:
			frappe.throw(_("Pick the store room (warehouse) this stock goes into"))
		if frappe.db.get_value("Warehouse", warehouse, "company") != company:
			frappe.throw(_("Warehouse {0} does not belong to {1}").format(warehouse, company))
		pi.update_stock = 1
		pi.set_warehouse = warehouse
		for i, line in enumerate(lines, start=1):
			item_code = line.get("item_code")
			qty = flt(line.get("qty"))
			rate = flt(line.get("rate"))
			if not item_code:
				continue
			if not frappe.db.get_value("Item", item_code, "is_stock_item"):
				frappe.throw(_("Row {0}: {1} is not a stock item").format(i, item_code))
			if qty <= 0:
				frappe.throw(_("Row {0}: quantity must be more than zero").format(i))
			pi.append(
				"items",
				{"item_code": item_code, "qty": qty, "rate": rate, "warehouse": warehouse, "cost_center": cost_center},
			)
	else:
		ensure_purchase_items()
		is_asset = category in ASSET_CATEGORIES
		item_code = ASSET_ITEM if is_asset else EXPENSE_ITEM
		uom = frappe.db.get_value("Item", item_code, "stock_uom")
		for i, line in enumerate(lines, start=1):
			account = line.get("account")
			amount = flt(line.get("amount"))
			if not account and not amount:
				continue
			acc = frappe.db.get_value(
				"Account", account, ["company", "root_type", "account_type", "is_group", "account_name"], as_dict=True
			)
			if not acc or acc.company != company or acc.is_group:
				frappe.throw(_("Row {0}: pick a valid account for {1}").format(i, company))
			if is_asset and acc.account_type != "Fixed Asset":
				frappe.throw(_("Row {0}: {1} is not a Fixed Asset account").format(i, account))
			if not is_asset and acc.root_type != "Expense":
				frappe.throw(_("Row {0}: {1} is not an Expense account").format(i, account))
			if amount <= 0:
				frappe.throw(_("Row {0}: amount must be more than zero").format(i))
			description = (line.get("description") or "").strip() or acc.account_name
			pi.append(
				"items",
				{
					"item_code": item_code,
					"item_name": description[:140],
					"description": description,
					"qty": 1,
					"uom": uom,
					"conversion_factor": 1,
					"rate": amount,
					"expense_account": account,
					"cost_center": cost_center,
				},
			)

	if not pi.items:
		frappe.throw(_("Add at least one line"))

	paid_now = data.get("payment") == "Paid now"
	if paid_now:
		mode = data.get("mode_of_payment")
		if not mode:
			frappe.throw(_("Pick how it was paid"))
		pi.is_paid = 1
		pi.mode_of_payment = mode
		pi.cash_bank_account = _get_cash_account(mode, company)

	pi.flags.ignore_permissions = True
	pi.insert()
	if paid_now:
		pi.paid_amount = flt(pi.rounded_total) or flt(pi.grand_total)
		pi.base_paid_amount = flt(pi.paid_amount * flt(pi.conversion_rate or 1), pi.precision("base_paid_amount"))
		pi.save()
	pi.submit()
	return {"name": pi.name, "grand_total": pi.rounded_total or pi.grand_total, "outstanding": pi.outstanding_amount}


@frappe.whitelist()
def pay_purchase(purchase_invoice, mode_of_payment):
	"""Settle an on-credit purchase in full with a Payment Entry."""
	require_salon_role()
	pi = frappe.get_doc("Purchase Invoice", purchase_invoice)
	if pi.docstatus != 1 or not pi.get("custom_salon_purchase_category"):
		frappe.throw(_("{0} is not a submitted salon purchase").format(purchase_invoice))
	check_cost_center_access(pi.cost_center)
	if flt(pi.outstanding_amount) <= 0:
		frappe.throw(_("{0} is already paid").format(purchase_invoice))

	from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

	account = _get_cash_account(mode_of_payment, pi.company)
	pe = get_payment_entry("Purchase Invoice", pi.name, bank_account=account)
	pe.mode_of_payment = mode_of_payment
	pe.reference_no = pi.bill_no or pi.name
	pe.reference_date = today()
	pe.cost_center = pi.cost_center
	pe.flags.ignore_permissions = True
	pe.insert()
	pe.submit()
	return pe.name
