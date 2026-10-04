"""Salon Suite > Stock & Consumables: Stock Entry without the native form.

Material Transfer (store room -> store room, e.g. branch to branch),
Material Receipt (stock coming in without a purchase bill) and Material
Issue (write-off / internal use). Submitted straight away so balances and
the books update immediately. Staff must have their own branch's store room
on one side of the entry; System Managers can move anything.
"""

import json

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowtime, today

from salon.salon.permissions import get_pos_profile_for_cost_center, get_user_scope, require_salon_role

ENTRY_TYPES = ("Material Transfer", "Material Receipt", "Material Issue")


def _own_warehouse(scope):
	if scope["is_admin"]:
		return None
	profile = get_pos_profile_for_cost_center(scope["cost_center"])
	return frappe.db.get_value("POS Profile", profile, "warehouse") if profile else None


@frappe.whitelist()
def get_stock_entry_setup():
	require_salon_role()
	scope = get_user_scope()
	own = _own_warehouse(scope)
	companies = (
		[frappe.db.get_value("Cost Center", scope["cost_center"], "company")]
		if not scope["is_admin"]
		else frappe.get_all("Company", pluck="name")
	)
	warehouses = frappe.get_all(
		"Warehouse",
		filters={"is_group": 0, "disabled": 0, "company": ["in", [c for c in companies if c] or [""]]},
		fields=["name", "warehouse_name", "company"],
		order_by="warehouse_name",
	)
	return {
		"is_admin": scope["is_admin"],
		"own_warehouse": own,
		"warehouses": warehouses,
		"types": ENTRY_TYPES,
		"cost_center": None if scope["is_admin"] else scope["cost_center"],
	}


@frappe.whitelist()
def create_stock_entry(data):
	require_salon_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)
	entry_type = data.get("entry_type")
	if entry_type not in ENTRY_TYPES:
		frappe.throw(_("Pick the type of stock entry"))

	source = data.get("from_warehouse") if entry_type in ("Material Transfer", "Material Issue") else None
	target = data.get("to_warehouse") if entry_type in ("Material Transfer", "Material Receipt") else None
	if entry_type in ("Material Transfer", "Material Issue") and not source:
		frappe.throw(_("Pick the store room the stock comes from"))
	if entry_type in ("Material Transfer", "Material Receipt") and not target:
		frappe.throw(_("Pick the store room the stock goes to"))
	if source and target and source == target:
		frappe.throw(_("From and To store rooms must be different"))

	scope = get_user_scope()
	own = _own_warehouse(scope)
	if not scope["is_admin"]:
		if not own:
			frappe.throw(_("Your branch has no store room yet (set it on the branch's POS Profile)"))
		if own not in (source, target):
			frappe.throw(_("One side of the entry must be your branch's store room ({0})").format(own))

	company = frappe.db.get_value("Warehouse", source or target, "company")
	for wh in (source, target):
		if wh and frappe.db.get_value("Warehouse", wh, "company") != company:
			frappe.throw(_("Both store rooms must belong to the same company"))

	cost_center = data.get("cost_center") or (None if scope["is_admin"] else scope["cost_center"])

	se = frappe.new_doc("Stock Entry")
	se.stock_entry_type = entry_type
	se.purpose = entry_type
	se.company = company
	se.posting_date = getdate(data.get("posting_date") or today())
	se.posting_time = nowtime()
	se.set_posting_time = 1
	se.from_warehouse = source
	se.to_warehouse = target
	se.remarks = (data.get("remarks") or "").strip() or None

	for i, row in enumerate(data.get("items") or [], start=1):
		if not row.get("item_code"):
			continue
		qty = flt(row.get("qty"))
		if qty <= 0:
			frappe.throw(_("Row {0}: quantity must be more than zero").format(i))
		line = {"item_code": row["item_code"], "qty": qty, "s_warehouse": source, "t_warehouse": target}
		if cost_center:
			line["cost_center"] = cost_center
		if entry_type == "Material Receipt" and flt(row.get("rate")):
			line["basic_rate"] = flt(row.get("rate"))
			line["set_basic_rate_manually"] = 1
		se.append("items", line)
	if not se.items:
		frappe.throw(_("Add at least one item"))

	se.flags.ignore_permissions = True
	se.insert()
	se.submit()
	return se.name
