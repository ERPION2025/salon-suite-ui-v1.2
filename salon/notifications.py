"""Booking confirmations / reminders (email + SMS) and WhatsApp links.

Email goes through the site's outgoing Email Account; SMS through Frappe's
SMS Settings (any HTTP SMS gateway) when it is configured. Nothing here
fails a booking if messaging isn't set up - it just skips that channel.

Reminders: an hourly job sends one reminder for every Tentative/Confirmed
booking starting in the next 24 hours (Salon Booking.reminder_sent).
WhatsApp: click-to-chat links (wa.me) with the message pre-filled - no API
account needed; a WhatsApp Business API integration can replace this later.
"""

import re
from urllib.parse import quote

import frappe
from frappe import _
from frappe.utils import add_to_date, get_datetime, now_datetime

from salon.salon.permissions import check_cost_center_access, require_salon_role


def _context(booking_name):
	b = frappe.get_doc("Salon Booking", booking_name)
	cust = frappe.db.get_value(
		"Customer", b.customer, ["customer_name", "mobile_no", "email_id"], as_dict=True
	) or frappe._dict()
	when = get_datetime(b.booking_datetime)
	services = ", ".join(
		frappe.db.get_value("Item", s.item, "item_name") or s.item for s in b.services
	)
	return frappe._dict(
		booking=b,
		name=(cust.customer_name or b.customer or "").split(" ")[0],
		mobile=cust.mobile_no,
		email=cust.email_id,
		when=when.strftime("%a %d %b, %H:%M"),
		services=services,
		branch=re.sub(r" - [^-]+$", "", b.cost_center or ""),
		stylist=frappe.db.get_value("Salon Stylist", b.salon_stylist, "stylist_name") or "",
		salon=frappe.db.get_single_value("Global Defaults", "default_company") or "the salon",
	)


def _text(c, kind):
	if kind == "confirmation":
		return _("Hi {0}, thanks for booking {1} at {2} ({3}) on {4}. Ref {5}. We'll confirm shortly.").format(
			c.name, c.services, c.salon, c.branch, c.when, c.booking.name
		)
	return _("Hi {0}, a reminder of your {1} appointment at {2} ({3}) on {4} with {5}. Reply to reschedule. Ref {6}.").format(
		c.name, c.services, c.salon, c.branch, c.when, c.stylist, c.booking.name
	)


def _sms_ready():
	return bool(frappe.db.get_single_value("SMS Settings", "sms_gateway_url"))


def send_booking_message(booking_name, kind="reminder"):
	"""Send by every channel available. Returns the channels used."""
	c = _context(booking_name)
	text = _text(c, kind)
	sent = []
	if c.email:
		try:
			frappe.sendmail(
				recipients=[c.email],
				subject=_("Your appointment at {0}").format(c.salon)
				if kind == "confirmation"
				else _("Reminder: your appointment {0}").format(c.when),
				message=f"<p>{frappe.utils.escape_html(text)}</p>",
				reference_doctype="Salon Booking",
				reference_name=booking_name,
				now=False,
			)
			sent.append("email")
		except Exception:
			frappe.log_error(title="Salon Suite: booking email failed")
	if c.mobile and _sms_ready():
		try:
			from frappe.core.doctype.sms_settings.sms_settings import send_sms

			send_sms([c.mobile], text, success_msg=False)
			sent.append("sms")
		except Exception:
			frappe.log_error(title="Salon Suite: booking SMS failed")
	return sent


def send_due_reminders():
	"""Scheduler (hourly): one reminder per booking starting in the next 24h."""
	now = now_datetime()
	due = frappe.get_all(
		"Salon Booking",
		filters={
			"status": ["in", ["Tentative", "Confirmed"]],
			"reminder_sent": 0,
			"booking_datetime": ["between", [now, add_to_date(now, hours=24)]],
		},
		pluck="name",
	)
	for name in due:
		if send_booking_message(name, "reminder"):
			frappe.db.set_value("Salon Booking", name, "reminder_sent", 1, update_modified=False)
	frappe.db.commit()


@frappe.whitelist()
def send_reminder(booking):
	require_salon_role()
	check_cost_center_access(frappe.db.get_value("Salon Booking", booking, "cost_center"))
	sent = send_booking_message(booking, "reminder")
	if not sent:
		frappe.throw(
			_("Nothing sent - the client has no email/mobile, or no outgoing email / SMS gateway is set up.")
		)
	frappe.db.set_value("Salon Booking", booking, "reminder_sent", 1, update_modified=False)
	return sent


def _wa_number(mobile):
	digits = re.sub(r"\D", "", mobile or "")
	if digits.startswith("00"):
		digits = digits[2:]
	return digits


@frappe.whitelist()
def get_whatsapp_link(booking=None, customer=None):
	"""wa.me click-to-chat link with a ready message."""
	require_salon_role()
	if booking:
		check_cost_center_access(frappe.db.get_value("Salon Booking", booking, "cost_center"))
		c = _context(booking)
		number, text = _wa_number(c.mobile), _text(c, "reminder")
	else:
		cust = frappe.db.get_value("Customer", customer, ["customer_name", "mobile_no"], as_dict=True)
		if not cust:
			frappe.throw(_("Client not found"))
		salon = frappe.db.get_single_value("Global Defaults", "default_company") or ""
		number = _wa_number(cust.mobile_no)
		text = _("Hi {0}, this is {1}.").format((cust.customer_name or "").split(" ")[0], salon)
	if not number:
		frappe.throw(_("This client has no mobile number"))
	return f"https://wa.me/{number}?text={quote(text)}"
