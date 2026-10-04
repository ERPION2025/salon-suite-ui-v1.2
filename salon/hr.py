"""Salon Suite > Attendance and Leave (self-service + manager views).

Everything posts to native Frappe HR records, so payroll picks it up with
no extra work:

  Check in   -> Employee Checkin (IN) + the day's Attendance (Present,
                submitted) if there isn't one yet.
  Check out  -> Employee Checkin (OUT); the Attendance gets out time and
                working hours.
  Mark       -> a submitted Attendance for any past date / today (Present,
                Absent, Half Day, Work From Home) - payment days on the
                Salary Slip follow it when payroll is based on Attendance.
  Leave      -> Leave Application (Open) -> manager Approves/Rejects ->
                submitted; approved leave marks Attendance "On Leave".
  Allocation / Policy (Salon Manager / System Manager only) -> Leave
                Allocation, Leave Policy and Leave Policy Assignment.

Who sees what:
  stylist  - only their own records (Employee.user_id = the login user)
  manager  - every employee of their branch, plus their own
  admin    - everyone
"""

import json

import frappe
from frappe import _
from frappe.utils import (
	add_days,
	cint,
	flt,
	get_datetime,
	getdate,
	now_datetime,
	nowdate,
	time_diff_in_hours,
	today,
)

from salon.salon.permissions import (
	MANAGER_ROLES,
	get_user_scope,
	require_manager_role,
	require_salon_role,
)

ATTENDANCE_STATUSES = ("Present", "Absent", "Half Day", "Work From Home")


# ---------------------------------------------------------------------------
# Scope helpers
# ---------------------------------------------------------------------------
def is_manager(user=None):
	roles = frappe.get_roles(user or frappe.session.user)
	return any(r in roles for r in MANAGER_ROLES) or (user or frappe.session.user) == "Administrator"


def get_my_employee():
	return frappe.db.get_value("Employee", {"user_id": frappe.session.user, "status": "Active"}, "name")


def get_scope_employees():
	"""Employees the current user may see/record for."""
	me = get_my_employee()
	if not is_manager():
		return [me] if me else []

	scope = get_user_scope()
	if scope["is_admin"]:
		return frappe.get_all("Employee", filters={"status": "Active"}, pluck="name", order_by="employee_name")

	cc = scope["cost_center"]
	emps = set(frappe.get_all("Salon Stylist", filters={"cost_center": cc}, pluck="employee"))
	emps |= set(frappe.get_all("Employee", filters={"payroll_cost_center": cc, "status": "Active"}, pluck="name"))
	if me:
		emps.add(me)
	return sorted(e for e in emps if e)


def check_employee_access(employee):
	if not employee or employee not in get_scope_employees():
		frappe.throw(_("You can only record for yourself or your branch's team"), frappe.PermissionError)


def _employee_rows(names):
	if not names:
		return []
	rows = frappe.get_all(
		"Employee",
		filters={"name": ["in", names]},
		fields=["name", "employee_name", "designation", "company", "payroll_cost_center", "user_id"],
		order_by="employee_name",
	)
	branches = dict(
		frappe.get_all("Salon Stylist", filters={"employee": ["in", names]}, fields=["employee", "cost_center"], as_list=True)
	)
	for r in rows:
		r["branch"] = branches.get(r.name) or r.payroll_cost_center
	return rows


def _branches():
	return frappe.get_all(
		"Cost Center", filters={"is_group": 0, "disabled": 0}, fields=["name", "company"], order_by="name"
	)


def _default_branch(employee):
	return frappe.db.get_value("Salon Stylist", {"employee": employee}, "cost_center") or frappe.db.get_value(
		"Employee", employee, "payroll_cost_center"
	)


def _resolve_employee(employee):
	"""Stylists always act as themselves; managers may pick a team member."""
	me = get_my_employee()
	if not employee or not is_manager():
		if not me:
			frappe.throw(
				_("Your login isn't linked to an Employee yet. Ask your manager to link it (Add Stylist > Login).")
			)
		return me
	check_employee_access(employee)
	return employee


# ---------------------------------------------------------------------------
# Attendance
# ---------------------------------------------------------------------------
def _today_logs(employee, day=None):
	day = getdate(day or today())
	return frappe.get_all(
		"Employee Checkin",
		filters={"employee": employee, "time": ["between", [f"{day} 00:00:00", f"{day} 23:59:59"]]},
		fields=["name", "log_type", "time", "custom_salon_branch"],
		order_by="time asc",
	)


def _attendance_for(employee, day):
	return frappe.db.get_value(
		"Attendance",
		{"employee": employee, "attendance_date": getdate(day), "docstatus": 1},
		["name", "status", "in_time", "out_time", "working_hours", "custom_salon_branch"],
		as_dict=True,
	)


