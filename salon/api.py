import frappe
from frappe import _
from frappe.utils import cint, flt, get_datetime, getdate, today

from salon.salon.permissions import (
	check_cost_center_access,
	get_user_scope,
	require_salon_role,
	resolve_cost_center_filter,
)


@frappe.whitelist()
def get_dashboard_kpis(cost_center=None):
	scope = get_user_scope()
	cost_center = resolve_cost_center_filter(cost_center)

	filters = {"booking_datetime": [">=", today()]}
	if cost_center:
		filters["cost_center"] = cost_center

	bookings = frappe.get_all(
		"Salon Booking",
		filters=filters,
		fields=["name", "customer", "salon_stylist", "booking_datetime", "status", "total_amount"],
		order_by="booking_datetime asc",
	)

	# Revenue reflects actual submitted invoices (Sales Invoice, the POS
	# ones our completed bookings hand off to included) - not a booking's
	# status. A Completed booking with nobody billing it yet at the POS
	# contributes nothing here on purpose.
	revenue_conditions = ["docstatus = 1", "posting_date = %(today)s"]
	revenue_values = {"today": today()}
	if cost_center:
		revenue_conditions.append("cost_center = %(cost_center)s")
		revenue_values["cost_center"] = cost_center

	revenue = frappe.db.sql(
		f"""select coalesce(sum(grand_total), 0) from `tabSales Invoice`
		where {' and '.join(revenue_conditions)}""",
		revenue_values,
	)[0][0]

	commission_conditions = ["salary_component = 'Service Commission'", "date(payroll_date) = %(today)s"]
	commission_values = {"today": today()}
	if cost_center:
		# Additional Salary doesn't carry cost_center directly; scope via the stylists in this store.
		commission_conditions.append(
			"employee in (select employee from `tabSalon Stylist` where cost_center = %(cost_center)s)"
		)
		commission_values["cost_center"] = cost_center

	commissions = frappe.db.sql(
		f"""select coalesce(sum(amount), 0) from `tabAdditional Salary`
		where {' and '.join(commission_conditions)}""",
		commission_values,
	)[0][0]

	stylist_conditions = ["b.status not in ('Cancelled', 'No-Show')", "date(b.booking_datetime) = %(today)s"]
	stylist_values = {"today": today()}
	if cost_center:
		stylist_conditions.append("b.cost_center = %(cost_center)s")
		stylist_values["cost_center"] = cost_center

	active_stylists = frappe.db.sql(
		f"""select count(distinct b.salon_stylist) from `tabSalon Booking` b
		where {' and '.join(stylist_conditions)}""",
		stylist_values,
	)[0][0]

	pos_filters = {"status": "Open"}
	if cost_center:
		pos_profiles = frappe.get_all("POS Profile", filters={"cost_center": cost_center}, pluck="name")
		pos_filters["pos_profile"] = ["in", pos_profiles or [""]]
	active_pos = frappe.db.count("POS Opening Entry", filters=pos_filters)

	store_sales = []
	if not cost_center:
		# Only meaningful in the "All Branches" admin view — a single store's
		# figure is already the revenue_today tile above.
		store_sales = frappe.db.sql(
			"""
			select cost_center, coalesce(sum(grand_total), 0) as revenue
			from `tabSales Invoice`
			where docstatus = 1 and posting_date = %(today)s
				and cost_center is not null and cost_center != ''
			group by cost_center
			order by revenue desc
			""",
			{"today": today()},
			as_dict=True,
		)

	return {
		"today_bookings": len(bookings),
		"revenue_today": revenue,
		"commissions_today": commissions,
		"active_stylists": active_stylists,
		"active_pos": active_pos,
		"store_sales": store_sales,
		"schedule": bookings,
		"is_admin": scope["is_admin"],
		"user_cost_center": None if scope["is_admin"] else scope["cost_center"],
	}


@frappe.whitelist()
def mark_completed(booking):
	doc = frappe.get_doc("Salon Booking", booking)
	check_cost_center_access(doc.cost_center)
	doc.status = "Completed"
	doc.save()
	return doc.status


