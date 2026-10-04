"""Online customer booking (public page /book).

Guests pick a branch, a service, a stylist (or "any"), a day and a free
time slot, leave their name + mobile (+ email), and get a Tentative Salon
Booking that the salon confirms from the Calendar / Bookings screens.

Which services show online:
  - Items ticked "Bookable Online" (Item > custom_bookable_online), or if
    none are ticked yet,
  - sales Items in an Item Group whose name contains "Service", plus any
    non-stock sales Item - excluding Packages / Salon Purchases.
Opening hours come from site_config (salon_open_time / salon_close_time,
default 10:00-21:00) in 30-minute slots.

All endpoints are allow_guest, read only what the page needs, and the
create call is rate-limited.
"""

import re

import frappe
from frappe import _
from frappe.rate_limiter import rate_limit
from frappe.utils import add_days, add_to_date, cint, flt, get_datetime, getdate, now_datetime, today

SLOT_MINUTES = 30
MAX_DAYS_AHEAD = 60
EXCLUDED_GROUPS = ("Packages", "Salon Purchases")


def _open_close():
	return (
		frappe.conf.get("salon_open_time") or "10:00",
		frappe.conf.get("salon_close_time") or "21:00",
	)


def _branches():
	"""Branches that can take bookings: Cost Centers with an active POS Profile."""
	ccs = frappe.get_all("POS Profile", filters={"disabled": 0}, pluck="cost_center")
	ccs = sorted({c for c in ccs if c})
	return [{"name": c, "label": re.sub(r" - [^-]+$", "", c)} for c in ccs]


def _service_items():
	has_flag = frappe.db.has_column("Item", "custom_bookable_online")
	base = {"disabled": 0, "is_sales_item": 1, "item_group": ["not in", EXCLUDED_GROUPS]}
	fields = ["name", "item_name", "item_group"]
	if frappe.db.has_column("Item", "custom_service_minutes"):
		fields.append("custom_service_minutes")
	items = []
	if has_flag:
		items = frappe.get_all("Item", filters=dict(base, custom_bookable_online=1), fields=fields)
	if not items:
		service_groups = [g for g in frappe.get_all("Item Group", pluck="name") if "service" in g.lower()]
		by_group = frappe.get_all("Item", filters=dict(base, item_group=["in", service_groups or [""]]), fields=fields)
		non_stock = frappe.get_all("Item", filters=dict(base, is_stock_item=0), fields=fields)
		seen, items = set(), []
		for i in by_group + non_stock:
			if i.name not in seen:
				seen.add(i.name)
				items.append(i)
	for i in items:
		i["rate"] = flt(frappe.db.get_value("Item Price", {"item_code": i.name, "selling": 1}, "price_list_rate"))
		i["duration"] = cint(i.pop("custom_service_minutes", 0)) or 30
	return sorted(items, key=lambda x: (x.item_group, x.item_name))


def _stylists(branch):
	return frappe.get_all(
		"Salon Stylist",
		filters={"cost_center": branch},
		fields=["name", "stylist_name", "skills"],
		order_by="stylist_name",
	)


@frappe.whitelist(allow_guest=True)
def get_booking_options():
	branches = _branches()
	return {
		"branches": branches,
		"services": _service_items(),
		"stylists": {b["name"]: _stylists(b["name"]) for b in branches},
		"currency": frappe.db.get_default("currency"),
		"max_days_ahead": MAX_DAYS_AHEAD,
		"salon_name": frappe.db.get_single_value("Global Defaults", "default_company") or "Salon",
	}


def _busy(stylist, start, end):
	return bool(
		frappe.db.sql(
			"""select name from `tabSalon Booking`
			where salon_stylist = %(s)s and status not in ('Cancelled', 'No-Show')
				and booking_datetime < %(end)s and end_datetime > %(start)s
			limit 1""",
			{"s": stylist, "start": start, "end": end},
		)
	)


def _validate_day(day):
	day = getdate(day)
	if day < getdate(today()) or day > getdate(add_days(today(), MAX_DAYS_AHEAD)):
		frappe.throw(_("Pick a date within the next {0} days").format(MAX_DAYS_AHEAD))
	return day