@frappe.whitelist()
def get_attendance_dashboard(employee=None, from_date=None, to_date=None):
	require_salon_role()
	me = get_my_employee()
	manager = is_manager()
	scope = get_scope_employees()

	to_date = getdate(to_date or today())
	from_date = getdate(from_date or add_days(to_date, -30))

	my_today = None
	if me:
		logs = _today_logs(me)
		my_today = {
			"employee": me,
			"employee_name": frappe.db.get_value("Employee", me, "employee_name"),
			"default_branch": _default_branch(me),
			"attendance": _attendance_for(me, today()),
			"logs": logs,
			"checked_in": bool(logs and logs[-1].log_type == "IN"),
		}

	team_today = []
	if manager:
		for e in _employee_rows(scope):
			att = _attendance_for(e.name, today())
			logs = _today_logs(e.name)
			team_today.append(
				{
					"employee": e.name,
					"employee_name": e.employee_name,
					"branch": (att and att.custom_salon_branch) or e.branch,
					"status": att.status if att else None,
					"in_time": (att and att.in_time) or (logs[0].time if logs else None),
					"out_time": (att and att.out_time) or next(
						(l.time for l in reversed(logs) if l.log_type == "OUT"), None
					),
					"working_hours": att.working_hours if att else None,
					"checked_in": bool(logs and logs[-1].log_type == "IN"),
				}
			)

	if employee:
		check_employee_access(employee)
		filter_emps = [employee]
	else:
		filter_emps = scope if manager else ([me] if me else [])

	records = []
	if filter_emps:
		records = frappe.get_all(
			"Attendance",
			filters={
				"employee": ["in", filter_emps],
				"attendance_date": ["between", [from_date, to_date]],
				"docstatus": 1,
			},
			fields=[
				"name", "employee", "employee_name", "attendance_date", "status", "in_time", "out_time",
				"working_hours", "leave_type", "custom_salon_branch",
			],
			order_by="attendance_date desc, employee_name asc",
			limit_page_length=500,
		)

	return {
		"me": me,
		"is_manager": manager,
		"my_today": my_today,
		"team_today": team_today,
		"employees": _employee_rows(scope) if manager else [],
		"records": records,
		"from_date": from_date,
		"to_date": to_date,
		"branches": _branches(),
		"statuses": ATTENDANCE_STATUSES,
	}


