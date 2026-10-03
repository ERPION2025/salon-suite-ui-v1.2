"""Salon Suite > POS Profiles.

A salon-styled front end over the native POS Profile doctype, limited to
what a branch actually needs: branch (Cost Center), store room, payment
methods, cashiers and a few register switches. Visible to Salon Manager and
System Manager only (page roles + server-side checks below). A Salon
Manager can only create/edit the profile(s) of their own branch.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint

from salon.salon.permissions import (
	SALON_MANAGER,
	SALON_USER,
	check_cost_center_access,
	get_user_scope,
	require_manager_role,
)


@frappe.whitelist()
def get_pos_profiles():
	require_manager_role()
	scope = get_user_scope()
	filters = {}
	if not scope["is_admin"]:
		filters["cost_center"] = scope["cost_center"]

	profiles = frappe.get_all(
		"POS Profile",
		filters=filters,
		fields=[
			"name", "company", "cost_center", "warehouse", "customer", "selling_price_list",
			"disabled", "allow_rate_change", "allow_discount_change", "modified",
		],
		order_by="disabled asc, name asc",
	)
	for p in profiles:
		p["payments"] = frappe.get_all(
			"POS Payment Method",
			filters={"parent": p.name, "parenttype": "POS Profile"},
			fields=["mode_of_payment", "default"],
			order_by="idx",
		)
		p["users"] = frappe.get_all(
			"POS Profile User",
			filters={"parent": p.name, "parenttype": "POS Profile"},
			fields=["user", "default"],
			order_by="idx",
		)
		for u in p["users"]:
			u["full_name"] = frappe.db.get_value("User", u.user, "full_name") or u.user
	return {"profiles": profiles, "is_admin": scope["is_admin"]}


@frappe.whitelist()
def get_pos_profile_setup():
	"""Options for the create/edit dialog."""
	require_manager_role()
	scope = get_user_scope()

	branch_filters = {"is_group": 0, "disabled": 0}
	if not scope["is_admin"]:
		branch_filters["name"] = scope["cost_center"]
	branches = frappe.get_all(
		"Cost Center", filters=branch_filters, fields=["name", "cost_center_name", "company"], order_by="name"
	)

	companies = {}
	for company in sorted({b.company for b in branches}):
		companies[company] = {
			"warehouses": frappe.get_all(
				"Warehouse",
				filters={"company": company, "is_group": 0, "disabled": 0},
				fields=["name", "warehouse_name"],
				order_by="warehouse_name",
			),
			# Only modes that already have a Cash/Bank account for this
			# company - POS Profile validation rejects any other.
			"modes_of_payment": frappe.db.sql(
				"""select mop.name from `tabMode of Payment` mop
				join `tabMode of Payment Account` mpa on mpa.parent = mop.name
				where mpa.company = %s and ifnull(mpa.default_account, '') != '' and mop.enabled = 1
				order by mop.name""",
				company,
				pluck=True,
			),
		}

	# Cashier candidates: enabled users holding a salon role.
	users = frappe.db.sql(
		"""select distinct u.name, u.full_name from `tabUser` u
		join `tabHas Role` hr on hr.parent = u.name and hr.parenttype = 'User'
		where u.enabled = 1 and hr.role in %(roles)s
		order by u.full_name""",
		{"roles": (SALON_USER, SALON_MANAGER)},
		as_dict=True,
	)

	price_lists = frappe.get_all(
		"Price List", filters={"selling": 1, "enabled": 1}, pluck="name", order_by="name"
	)

	return {
		"is_admin": scope["is_admin"],
		"branches": branches,
		"companies": companies,
		"users": users,
		"price_lists": price_lists,
	}


def _default_write_off_account(company):
	return (
		frappe.get_cached_value("Company", company, "write_off_account")
		or frappe.get_cached_value("Company", company, "round_off_account")
		or frappe.db.get_value(
			"Account", {"company": company, "account_type": "Round Off", "is_group": 0}, "name"
		)
	)


@frappe.whitelist()
def save_pos_profile(data):
	require_manager_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)

	scope = get_user_scope()
	cost_center = data.get("cost_center")
	if not scope["is_admin"]:
		cost_center = scope["cost_center"]
	if not cost_center:
		frappe.throw(_("Pick the branch for this register"))
	check_cost_center_access(cost_center)
	company = frappe.db.get_value("Cost Center", cost_center, "company")

	if data.get("name"):
		doc = frappe.get_doc("POS Profile", data.name)
		# A manager may only touch their own branch's register.
		check_cost_center_access(doc.cost_center)
		if doc.company != company:
			frappe.throw(_("A POS Profile can't be moved to a branch of another company"))
	else:
		new_name = (data.get("profile_name") or "").strip()
		if not new_name:
			frappe.throw(_("Give the register a name, e.g. the branch name"))
		if frappe.db.exists("POS Profile", new_name):
			frappe.throw(_("A POS Profile named {0} already exists").format(new_name))
		doc = frappe.new_doc("POS Profile")
		doc.company = company
		doc.currency = frappe.get_cached_value("Company", company, "default_currency")
		doc.write_off_limit = 1
		doc.flags.salon_new_name = new_name

	warehouse = data.get("warehouse")
	if not warehouse or frappe.db.get_value("Warehouse", warehouse, "company") != company:
		frappe.throw(_("Pick the store room (warehouse) this register sells from"))

	modes = [m for m in (data.get("payment_methods") or []) if m]
	if not modes:
		frappe.throw(_("Pick at least one payment method"))
	default_mode = data.get("default_payment_method") if data.get("default_payment_method") in modes else modes[0]

	doc.cost_center = cost_center
	doc.write_off_cost_center = cost_center
	doc.write_off_account = doc.write_off_account or _default_write_off_account(company)
	if not doc.write_off_account:
		frappe.throw(_("Set a Write Off Account on Company {0} first").format(company))
	doc.warehouse = warehouse
	doc.customer = data.get("customer") or None
	doc.selling_price_list = data.get("selling_price_list") or None
	doc.allow_rate_change = cint(data.get("allow_rate_change"))
	doc.allow_discount_change = cint(data.get("allow_discount_change"))
	doc.disabled = cint(data.get("disabled"))

	doc.set("payments", [])
	for m in modes:
		doc.append("payments", {"mode_of_payment": m, "default": 1 if m == default_mode else 0})

	doc.set("applicable_for_users", [])
	for user in [u for u in (data.get("users") or []) if u]:
		# Make this the user's default register unless another active
		# profile of the same company already is (POS Profile validation
		# refuses two defaults per user).
		other_default = frappe.db.sql(
			"""select pf.name from `tabPOS Profile User` pfu
			join `tabPOS Profile` pf on pf.name = pfu.parent
			where pfu.user = %s and pfu.default = 1 and pf.disabled = 0
				and pf.company = %s and pf.name != %s""",
			(user, company, doc.name or ""),
		)
		doc.append("applicable_for_users", {"user": user, "default": 0 if other_default else 1})

	doc.flags.ignore_permissions = True
	if doc.is_new():
		doc.insert(set_name=doc.flags.salon_new_name)
	else:
		doc.save()
	return doc.name