@frappe.whitelist()
def complete_and_bill(booking):
	"""Mark a booking Completed - this creates and submits its Sales
	Invoice. Returns the invoice so the caller can open the invoice popup
	and record the payment."""
	from salon.salon.permissions import get_pos_profile_for_cost_center

	doc = frappe.get_doc("Salon Booking", booking)
	check_cost_center_access(doc.cost_center)
	doc.status = "Completed"
	doc.save()

	return {
		"status": doc.status,
		"sales_invoice": doc.sales_invoice,
		"pos_profile": get_pos_profile_for_cost_center(doc.cost_center),
	}


@frappe.whitelist()
def update_booking_status(booking, status):
	"""Generic status setter for the Calendar's board view (dragging a
	card between the Tentative/Confirmed/Checked In columns). Completed
	specifically goes through complete_and_bill instead, since that also
	resolves the POS Profile for the caller - but even called directly,
	Salon Booking.on_update() would still create the draft invoice the
	same way, since that's keyed off the status value, not the caller."""
	doc = frappe.get_doc("Salon Booking", booking)
	check_cost_center_access(doc.cost_center)
	doc.status = status
	doc.save()
	return {"status": doc.status, "sales_invoice": doc.sales_invoice}


@frappe.whitelist()
def get_calendar_data(start, end, cost_center=None):
	scope = get_user_scope()
	cost_center = resolve_cost_center_filter(cost_center)

	stylist_filters = {}
	if cost_center:
		stylist_filters["cost_center"] = cost_center

	stylists = frappe.get_all(
		"Salon Stylist",
		filters=stylist_filters,
		fields=["name", "stylist_name", "employee", "cost_center"],
		order_by="stylist_name asc",
	)

	conditions = ["b.booking_datetime < %(end)s", "b.end_datetime > %(start)s"]
	values = {"start": get_datetime(start), "end": get_datetime(end)}
	if cost_center:
		conditions.append("b.cost_center = %(cost_center)s")
		values["cost_center"] = cost_center

	bookings = frappe.db.sql(
		f"""
		select b.name, b.customer, b.salon_stylist, b.booking_datetime, b.end_datetime,
			b.status, b.total_amount
		from `tabSalon Booking` b
		where {' and '.join(conditions)}
		order by b.booking_datetime asc
		""",
		values,
		as_dict=True,
	)

	for b in bookings:
		b["services"] = frappe.get_all(
			"Booking Service",
			filters={"parent": b.name},
			fields=["item", "qty"],
			order_by="idx asc",
		)

	item_codes = {s.item for b in bookings for s in b["services"]}
	item_names = {}
	if item_codes:
		item_names = dict(
			frappe.get_all(
				"Item", filters={"name": ["in", list(item_codes)]}, fields=["name", "item_name"], as_list=True
			)
		)
	for b in bookings:
		for s in b["services"]:
			s["item_name"] = item_names.get(s.item, s.item)

	return {
		"stylists": stylists,
		"bookings": bookings,
		"is_admin": scope["is_admin"],
		"user_cost_center": None if scope["is_admin"] else scope["cost_center"],
	}


@frappe.whitelist()
def reschedule_booking(booking, booking_datetime, salon_stylist=None):
	doc = frappe.get_doc("Salon Booking", booking)
	check_cost_center_access(doc.cost_center)

	if salon_stylist and salon_stylist != doc.salon_stylist:
		new_stylist_cc = frappe.db.get_value("Salon Stylist", salon_stylist, "cost_center")
		check_cost_center_access(new_stylist_cc)
		doc.salon_stylist = salon_stylist

	doc.booking_datetime = get_datetime(booking_datetime)
	doc.save()
	return {
		"name": doc.name,
		"booking_datetime": doc.booking_datetime,
		"end_datetime": doc.end_datetime,
		"salon_stylist": doc.salon_stylist,
	}


def _attach_stylist_names(rows, key="salon_stylist"):
	ids = list({r.get(key) for r in rows if r.get(key)})
	names = {}
	if ids:
		names = dict(
			frappe.get_all(
				"Salon Stylist", filters={"name": ["in", ids]}, fields=["name", "stylist_name"], as_list=True
			)
		)
	for r in rows:
		r[f"{key}_name"] = names.get(r.get(key), r.get(key))
	return rows


def _attach_services_label(rows):
	"""Human-readable service names (Item Name, not the item code)."""
	names = {}
	for r in rows:
		codes = frappe.get_all("Booking Service", filters={"parent": r.name}, pluck="item", order_by="idx")
		labels = []
		for code in codes:
			if code not in names:
				names[code] = frappe.db.get_value("Item", code, "item_name") or code
			labels.append(names[code])
		r["services_label"] = ", ".join(labels)
	return rows


