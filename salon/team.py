"""Salon Suite > Stylists: add a stylist without the native forms.

One dialog creates (or reuses) the Employee, the Salon Stylist record and,
optionally, the person's login (User with the Salon User role, linked as
Employee.user_id) so they can check in and apply for leave themselves.
Salon Manager / System Manager only; managers add to their own branch.
"""

import json

import frappe
from frappe import _
from frappe.utils import flt, getdate, today, validate_email_address

from salon.salon.permissions import SALON_USER, get_user_scope, require_manager_role


@frappe.whitelist()
def get_stylist_setup():
	require_manager_role()
	scope = get_user_scope()
	branch_filters = {"is_group": 0, "disabled": 0}
	if not scope["is_admin"]:
		branch_filters["name"] = scope["cost_center"]
	branches = frappe.get_all(
		"Cost Center", filters=branch_filters, fields=["name", "company"], order_by="name"
	)
	existing = set(frappe.get_all("Salon Stylist", pluck="employee"))
	employees = [
		e
		for e in frappe.get_all(
			"Employee",
			filters={"status": "Active"},
			fields=["name", "employee_name", "company", "user_id"],
			order_by="employee_name",
		)
		if e.name not in existing
	]
	return {
		"is_admin": scope["is_admin"],
		"branches": branches,
		"employees": employees,
		"genders": frappe.get_all("Gender", pluck="name", order_by="name"),
		"designations": frappe.get_all("Designation", pluck="name", order_by="name"),
	}


@frappe.whitelist()
def create_stylist(data):
	require_manager_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)

	scope = get_user_scope()
	branch = data.get("branch")
	if not scope["is_admin"]:
		branch = scope["cost_center"]
	if not branch:
		frappe.throw(_("Pick the branch this stylist works at"))
	company = frappe.db.get_value("Cost Center", branch, "company")

	if data.get("mode") == "Existing employee":
		employee = data.get("employee")
		if not employee or not frappe.db.exists("Employee", employee):
			frappe.throw(_("Pick the employee"))
		if frappe.db.exists("Salon Stylist", {"employee": employee}):
			frappe.throw(_("{0} is already a stylist").format(employee))
		emp = frappe.get_doc("Employee", employee)
	else:
		for f, label in (
			("first_name", _("First name")),
			("gender", _("Gender")),
			("date_of_birth", _("Date of birth")),
			("date_of_joining", _("Joining date")),
		):
			if not data.get(f):
				frappe.throw(_("{0} is required").format(label))
		emp = frappe.get_doc(
			{
				"doctype": "Employee",
				"first_name": data.first_name.strip(),
				"last_name": (data.get("last_name") or "").strip() or None,
				"gender": data.gender,
				"date_of_birth": getdate(data.date_of_birth),
				"date_of_joining": getdate(data.date_of_joining or today()),
				"company": company,
				"status": "Active",
				"designation": data.get("designation") or None,
				"cell_number": data.get("mobile") or None,
				"payroll_cost_center": branch,
			}
		)
		emp.flags.ignore_permissions = True
		emp.insert()

	updates = {}
	if not emp.payroll_cost_center:
		updates["payroll_cost_center"] = branch

	# Optional login so the stylist can mark attendance / apply for leave.
	email = (data.get("login_email") or "").strip().lower()
	if email and not emp.user_id:
		validate_email_address(email, throw=True)
		if frappe.db.exists("Employee", {"user_id": email, "name": ["!=", emp.name]}):
			frappe.throw(_("{0} is already linked to another employee").format(email))
		if not frappe.db.exists("User", email):
			user = frappe.get_doc(
				{
					"doctype": "User",
					"email": email,
					"first_name": emp.first_name,
					"last_name": emp.last_name,
					"user_type": "System User",
					"send_welcome_email": 1,
					"roles": [{"role": SALON_USER}],
				}
			)
			user.flags.ignore_permissions = True
			user.insert()
		else:
			user = frappe.get_doc("User", email)
			if SALON_USER not in [r.role for r in user.roles]:
				user.append("roles", {"role": SALON_USER})
				user.flags.ignore_permissions = True
				user.save()
		updates["user_id"] = email
	if updates:
		frappe.db.set_value("Employee", emp.name, updates)

	stylist = frappe.get_doc(
		{
			"doctype": "Salon Stylist",
			"employee": emp.name,
			"stylist_name": emp.employee_name,
			"cost_center": branch,
			"commission_rate": flt(data.get("commission_rate")),
			"skills": data.get("skills") or None,
		}
	)
	stylist.flags.ignore_permissions = True
	stylist.insert()
	return {"stylist": stylist.name, "employee": emp.name, "user": updates.get("user_id") or emp.user_id}
