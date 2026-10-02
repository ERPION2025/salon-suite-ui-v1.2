import frappe

SALON_ROLE = "Salon User"

# (doctype, read, write, create, submit)
# Deliberately NOT a fixture: Custom DocPerm autonames via `hash` (random,
# unpredictable at authoring time), so it can't be hand-written as a JSON
# fixture with a stable `name` the way Custom Field can. This runs on every
# `bench migrate`, idempotently, via frappe.db.exists checks instead.
GRANTS = [
	("Customer", 1, 1, 1, 0),
	("Item", 1, 0, 0, 0),
	("Employee", 1, 0, 0, 0),
	("Salon Stylist", 1, 0, 0, 0),
	("Sales Invoice", 1, 1, 0, 1),
	("Stock Entry", 1, 0, 0, 0),
	("Bin", 1, 0, 0, 0),
	("GL Entry", 1, 0, 0, 0),
	("Loyalty Program", 1, 0, 0, 0),
	("Attendance", 1, 0, 0, 0),
	("POS Profile", 1, 0, 0, 0),
	("POS Opening Entry", 1, 1, 1, 1),
	("POS Closing Entry", 1, 1, 1, 1),
	("Cost Center", 1, 0, 0, 0),
	("Warehouse", 1, 0, 0, 0),
]


def after_migrate():
	create_role()
	grant_permissions()


def create_role():
	if frappe.db.exists("Role", SALON_ROLE):
		return
	frappe.get_doc({
		"doctype": "Role",
		"role_name": SALON_ROLE,
		"desk_access": 1,
		# Role's own native home_page, not the blanket app_home hook -
		# this way only Salon User lands on the dashboard; System Manager
		# and anyone else keeps Frappe's normal default landing page.
		"home_page": "/app/salon-dashboard",
	}).insert(ignore_permissions=True)


def grant_permissions():
	changed = False
	for dt, read, write, create, submit in GRANTS:
		if not frappe.db.exists("DocType", dt):
			# e.g. erpnext/hrms not installed yet on a standalone test of
			# this app - skip quietly rather than failing the whole migrate.
			continue
		if frappe.db.exists("Custom DocPerm", {"parent": dt, "role": SALON_ROLE}):
			continue
		frappe.get_doc({
			"doctype": "Custom DocPerm",
			"parent": dt,
			"parenttype": "DocType",
			"parentfield": "permissions",
			"role": SALON_ROLE,
			"read": read,
			"write": write,
			"create": create,
			"submit": submit,
			"report": 1,
		}).insert(ignore_permissions=True)
		changed = True
	if changed:
		frappe.clear_cache()
