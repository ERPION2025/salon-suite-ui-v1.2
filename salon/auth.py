"""Salon Suite login landing.

Anyone holding Salon User or Salon Manager lands on the Salon Dashboard
after logging in (System Managers with a salon role too - they can still
reach ERPNext from the sidebar's "Open ERPNext"). Everyone else keeps
Frappe's normal landing page.

Frappe's own login response always points desk users at /app (or their
default workspace), so the redirect is done by our login page asking
get_landing_page(), plus a desk-side fallback in salon_common.js for any
other login path.
"""

import frappe
from frappe.utils import cstr

SALON_HOME = "/app/salon-dashboard"
SALON_ROLES = ("Salon User", "Salon Manager")


def get_salon_home(user=None):
	user = user or frappe.session.user
	if not user or user == "Guest":
		return None
	if any(r in frappe.get_roles(user) for r in SALON_ROLES):
		return SALON_HOME
	return None


@frappe.whitelist()
def get_landing_page(redirect_to=None):
	redirect_to = cstr(redirect_to)
	# Only same-site paths - never an external URL.
	if redirect_to.startswith("/") and not redirect_to.startswith("//") and redirect_to not in ("/login", "/"):
		return redirect_to
	return get_salon_home() or "/app"