@frappe.whitelist()
def get_all_bookings(cost_center=None, date=None, limit=200):
	cost_center = resolve_cost_center_filter(cost_center)

	filters = {}
	if cost_center:
		filters["cost_center"] = cost_center
	if date:
		day = getdate(date)
		filters["booking_datetime"] = ["between", [f"{day} 00:00:00", f"{day} 23:59:59"]]

	rows = frappe.get_all(
		"Salon Booking",
		filters=filters,
		fields=[
			"name", "booking_datetime", "cost_center", "customer", "salon_stylist",
			"status", "sales_invoice", "stock_entry", "total_amount",
		],
		order_by="booking_datetime desc",
		limit_page_length=min(cint(limit) or 200, 500),
	)
	_attach_stylist_names(rows)
	_attach_services_label(rows)

	# Older builds created the invoice as a DRAFT at booking-completion time (see
	# Salon Booking.create_draft_invoice()) and only becomes real revenue
	# once a cashier submits it in POS - surface that distinction rather
	# than just "has an invoice or not".
	invoice_names = [r.sales_invoice for r in rows if r.sales_invoice]
	invoice_info = {}
	if invoice_names:
		invoice_info = {
			i.name: i
			for i in frappe.get_all(
				"Sales Invoice",
				filters={"name": ["in", invoice_names]},
				fields=["name", "docstatus", "outstanding_amount"],
			)
		}
	for r in rows:
		info = invoice_info.get(r.sales_invoice) if r.sales_invoice else None
		r["invoice_docstatus"] = info.docstatus if info else None
		r["invoice_outstanding"] = flt(info.outstanding_amount) if info else None

	return rows


@frappe.whitelist()
def search_clients(txt=""):
	return frappe.get_all(
		"Customer",
		filters=[["customer_name", "like", f"%{txt}%"]] if txt else None,
		fields=["name", "customer_name", "mobile_no"],
		limit_page_length=10,
	)


@frappe.whitelist()
def get_client_360(customer):
	cust = frappe.get_doc("Customer", customer)

	visits = frappe.get_all(
		"Salon Booking",
		filters={"customer": customer, "status": "Completed"},
		fields=["name", "booking_datetime", "salon_stylist", "total_amount", "sales_invoice"],
		order_by="booking_datetime desc",
		limit_page_length=20,
	)
	_attach_stylist_names(visits)
	_attach_services_label(visits)

	# LTV reflects actual realised revenue - submitted Sales Invoices only
	# - consistent with how get_dashboard_kpis treats revenue. A Completed
	# booking nobody's billed yet at the POS doesn't count here either.
	ltv = frappe.db.sql(
		"""select coalesce(sum(grand_total), 0) from `tabSales Invoice`
		where customer = %(customer)s and docstatus = 1""",
		{"customer": customer},
	)[0][0]

	loyalty_points = 0
	if frappe.db.exists("DocType", "Loyalty Point Entry"):
		loyalty_points = frappe.db.sql(
			"""select coalesce(sum(loyalty_points), 0) from `tabLoyalty Point Entry`
			where customer = %(customer)s""",
			{"customer": customer},
		)[0][0]

	package = frappe.get_all(
		"Package Subscription",
		filters={"customer": customer, "status": "Active"},
		fields=["name", "package_item", "sessions_total", "sessions_used", "sessions_remaining", "expiry_date"],
		limit_page_length=1,
	)

	subscriptions = frappe.get_all(
		"Package Subscription",
		filters={"customer": customer},
		fields=[
			"name", "package_item", "cost_center", "status", "sessions_total", "sessions_used",
			"sessions_remaining", "start_date", "expiry_date", "sales_invoice", "creation",
		],
		order_by="creation desc",
		limit_page_length=50,
	)
	for sub in subscriptions:
		sub["package_name"] = frappe.db.get_value("Item", sub.package_item, "item_name") or sub.package_item

	preferred_stylist_name = None
	if cust.get("custom_preferred_stylist"):
		preferred_stylist_name = frappe.db.get_value(
			"Salon Stylist", cust.custom_preferred_stylist, "stylist_name"
		)

	return {
		"customer": {
			"name": cust.name,
			"customer_name": cust.customer_name,
			"mobile_no": getattr(cust, "mobile_no", None),
			"territory": getattr(cust, "territory", None),
		},
		"preferences": {
			"preferred_stylist_name": preferred_stylist_name,
			"color_formula": cust.get("custom_color_formula"),
			"allergies": cust.get("custom_allergies"),
			"birthday": cust.get("custom_birthday"),
		},
		"stats": {"visits": len(visits), "ltv": ltv, "loyalty_points": loyalty_points},
		"active_package": package[0] if package else None,
		"subscriptions": subscriptions,
		"visits": visits,
	}


