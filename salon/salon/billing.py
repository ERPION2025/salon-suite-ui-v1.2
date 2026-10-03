import frappe
from frappe import _
from frappe.utils import nowdate

from salon.salon.permissions import get_pos_profile_for_cost_center


def make_draft_pos_invoice(customer, cost_center, items):
	"""Create a DRAFT POS Sales Invoice for a branch and return
	(sales_invoice_name, pos_profile_name).

	Same hand-off pattern Salon Booking uses: the draft shows up under the
	POS register's "Draft" orders for the branch, a cashier takes payment
	and submits it there, and only that submit recognises revenue.

	items: list of dicts with item_code, qty, rate.
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
	si.due_date = nowdate()
	si.company = pos_profile.company
	si.currency = frappe.get_cached_value("Company", pos_profile.company, "default_currency")
	si.cost_center = cost_center
	si.is_pos = 1
	si.is_created_using_pos = 1
	si.pos_profile = pos_profile_name
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
	for p in pos_profile.payments:
		si.append("payments", {"mode_of_payment": p.mode_of_payment, "amount": 0})
	si.insert(ignore_permissions=True)
	return si.name, pos_profile_name
