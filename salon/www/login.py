"""Salon Suite login page (overrides Frappe's /login).

The template is our own (salon/www/login.html, red/white suite theme, no
Frappe web chrome); the context still comes from Frappe's own login
controller so redirects and system settings behave exactly as before.
"""

import frappe
from frappe.www import login as frappe_login

from salon.auth import get_salon_home

no_cache = 1


def get_context(context):
	if frappe.session.user != "Guest" and not frappe.local.request.args.get("redirect-to"):
		home = get_salon_home()
		if home:
			frappe.local.flags.redirect_location = home
			raise frappe.Redirect

	frappe_login.get_context(context)
	context.no_header = True
	context.no_breadcrumbs = True
	context.title = "Salon Suite — Sign in"
	context.company = frappe.db.get_single_value("Global Defaults", "default_company") or ""
	return context