# ---------------------------------------------------------------------------
# Branch picker shared by the salon dialogs (subscriptions, purchases, POS
# Profiles). Admins pick any branch; everyone else is fixed to their own.
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_branch_options():
	require_salon_role()
	scope = get_user_scope()
	filters = {"is_group": 0, "disabled": 0}
	if not scope["is_admin"]:
		filters["name"] = scope["cost_center"]
	branches = frappe.get_all(
		"Cost Center", filters=filters, fields=["name", "cost_center_name", "company"], order_by="name asc"
	)
	return {"is_admin": scope["is_admin"], "branches": branches}


# ---------------------------------------------------------------------------
# Package subscriptions sold from Client 360 - billed like a completed
# booking: a submitted Sales Invoice on the branch, which activates the
# subscription (salon/salon/events.py). Payment is recorded from the
# invoice popup.
# ---------------------------------------------------------------------------
@frappe.whitelist()
def get_subscription_options():
	require_salon_role()
	packages = frappe.get_all(
		"Item",
		filters={"item_group": "Packages", "disabled": 0},
		fields=["name", "item_name", "custom_package_sessions", "custom_package_validity_days"],
		order_by="item_name asc",
	)
	for p in packages:
		p["rate"] = (
			frappe.db.get_value("Item Price", {"item_code": p.name, "selling": 1}, "price_list_rate") or 0
		)
	branch_info = get_branch_options()
	return {"packages": packages, **branch_info}


@frappe.whitelist()
def create_subscription(customer, package_item, sessions_total=None, cost_center=None, start_date=None):
	require_salon_role()
	scope = get_user_scope()
	if scope["is_admin"]:
		if not cost_center:
			frappe.throw(_("Pick the branch this subscription is sold at"))
	else:
		cost_center = scope["cost_center"]
	check_cost_center_access(cost_center)

	if not frappe.db.exists("Customer", customer):
		frappe.throw(_("Client {0} not found").format(customer))
	item = frappe.db.get_value(
		"Item",
		package_item,
		["name", "item_group", "disabled", "custom_package_sessions"],
		as_dict=True,
	)
	if not item or item.disabled or item.item_group != "Packages":
		frappe.throw(_("{0} is not an active package").format(package_item))

	sessions_total = cint(sessions_total) or cint(item.custom_package_sessions)
	if sessions_total <= 0:
		frappe.throw(_("Enter how many sessions this package includes"))

	rate = frappe.db.get_value("Item Price", {"item_code": package_item, "selling": 1}, "price_list_rate") or 0

	from salon.salon.billing import make_sales_invoice

	sub = frappe.new_doc("Package Subscription")
	sub.customer = customer
	sub.package_item = package_item
	sub.cost_center = cost_center
	sub.sessions_total = sessions_total
	sub.sessions_used = 0
	sub.start_date = getdate(start_date) if start_date else None
	sub.status = "Pending Payment"
	sub.insert(ignore_permissions=True)

	# Submitted invoice straight away; linking it before submit lets the
	# Sales Invoice on_submit hook flip the subscription to Active
	# (salon/salon/events.py). Payment is recorded from the invoice popup.
	sales_invoice = make_sales_invoice(
		customer,
		cost_center,
		[{"item_code": package_item, "qty": 1, "rate": rate}],
		before_submit=lambda si: sub.db_set("sales_invoice", si.name),
	)
	sub.reload()

	return {"subscription": sub.name, "status": sub.status, "sales_invoice": sales_invoice}


@frappe.whitelist()
def get_loyalty_data():
	programs = frappe.get_all(
		"Loyalty Program",
		fields=["name", "loyalty_program_name", "conversion_factor", "expiry_duration"],
	)
	for p in programs:
		p["tiers"] = frappe.get_all(
			"Loyalty Program Collection",
			filters={"parent": p.name},
			fields=["tier_name", "min_spent", "collection_factor"],
			order_by="min_spent asc",
		)
	return {"programs": programs}