def _free_stylists(branch, stylist, start, end):
	candidates = [stylist] if stylist else [s.name for s in _stylists(branch)]
	return [s for s in candidates if not _busy(s, start, end)]


@frappe.whitelist(allow_guest=True)
def get_slots(branch, service, date, stylist=None):
	if branch not in [b["name"] for b in _branches()]:
		frappe.throw(_("Pick a branch"))
	day = _validate_day(date)
	if stylist and frappe.db.get_value("Salon Stylist", stylist, "cost_center") != branch:
		frappe.throw(_("That stylist doesn't work at this branch"))
	duration = next((s["duration"] for s in _service_items() if s["name"] == service), None)
	if duration is None:
		frappe.throw(_("Pick a service"))

	open_t, close_t = _open_close()
	cursor = get_datetime(f"{day} {open_t}")
	close = get_datetime(f"{day} {close_t}")
	earliest = add_to_date(now_datetime(), minutes=30)
	slots = []
	while add_to_date(cursor, minutes=duration) <= close:
		end = add_to_date(cursor, minutes=duration)
		if cursor >= earliest and _free_stylists(branch, stylist, cursor, end):
			slots.append(cursor.strftime("%H:%M"))
		cursor = add_to_date(cursor, minutes=SLOT_MINUTES)
	return slots


def _find_or_create_customer(full_name, mobile, email):
	digits = re.sub(r"\D", "", mobile or "")
	if len(digits) < 7:
		frappe.throw(_("Enter a valid mobile number"))
	existing = None
	for c in frappe.get_all("Customer", filters={"mobile_no": ["is", "set"]}, fields=["name", "mobile_no"]):
		if re.sub(r"\D", "", c.mobile_no or "")[-8:] == digits[-8:]:
			existing = c.name
			break
	if not existing and email:
		existing = frappe.db.get_value("Customer", {"email_id": email}, "name")
	if existing:
		return existing

	customer = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": full_name,
			"customer_type": "Individual",
			"customer_group": frappe.db.get_single_value("Selling Settings", "customer_group")
			or frappe.db.get_value("Customer Group", {"is_group": 0}, "name"),
			"territory": frappe.db.get_single_value("Selling Settings", "territory")
			or frappe.db.get_value("Territory", {"is_group": 0}, "name"),
			"mobile_no": mobile,
			"email_id": email or None,
		}
	)
	customer.flags.ignore_permissions = True
	customer.insert()
	return customer.name


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=5, seconds=60 * 60)
def create_online_booking(branch, service, date, time, full_name, mobile, email=None, stylist=None, notes=None):
	full_name = (full_name or "").strip()
	email = (email or "").strip().lower() or None
	if not full_name:
		frappe.throw(_("Enter your name"))
	if email:
		frappe.utils.validate_email_address(email, throw=True)
	if not re.match(r"^\d{2}:\d{2}$", time or ""):
		frappe.throw(_("Pick a time"))
	if time not in get_slots(branch, service, date, stylist):
		frappe.throw(_("Sorry, that time was just taken - please pick another slot"))

	day = _validate_day(date)
	duration = next(s["duration"] for s in _service_items() if s["name"] == service)
	start = get_datetime(f"{day} {time}")
	free = _free_stylists(branch, stylist, start, add_to_date(start, minutes=duration))
	if not free:
		frappe.throw(_("Sorry, that time was just taken - please pick another slot"))

	customer = _find_or_create_customer(full_name, mobile, email)
	booking = frappe.get_doc(
		{
			"doctype": "Salon Booking",
			"customer": customer,
			"salon_stylist": free[0],
			"cost_center": branch,
			"booking_datetime": start,
			"status": "Tentative",
			"booking_source": "Online",
			"notes": ((notes or "").strip()[:500] or None),
			"services": [{"item": service, "qty": 1, "duration_minutes": duration}],
		}
	)
	booking.flags.ignore_permissions = True
	booking.insert()

	try:
		from salon.notifications import send_booking_message

		send_booking_message(booking.name, kind="confirmation")
	except Exception:
		frappe.log_error(title="Salon Suite: online booking confirmation failed")

	return {
		"booking": booking.name,
		"when": start.strftime("%a %d %b %Y, %H:%M"),
		"stylist": frappe.db.get_value("Salon Stylist", free[0], "stylist_name"),
	}
