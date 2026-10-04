import secrets

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I - easy to read out


def new_code():
	while True:
		raw = "".join(secrets.choice(ALPHABET) for _ in range(8))
		code = f"GC-{raw[:4]}-{raw[4:]}"
		if not frappe.db.exists("Salon Gift Card", code):
			return code


class SalonGiftCard(Document):
	def before_insert(self):
		if not self.code:
			self.code = new_code()
		if not flt(self.balance):
			self.balance = flt(self.value)

	def validate(self):
		if flt(self.value) <= 0:
			frappe.throw(_("Gift card value must be more than zero"))
		if flt(self.balance) <= 0 and self.status == "Active" and not self.is_new():
			self.status = "Fully Redeemed"