@frappe.whitelist()
def get_packages_data(cost_center=None):
	cost_center = resolve_cost_center_filter(cost_center)

	packages = frappe.get_all(
		"Item",
		filters={"item_group": "Packages", "disabled": 0},
		fields=["name", "item_name", "description"],
	)
	for p in packages:
		p["rate"] = frappe.db.get_value(
			"Item Price", {"item_code": p.name, "selling": 1}, "price_list_rate"
		) or 0

	# Live subscriptions: Active, plus ones sold but still Pending Payment
	# (older builds left those waiting on a draft POS invoice).
	sub_filters = {"status": ["in", ["Active", "Pending Payment"]]}
	or_filters = None
	if cost_center:
		# Own branch, plus older subscriptions created before Branch existed.
		or_filters = [["cost_center", "=", cost_center], ["cost_center", "is", "not set"]]
	subs = frappe.get_all(
		"Package Subscription",
		filters=sub_filters,
		or_filters=or_filters,
		fields=[
			"name", "customer", "package_item", "cost_center", "status", "sessions_total",
			"sessions_used", "sessions_remaining", "expiry_date", "sales_invoice",
		],
		order_by="creation desc",
		limit_page_length=100,
	)
	for sub in subs:
		sub["customer_name"] = frappe.db.get_value("Customer", sub.customer, "customer_name") or sub.customer
		sub["package_name"] = frappe.db.get_value("Item", sub.package_item, "item_name") or sub.package_item
	return {"packages": packages, "subscriptions": subs}


@frappe.whitelist()
def get_services_data():
	services = frappe.get_all(
		"Item",
		filters={"is_stock_item": 0, "disabled": 0},
		fields=["name", "item_name", "item_group"],
	)
	codes = [s.name for s in services]
	prices = {}
	if codes:
		prices = dict(
			frappe.get_all(
				"Item Price", filters={"item_code": ["in", codes], "selling": 1}, fields=["item_code", "price_list_rate"], as_list=True
			)
		)
	for s in services:
		s["rate"] = prices.get(s.name, 0)
		s["has_recipe"] = frappe.db.exists("Salon Service Recipe", s.name) is not None
	return services


@frappe.whitelist()
def get_stylists_data(cost_center=None):
	cost_center = resolve_cost_center_filter(cost_center)
	filters = {}
	if cost_center:
		filters["cost_center"] = cost_center

	stylists = frappe.get_all(
		"Salon Stylist",
		filters=filters,
		fields=["name", "stylist_name", "employee", "cost_center", "skills", "commission_rate"],
		order_by="stylist_name asc",
	)

	employee_ids = [s.employee for s in stylists if s.employee]
	designations = {}
	if employee_ids:
		designations = dict(
			frappe.get_all("Employee", filters={"name": ["in", employee_ids]}, fields=["name", "designation"], as_list=True)
		)
	for s in stylists:
		s["designation"] = designations.get(s.employee)

	attendance = []
	if employee_ids:
		attendance = frappe.get_all(
			"Attendance",
			filters={"employee": ["in", employee_ids], "attendance_date": today(), "docstatus": ["!=", 2]},
			fields=["employee", "employee_name", "status", "in_time", "out_time", "working_hours"],
		)
	return {"stylists": stylists, "attendance": attendance}


