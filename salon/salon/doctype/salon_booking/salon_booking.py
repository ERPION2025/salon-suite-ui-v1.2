import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_to_date, flt


class SalonBooking(Document):
	def validate(self):
		self.calculate_total()
		self.calculate_schedule()
		self.check_stylist_conflict()

	def calculate_total(self):
		total = 0
		for row in self.services:
			if not row.rate:
				row.rate = frappe.db.get_value(
					"Item Price", {"item_code": row.item, "selling": 1}, "price_list_rate"
				) or 0
			row.amount = flt(row.qty) * flt(row.rate)
			total += row.amount
		self.total_amount = total

	def calculate_schedule(self):
		if not self.booking_datetime:
			return
		total_minutes = sum(flt(row.duration_minutes) or 30 for row in self.services) or 30
		self.end_datetime = add_to_date(self.booking_datetime, minutes=total_minutes)

	def check_stylist_conflict(self):
		if not (self.salon_stylist and self.booking_datetime and self.end_datetime):
			return
		if self.status in ("Cancelled", "No-Show"):
			return

		conflict = frappe.db.sql(
			"""
			select name from `tabSalon Booking`
			where salon_stylist = %(stylist)s
				and name != %(name)s
				and status not in ('Cancelled', 'No-Show')
				and booking_datetime < %(end)s
				and end_datetime > %(start)s
			""",
			{
				"stylist": self.salon_stylist,
				"name": self.name or "New Salon Booking",
				"start": self.booking_datetime,
				"end": self.end_datetime,
			},
		)
		if conflict:
			frappe.throw(
				_("{0} already has a booking ({1}) that overlaps this time slot").format(
					self.salon_stylist, conflict[0][0]
				)
			)

	def on_update(self):
		# Fire the completion automation exactly once, the moment status
		# flips to Completed: the Sales Invoice is created and submitted
		# right away (revenue + stylist commission via events.py), and
		# consumables are issued from stock.
		if self.status == "Completed" and not self.sales_invoice:
			self.complete_booking()

	def complete_booking(self):
		if self.package_subscription:
			self.redeem_package()
		else:
			self.create_draft_invoice()

		self.create_stock_entry()

		# db_set to avoid re-triggering validate/on_update recursively
		self.db_set("sales_invoice", self.sales_invoice)
		self.db_set("stock_entry", self.stock_entry)

	def create_draft_invoice(self):
		"""Bill the booking: a SUBMITTED Sales Invoice on the branch (name
		kept for backwards compatibility). Payment is recorded from the
		invoice popup in the suite (Record Payment -> Payment Entry)."""
		from salon.salon.billing import make_sales_invoice

		stylist = frappe.get_doc("Salon Stylist", self.salon_stylist)
		cost_center = self.cost_center or stylist.cost_center

		def link_back(si):
			# Must be in the DB before submit: Sales Invoice on_submit
			# (salon/salon/events.py) finds the booking by this link to
			# book the stylist's commission.
			self.db_set("sales_invoice", si.name)

		self.sales_invoice = make_sales_invoice(
			self.customer,
			cost_center,
			[{"item_code": row.item, "qty": row.qty, "rate": row.rate} for row in self.services],
			before_submit=link_back,
		)

	def redeem_package(self):
		sub = frappe.get_doc("Package Subscription", self.package_subscription)
		if sub.status != "Active":
			frappe.throw(
				_("{0} is {1} - only Active packages can be redeemed").format(sub.name, sub.status)
			)
		if flt(sub.sessions_remaining) <= 0:
			frappe.throw(_("No sessions remaining on {0}").format(sub.name))
		sub.sessions_used = flt(sub.sessions_used) + 1
		sub.save(ignore_permissions=True)
		# No new Sales Invoice: the revenue was already recognised when the
		# package itself was sold. This booking just decrements the balance.

	def create_stock_entry(self):
		rows = []
		for row in self.services:
			if not frappe.db.exists("Salon Service Recipe", row.item):
				continue
			recipe = frappe.get_doc("Salon Service Recipe", row.item)
			for c in recipe.consumables:
				rows.append({
					"item_code": c.raw_material,
					"qty": flt(c.qty) * flt(row.qty),
					"s_warehouse": c.warehouse,
					"cost_center": self.cost_center,
				})

		if not rows:
			return

		se = frappe.new_doc("Stock Entry")
		se.stock_entry_type = "Material Issue"
		for r in rows:
			se.append("items", r)
		se.insert(ignore_permissions=True)
		se.submit()
		self.stock_entry = se.name
