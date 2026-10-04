"""Public online booking page: /book (no login needed)."""

import frappe

no_cache = 1


def get_context(context):
	context.no_header = True
	context.no_breadcrumbs = True
	context.title = "Book an appointment"
	context.company = frappe.db.get_single_value("Global Defaults", "default_company") or "Salon"
	return context
