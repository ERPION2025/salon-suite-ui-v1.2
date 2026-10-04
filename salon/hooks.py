app_name = "salon"
app_title = "Salon Suite"
app_publisher = "Erpion"
app_description = "Salon booking, stylist commission and stock-consumption suite for ERPNext"
app_email = "pranav@erpion.in"
app_license = "MIT"

# Apps that must already be installed on the site before this app.
# HR/Payroll doctypes (Employee, Salary Component, Additional Salary) live
# in the separate Frappe HR app as of ERPNext v14+, not in erpnext core.
required_apps = ["erpnext", "hrms"]

# Includes in <head>
# ------------------
app_include_css = "/assets/salon/css/salon.css"
app_include_js = "/assets/salon/js/salon_common.js"

# Landing page for Salon User specifically is set on the Role itself
# (home_page field, see salon/setup.py) rather than here - app_home would
# force EVERY user, System Manager included, onto the salon dashboard,
# which is exactly what "system manager can see rest of them" rules out.

# Store/branch isolation: non-System Manager users (POS Profile cashiers,
# stylists) only ever see Salon Bookings for their own Cost Center, in the
# native list view/reports as well as our custom Dashboard/Calendar pages.
permission_query_conditions = {
	"Salon Booking": "salon.salon.permissions.get_permission_query_conditions",
}
has_permission = {
	"Salon Booking": "salon.salon.permissions.has_permission",
}

# Revenue and stylist commission are driven off real POS activity, not
# booking status: a completed booking hands off a draft POS invoice, and
# only submitting THAT (i.e. a cashier actually taking payment) creates the
# commission entry. See Salon Booking.create_draft_invoice() and
# salon/salon/events.py.
doc_events = {
	"Sales Invoice": {
		"on_submit": "salon.salon.events.on_sales_invoice_submit",
	},
}

# Fixtures
# --------
# Client 360's Preferences panel (stylist/color formula/allergies/
# birthday) reads these straight off the real Customer doctype.
fixtures = ["Custom Field"]

# Creates the "Salon User" role (with its own home_page) and grants it
# exactly the doctype permissions the 9 custom pages need - idempotent,
# reruns safely on every migrate. See salon/setup.py for why this isn't
# a fixture (Custom DocPerm autonames via an unpredictable hash).
after_migrate = "salon.setup.after_migrate"

# Booking reminders (email / SMS) for appointments in the next 24 hours,
# gift-card expiry. See salon/notifications.py and salon/gift_cards.py.
scheduler_events = {
	"hourly": ["salon.notifications.send_due_reminders"],
	"daily": ["salon.gift_cards.expire_gift_cards"],
}