@frappe.whitelist()
def get_stock_data(cost_center=None):
	cost_center = resolve_cost_center_filter(cost_center)

	warehouse_filters = {}
	if cost_center:
		pos_profiles = frappe.get_all("POS Profile", filters={"cost_center": cost_center}, pluck="warehouse")
		warehouse_filters["warehouse"] = ["in", pos_profiles or [""]]

	stock = frappe.get_all(
		"Bin",
		filters=warehouse_filters,
		fields=["item_code", "warehouse", "actual_qty", "reserved_qty", "valuation_rate"],
		order_by="item_code asc",
		limit_page_length=100,
	)
	stock = [s for s in stock if flt(s.actual_qty) or flt(s.reserved_qty)]

	# Recent entries of every type (booking consumption, transfers,
	# receipts, issues). Branch staff only see entries touching their
	# branch's store room(s). (Stock Entry has no header cost_center.)
	entry_filters = {"docstatus": 1}
	if cost_center:
		branch_warehouses = frappe.get_all("POS Profile", filters={"cost_center": cost_center}, pluck="warehouse")
		parents = set(
			frappe.get_all(
				"Stock Entry Detail", filters={"s_warehouse": ["in", branch_warehouses or [""]]}, pluck="parent"
			)
		) | set(
			frappe.get_all(
				"Stock Entry Detail", filters={"t_warehouse": ["in", branch_warehouses or [""]]}, pluck="parent"
			)
		)
		entry_filters["name"] = ["in", list(parents) or [""]]
	recent_entries = frappe.get_all(
		"Stock Entry",
		filters=entry_filters,
		fields=["name", "posting_date", "posting_time", "stock_entry_type", "from_warehouse", "to_warehouse"],
		order_by="creation desc",
		limit_page_length=20,
	)
	for e in recent_entries:
		e["items_label"] = ", ".join(
			f"{i.item_code} × {flt(i.qty):g}"
			for i in frappe.get_all(
				"Stock Entry Detail", filters={"parent": e.name}, fields=["item_code", "qty"], order_by="idx"
			)
		)
		e["booking"] = frappe.db.get_value("Salon Booking", {"stock_entry": e.name}, "name")

	return {"stock": stock, "recent_entries": recent_entries}


@frappe.whitelist()
def get_payroll_data(cost_center=None):
	cost_center = resolve_cost_center_filter(cost_center)

	stylist_filters = {}
	if cost_center:
		stylist_filters["cost_center"] = cost_center
	stylists = frappe.get_all("Salon Stylist", filters=stylist_filters, fields=["name", "stylist_name", "employee", "commission_rate"])

	from frappe.utils import get_first_day, get_last_day
	month_start = get_first_day(today())
	month_end = get_last_day(today())

	rows = []
	total = 0
	for s in stylists:
		amount = frappe.db.sql(
			"""select coalesce(sum(amount), 0) from `tabAdditional Salary`
			where employee = %(employee)s and salary_component = 'Service Commission'
			and payroll_date between %(start)s and %(end)s and docstatus = 1""",
			{"employee": s.employee, "start": month_start, "end": month_end},
		)[0][0]
		count = frappe.db.count(
			"Additional Salary",
			filters={"employee": s.employee, "salary_component": "Service Commission", "payroll_date": ["between", [month_start, month_end]], "docstatus": 1},
		)
		rows.append({"stylist_name": s.stylist_name, "employee": s.employee, "commission_rate": s.commission_rate, "entries": count, "amount": amount})
		total += amount

	return {"rows": rows, "total": total, "month_start": month_start, "month_end": month_end}


@frappe.whitelist()
def get_gl_postings(cost_center=None, limit=30):
	cost_center = resolve_cost_center_filter(cost_center)

	filters = {"is_cancelled": 0}
	if cost_center:
		filters["cost_center"] = cost_center

	vouchers = frappe.get_all(
		"GL Entry",
		filters=filters,
		fields=["voucher_type", "voucher_no"],
		order_by="creation desc",
		limit_page_length=limit,
		group_by="voucher_type, voucher_no",
	)

	postings = []
	for v in vouchers:
		lines = frappe.get_all(
			"GL Entry",
			filters={"voucher_type": v.voucher_type, "voucher_no": v.voucher_no, "is_cancelled": 0},
			fields=["account", "debit", "credit", "cost_center", "posting_date", "remarks", "party"],
			order_by="idx asc",
		)
		if lines:
			postings.append({"voucher_type": v.voucher_type, "voucher_no": v.voucher_no, "lines": lines})

	return postings


