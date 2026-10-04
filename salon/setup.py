import frappe

SALON_ROLE = "Salon User"
MANAGER_ROLE = "Salon Manager"
SALON_ROLES = (SALON_ROLE, MANAGER_ROLE)

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
	# Purchases screen: bills are created server-side, but paying a credit
	# bill goes through ERPNext's own get_payment_entry(), which checks
	# Payment Entry create + Purchase Invoice read for the caller.
	("Purchase Invoice", 1, 0, 0, 0),
	("Payment Entry", 1, 1, 1, 1),
	("Supplier", 1, 0, 1, 0),
	("Mode of Payment", 1, 0, 0, 0),
	("Account", 1, 0, 0, 0),
	# Attendance & Leave screens: records are written server-side, but
	# HRMS's own leave-balance helper (get_leave_details) lists Leave Types
	# and pending applications with the caller's permissions.
	("Leave Type", 1, 0, 0, 0),
	("Leave Application", 1, 0, 0, 0),
]

# Salon Manager gets everything Salon User has, plus managing the
# branch's POS register.
MANAGER_EXTRA_GRANTS = [
	("POS Profile", 1, 1, 1, 0),
	("Price List", 1, 0, 0, 0),
]


def after_migrate():
	create_roles()
	repair_wiped_standard_perms()
	grant_permissions()

	# Generic Items the Purchases screen hangs overhead/asset bill lines
	# off. Never let this block a deploy - it is retried on every migrate
	# and lazily on the first overhead purchase anyway.
	try:
		from salon.purchases import ensure_purchase_items

		ensure_purchase_items()
	except Exception:
		frappe.log_error(title="Salon Suite: could not create purchase items")

	# Gift cards: item, item group and the Gift Card Liability account per
	# company. Same rule - never block a deploy.
	try:
		from salon.gift_cards import ensure_gift_card_setup

		ensure_gift_card_setup()
	except Exception:
		frappe.log_error(title="Salon Suite: could not set up gift cards")


def create_roles():
	for role in SALON_ROLES:
		if frappe.db.exists("Role", role):
			# The POS Profiles page (page.json roles) can auto-create
			# Salon Manager without a home page - fill it in.
			if not frappe.db.get_value("Role", role, "home_page"):
				frappe.db.set_value("Role", role, {"home_page": "/app/salon-dashboard", "desk_access": 1})
			continue
		frappe.get_doc({
			"doctype": "Role",
			"role_name": role,
			"desk_access": 1,
			# Role's own native home_page, not the blanket app_home hook -
			# this way only salon staff land on the dashboard; System Manager
			# and anyone else keeps Frappe's normal default landing page.
			"home_page": "/app/salon-dashboard",
		}).insert(ignore_permissions=True)


def repair_wiped_standard_perms():
	"""Earlier versions inserted a bare Custom DocPerm for Salon User. In
	Frappe, the moment ANY Custom DocPerm exists for a doctype, the
	standard DocPerms are ignored entirely (Meta.set_custom_permissions),
	so every other role (Stock User, Accounts User, Item Manager, ...)
	silently lost access to Item, Stock Entry, POS Profile, etc.

	For doctypes whose only custom rows are salon / System Manager rows,
	copy the missing standard rows back in. Doctypes someone customised in
	Role Permission Manager (other roles present) are left alone."""
	allowed = set(SALON_ROLES) | {"System Manager"}
	doctypes = {dt for dt, *_ in GRANTS + MANAGER_EXTRA_GRANTS}
	changed = False
	for dt in doctypes:
		custom_roles = set(frappe.get_all("Custom DocPerm", filters={"parent": dt}, pluck="role"))
		if not custom_roles or not custom_roles <= allowed:
			continue
		for d in frappe.get_all("DocPerm", fields="*", filters={"parent": dt}):
			if frappe.db.exists(
				"Custom DocPerm",
				{"parent": dt, "role": d.role, "permlevel": d.permlevel, "if_owner": d.if_owner},
			):
				continue
			custom_perm = frappe.new_doc("Custom DocPerm")
			custom_perm.update(d)
			custom_perm.name = None
			custom_perm.insert(ignore_permissions=True)
			changed = True
	if changed:
		frappe.clear_cache()


def grant_permissions():
	from frappe.permissions import setup_custom_perms

	changed = False
	grants = [(dt, SALON_ROLE, r, w, c, s) for dt, r, w, c, s in GRANTS]
	grants += [(dt, MANAGER_ROLE, r, w, c, s) for dt, r, w, c, s in GRANTS]
	extra = {(dt, MANAGER_ROLE) for dt, *_ in MANAGER_EXTRA_GRANTS}
	grants = [g for g in grants if (g[0], g[1]) not in extra]
	grants += [(dt, MANAGER_ROLE, r, w, c, s) for dt, r, w, c, s in MANAGER_EXTRA_GRANTS]

	for dt, role, read, write, create, submit in grants:
		if not frappe.db.exists("DocType", dt):
			# e.g. erpnext/hrms not installed yet on a standalone test of
			# this app - skip quietly rather than failing the whole migrate.
			continue
		if frappe.db.exists("Custom DocPerm", {"parent": dt, "role": role, "permlevel": 0}):
			continue
		# Copy the standard DocPerms into Custom DocPerm first (no-op if the
		# doctype is already customised) so adding our row doesn't wipe
		# every other role's access.
		setup_custom_perms(dt)
		frappe.get_doc({
			"doctype": "Custom DocPerm",
			"parent": dt,
			"parenttype": "DocType",
			"parentfield": "permissions",
			"role": role,
			"read": read,
			"write": write,
			"create": create,
			"submit": submit,
			"report": 1,
		}).insert(ignore_permissions=True)
		changed = True
	if changed:
		frappe.clear_cache()