@frappe.whitelist()
def check_in(branch=None, employee=None):
	require_salon_role()
	employee = _resolve_employee(employee)
	branch = branch or _default_branch(employee)
	logs = _today_logs(employee)
	if logs and logs[-1].log_type == "IN":
		frappe.throw(_("Already checked in at {0}").format(get_datetime(logs[-1].time).strftime("%H:%M")))

	now = now_datetime()
	checkin = frappe.get_doc(
		{
			"doctype": "Employee Checkin",
			"employee": employee,
			"log_type": "IN",
			"time": now,
			"device_id": branch,
			"custom_salon_branch": branch,
		}
	)
	checkin.insert(ignore_permissions=True)

	att = _attendance_for(employee, now.date())
	if not att:
		doc = frappe.get_doc(
			{
				"doctype": "Attendance",
				"employee": employee,
				"attendance_date": now.date(),
				"status": "Present",
				"company": frappe.db.get_value("Employee", employee, "company"),
				"in_time": now,
				"custom_salon_branch": branch,
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		doc.submit()
		att_name = doc.name
	else:
		att_name = att.name
	checkin.db_set("attendance", att_name)
	return {"checkin": checkin.name, "attendance": att_name, "time": now}


@frappe.whitelist()
def check_out(employee=None):
	require_salon_role()
	employee = _resolve_employee(employee)
	logs = _today_logs(employee)
	if not logs or logs[-1].log_type != "IN":
		frappe.throw(_("Check in first"))

	now = now_datetime()
	branch = logs[-1].custom_salon_branch
	checkin = frappe.get_doc(
		{
			"doctype": "Employee Checkin",
			"employee": employee,
			"log_type": "OUT",
			"time": now,
			"device_id": branch,
			"custom_salon_branch": branch,
		}
	)
	checkin.insert(ignore_permissions=True)

	att = _attendance_for(employee, now.date())
	if att:
		# Hours = sum of every IN->OUT pair today (breaks excluded).
		hours, last_in = 0.0, None
		for l in logs + [frappe._dict(log_type="OUT", time=now)]:
			if l.log_type == "IN":
				last_in = l.time
			elif last_in:
				hours += time_diff_in_hours(l.time, last_in)
				last_in = None
		frappe.db.set_value(
			"Attendance", att.name, {"out_time": now, "working_hours": flt(hours, 2)}, update_modified=True
		)
		if not att.in_time:
			frappe.db.set_value("Attendance", att.name, "in_time", logs[0].time)
		checkin.db_set("attendance", att.name)
	return {"checkin": checkin.name, "time": now}


@frappe.whitelist()
def mark_attendance(data):
	"""Record attendance for today or a past date (past-dated entries are
	allowed so missed days still reach payroll)."""
	require_salon_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)
	employee = _resolve_employee(data.get("employee"))
	day = getdate(data.get("attendance_date") or today())
	if day > getdate(today()):
		frappe.throw(_("Attendance can't be marked for a future date"))
	status = data.get("status") or "Present"
	if status not in ATTENDANCE_STATUSES:
		frappe.throw(_("Pick a valid status"))
	if _attendance_for(employee, day):
		frappe.throw(_("Attendance for {0} is already recorded").format(frappe.format(day, {"fieldtype": "Date"})))

	in_time = get_datetime(f"{day} {data.in_time}") if data.get("in_time") else None
	out_time = get_datetime(f"{day} {data.out_time}") if data.get("out_time") else None
	if in_time and out_time and out_time <= in_time:
		frappe.throw(_("Check-out time must be after check-in time"))

	doc = frappe.get_doc(
		{
			"doctype": "Attendance",
			"employee": employee,
			"attendance_date": day,
			"status": status,
			"company": frappe.db.get_value("Employee", employee, "company"),
			"custom_salon_branch": data.get("branch") or _default_branch(employee),
		}
	)
	if status in ("Present", "Half Day", "Work From Home"):
		doc.in_time = in_time
		doc.out_time = out_time
		if in_time and out_time:
			doc.working_hours = flt(time_diff_in_hours(out_time, in_time), 2)
	doc.flags.ignore_permissions = True
	doc.insert()
	doc.submit()
	return doc.name


# ---------------------------------------------------------------------------
# Leave
# ---------------------------------------------------------------------------
def _balances(employee):
	try:
		from hrms.hr.doctype.leave_application.leave_application import get_leave_details

		return get_leave_details(employee, nowdate()).get("leave_allocation", {})
	except Exception:
		frappe.clear_last_message()
		return {}


@frappe.whitelist()
def get_leave_dashboard(employee=None):
	require_salon_role()
	me = get_my_employee()
	manager = is_manager()
	scope = get_scope_employees()

	if employee:
		check_employee_access(employee)
	focus = employee or me

	leave_types = frappe.get_all(
		"Leave Type", fields=["name", "is_lwp", "max_continuous_days_allowed", "allow_negative"], order_by="name"
	)

	filter_emps = [employee] if employee else (scope if manager else ([me] if me else []))
	applications = []
	if filter_emps:
		applications = frappe.get_all(
			"Leave Application",
			filters={"employee": ["in", filter_emps], "docstatus": ["!=", 2]},
			fields=[
				"name", "employee", "employee_name", "leave_type", "from_date", "to_date", "total_leave_days",
				"half_day", "status", "docstatus", "description", "posting_date", "leave_approver",
			],
			order_by="from_date desc",
			limit_page_length=300,
		)
		# Pending approvals first.
		applications.sort(key=lambda a: 0 if (a.status == "Open" and a.docstatus == 0) else 1)

	return {
		"me": me,
		"is_manager": manager,
		"focus": focus,
		"focus_name": frappe.db.get_value("Employee", focus, "employee_name") if focus else None,
		"balances": _balances(focus) if focus else {},
		"leave_types": leave_types,
		"applications": applications,
		"employees": _employee_rows(scope) if manager else [],
	}


@frappe.whitelist()
def get_leave_balance(employee):
	require_salon_role()
	if employee != get_my_employee():
		check_employee_access(employee)
	return _balances(employee)


@frappe.whitelist()
def apply_leave(data):
	require_salon_role()
	data = frappe._dict(json.loads(data) if isinstance(data, str) else data)
	employee = _resolve_employee(data.get("employee"))
	if not data.get("leave_type") or not data.get("from_date") or not data.get("to_date"):
		frappe.throw(_("Pick the leave type and dates"))

	from hrms.hr.doctype.leave_application.leave_application import get_leave_approver

	approver = get_leave_approver(employee)
	if not approver and is_manager() and employee != get_my_employee():
		approver = frappe.session.user

	doc = frappe.get_doc(
		{
			"doctype": "Leave Application",
			"employee": employee,
			"leave_type": data.leave_type,
			"from_date": getdate(data.from_date),
			"to_date": getdate(data.to_date),
			"half_day": cint(data.get("half_day")),
			"half_day_date": getdate(data.half_day_date) if cint(data.get("half_day")) and data.get("half_day_date") else None,
			"description": data.get("reason"),
			"status": "Open",
			"posting_date": today(),
			"company": frappe.db.get_value("Employee", employee, "company"),
			"leave_approver": approver,
			"follow_via_email": 0,
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	return doc.name


@frappe.whitelist()
def decide_leave(name, status):
	require_manager_role()
	if status not in ("Approved", "Rejected"):
		frappe.throw(_("Pick Approve or Reject"))
	doc = frappe.get_doc("Leave Application", name)
	check_employee_access(doc.employee)
	if doc.docstatus != 0 or doc.status != "Open":
		frappe.throw(_("{0} has already been decided").format(name))
	doc.status = status
	doc.flags.ignore_permissions = True
	doc.save()
	doc.submit()
	return doc.status


# ---- Allocation / Policy (Salon Manager, System Manager) ------------------
@frappe.whitelist()
def get_leave_admin():
	require_manager_role()
	scope = get_scope_employees()
	allocations = []
	if scope:
		allocations = frappe.get_all(
			"Leave Allocation",
			filters={"employee": ["in", scope], "docstatus": 1},
			fields=[
				"name", "employee", "employee_name", "leave_type", "from_date", "to_date",
				"new_leaves_allocated", "total_leaves_allocated", "leave_policy", "carry_forward",
			],
			order_by="from_date desc, employee_name",
			limit_page_length=300,
		)
	policies = frappe.get_all(
		"Leave Policy", filters={"docstatus": 1}, fields=["name", "title"], order_by="creation desc"
	)
	for p in policies:
		p["details"] = frappe.get_all(
			"Leave Policy Detail", filters={"parent": p.name}, fields=["leave_type", "annual_allocation"], order_by="idx"
		)
		p["assigned"] = frappe.db.count(
			"Leave Policy Assignment", {"leave_policy": p.name, "docstatus": 1, "employee": ["in", scope or [""]]}
		)
	return {
		"allocations": allocations,
		"policies": policies,
		"employees": _employee_rows(scope),
		"leave_types": frappe.get_all("Leave Type", pluck="name", order_by="name"),
	}


def _clean_employees(employees):
	employees = json.loads(employees) if isinstance(employees, str) else (employees or [])
	employees = [e for e in employees if e]
	if not employees:
		frappe.throw(_("Pick at least one employee"))
	for e in employees:
		check_employee_access(e)
	return employees


@frappe.whitelist()
def create_allocation(employees, leave_type, from_date, to_date, new_leaves_allocated, carry_forward=0):
	require_manager_role()
	created = []
	for emp in _clean_employees(employees):
		doc = frappe.get_doc(
			{
				"doctype": "Leave Allocation",
				"employee": emp,
				"leave_type": leave_type,
				"from_date": getdate(from_date),
				"to_date": getdate(to_date),
				"new_leaves_allocated": flt(new_leaves_allocated),
				"carry_forward": cint(carry_forward),
				"company": frappe.db.get_value("Employee", emp, "company"),
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		doc.submit()
		created.append(doc.name)
	return created


@frappe.whitelist()
def create_policy(title, details):
	require_manager_role()
	details = json.loads(details) if isinstance(details, str) else details
	rows = [d for d in (details or []) if d.get("leave_type") and flt(d.get("annual_allocation")) > 0]
	if not rows:
		frappe.throw(_("Add at least one leave type with its yearly days"))
	doc = frappe.get_doc(
		{
			"doctype": "Leave Policy",
			"title": title,
			"leave_policy_details": [
				{"leave_type": d["leave_type"], "annual_allocation": flt(d["annual_allocation"])} for d in rows
			],
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert()
	doc.submit()
	return doc.name


@frappe.whitelist()
def assign_policy(leave_policy, employees, effective_from, effective_to, carry_forward=0):
	"""Leave Policy Assignment per employee; submitting it creates the
	Leave Allocations for the period."""
	require_manager_role()
	created = []
	for emp in _clean_employees(employees):
		doc = frappe.get_doc(
			{
				"doctype": "Leave Policy Assignment",
				"employee": emp,
				"leave_policy": leave_policy,
				"effective_from": getdate(effective_from),
				"effective_to": getdate(effective_to),
				"carry_forward": cint(carry_forward),
				"company": frappe.db.get_value("Employee", emp, "company"),
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		doc.submit()
		created.append(doc.name)
	return created