@frappe.whitelist()
def get_pnl_data(cost_center=None):
	cost_center = resolve_cost_center_filter(cost_center)
	from frappe.utils import get_first_day, get_last_day

	month_start = get_first_day(today())
	month_end = get_last_day(today())

	conditions = ["gl.posting_date between %(start)s and %(end)s", "gl.is_cancelled = 0"]
	values = {"start": month_start, "end": month_end}
	if cost_center:
		conditions.append("gl.cost_center = %(cost_center)s")
		values["cost_center"] = cost_center

	rows = frappe.db.sql(
		f"""
		select acc.root_type, acc.account_name, sum(gl.credit - gl.debit) as net
		from `tabGL Entry` gl
		join `tabAccount` acc on acc.name = gl.account
		where {' and '.join(conditions)}
		group by acc.name
		having net != 0
		order by acc.root_type, net desc
		""",
		values,
		as_dict=True,
	)

	revenue = [r for r in rows if r.root_type == "Income"]
	expense = [r for r in rows if r.root_type == "Expense"]
	total_revenue = sum(flt(r.net) for r in revenue)
	total_expense = sum(flt(-r.net) for r in expense)

	# Purchases recorded on the Purchases screen this period, by category,
	# so the P&L page can show how each kind reaches (or doesn't reach) the
	# expense lines above. Informational only - the P&L itself is GL.
	purchases = []
	if frappe.db.has_column("Purchase Invoice", "custom_salon_purchase_category"):
		pi_conditions = [
			"docstatus = 1",
			"posting_date between %(start)s and %(end)s",
			"ifnull(custom_salon_purchase_category, '') != ''",
		]
		if cost_center:
			pi_conditions.append("cost_center = %(cost_center)s")
		purchases = frappe.db.sql(
			f"""
			select custom_salon_purchase_category as category, count(*) as bills,
				sum(if(base_rounded_total, base_rounded_total, base_grand_total)) as amount
			from `tabPurchase Invoice`
			where {' and '.join(pi_conditions)}
			group by custom_salon_purchase_category
			""",
			values,
			as_dict=True,
		)

	return {
		"revenue": revenue,
		"expense": expense,
		"total_revenue": total_revenue,
		"total_expense": total_expense,
		"net_profit": total_revenue - total_expense,
		"month_start": month_start,
		"month_end": month_end,
		"purchases": purchases,
	}


@frappe.whitelist()
def create_quick_booking(customer, salon_stylist, booking_datetime, item, cost_center=None):
	scope = get_user_scope()
	stylist_cc = frappe.db.get_value("Salon Stylist", salon_stylist, "cost_center")

	if scope["is_admin"]:
		cost_center = cost_center or stylist_cc
	else:
		check_cost_center_access(stylist_cc)
		cost_center = scope["cost_center"]

	doc = frappe.new_doc("Salon Booking")
	doc.customer = customer
	doc.salon_stylist = salon_stylist
	doc.booking_datetime = get_datetime(booking_datetime)
	if cost_center:
		doc.cost_center = cost_center
	doc.append("services", {"item": item, "qty": 1})
	doc.insert()
	return doc.name


@frappe.whitelist()
def get_item_details(item_code):
	"""Everything the Services / Packages item popup shows, read-only."""
	require_salon_role()
	item = frappe.get_doc("Item", item_code)

	prices = frappe.get_all(
		"Item Price",
		filters={"item_code": item_code},
		fields=["price_list", "price_list_rate", "currency", "selling", "buying"],
		order_by="selling desc, price_list asc",
	)

	recipe = []
	if frappe.db.exists("Salon Service Recipe", item_code):
		for c in frappe.get_doc("Salon Service Recipe", item_code).consumables:
			recipe.append(
				{
					"item_code": c.raw_material,
					"item_name": frappe.db.get_value("Item", c.raw_material, "item_name") or c.raw_material,
					"qty": c.qty,
					"warehouse": c.warehouse,
				}
			)

	stock = []
	if item.is_stock_item:
		scope = get_user_scope()
		bins = frappe.get_all(
			"Bin",
			filters={"item_code": item_code},
			fields=["warehouse", "actual_qty", "reserved_qty", "valuation_rate"],
		)
		if not scope["is_admin"]:
			from salon.salon.permissions import get_pos_profile_for_cost_center

			profile = get_pos_profile_for_cost_center(scope["cost_center"])
			own_wh = frappe.db.get_value("POS Profile", profile, "warehouse") if profile else None
			bins = [b for b in bins if b.warehouse == own_wh]
		stock = bins

	return {
		"item_code": item.item_code,
		"item_name": item.item_name,
		"item_group": item.item_group,
		"description": item.description,
		"stock_uom": item.stock_uom,
		"brand": item.get("brand"),
		"image": item.image,
		"is_stock_item": item.is_stock_item,
		"is_sales_item": item.is_sales_item,
		"is_purchase_item": item.is_purchase_item,
		"disabled": item.disabled,
		"package_sessions": item.get("custom_package_sessions"),
		"package_validity_days": item.get("custom_package_validity_days"),
		"prices": prices,
		"recipe": recipe,
		"stock": stock,
	}
