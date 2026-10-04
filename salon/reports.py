"""Salon Suite > Reports & Analytics.

All figures come from submitted ERPNext documents (Sales Invoice, Payment
Entry, Journal Entry for gift cards, Salon Booking, Additional Salary), in
company currency. Gift card SALES are excluded from revenue (they're a
liability until redeemed); the services they pay for count when billed.
"""

import frappe
from frappe.utils import add_days, flt, getdate, today

from salon.salon.permissions import require_salon_role, resolve_cost_center_filter

GIFT_ITEM = "GIFT-CARD"


def _period(period, from_date, to_date):
	t = getdate(today())
	if period == "today":
		return t, t
	if period == "7d":
		return add_days(t, -6), t
	if period == "last_month":
		first_this = t.replace(day=1)
		last_prev = add_days(first_this, -1)
		return last_prev.replace(day=1), last_prev
	if period == "custom" and from_date and to_date:
		f, e = getdate(from_date), getdate(to_date)
		return (f, e) if f <= e else (e, f)
	return t.replace(day=1), t  # this month


@frappe.whitelist()
def get_report(period="month", from_date=None, to_date=None, cost_center=None):
	require_salon_role()
	cost_center = resolve_cost_center_filter(cost_center)
	start, end = _period(period, from_date, to_date)
	v = {"start": start, "end": end, "cc": cost_center, "gift": GIFT_ITEM}
	si_cc = "and si.cost_center = %(cc)s" if cost_center else ""
	bk_cc = "and b.cost_center = %(cc)s" if cost_center else ""

	sales = frappe.db.sql(
		f"""select si.posting_date as d, si.customer, si.customer_name, si.cost_center, si.name,
			sii.item_code, sii.item_name, sii.base_net_amount as amount, sii.qty
		from `tabSales Invoice Item` sii join `tabSales Invoice` si on si.name = sii.parent
		where si.docstatus = 1 and si.is_return = 0 and si.posting_date between %(start)s and %(end)s
			and sii.item_code != %(gift)s {si_cc}""",
		v,
		as_dict=True,
	)

	revenue = sum(flt(r.amount) for r in sales)
	invoices = len({r.name for r in sales})

	def group(key, label_key=None, limit=None):
		out = {}
		for r in sales:
			k = r[key] or "—"
			if k not in out:
				out[k] = {"key": k, "label": r[label_key] if label_key else k, "amount": 0, "qty": 0}
			out[k]["amount"] += flt(r.amount)
			out[k]["qty"] += flt(r.qty)
		rows = sorted(out.values(), key=lambda x: -x["amount"])
		return rows[:limit] if limit else rows

	by_day = {}
	d = start
	while d <= end:
		by_day[str(d)] = 0
		d = add_days(d, 1)
	for r in sales:
		by_day[str(r.d)] = by_day.get(str(r.d), 0) + flt(r.amount)

	bookings = frappe.db.sql(
		f"""select b.status, b.booking_source, b.salon_stylist, b.total_amount, b.additional_salary
		from `tabSalon Booking` b
		where date(b.booking_datetime) between %(start)s and %(end)s {bk_cc}""",
		v,
		as_dict=True,
	)
	status_counts = {}
	for b in bookings:
		status_counts[b.status] = status_counts.get(b.status, 0) + 1
	online = len([b for b in bookings if b.booking_source == "Online"])
	lost = status_counts.get("No-Show", 0) + status_counts.get("Cancelled", 0)

	stylists = {}
	for b in bookings:
		if b.status != "Completed" or not b.salon_stylist:
			continue
		s = stylists.setdefault(b.salon_stylist, {"key": b.salon_stylist, "amount": 0, "qty": 0, "commission": 0})
		s["amount"] += flt(b.total_amount)
		s["qty"] += 1
		if b.additional_salary:
			s["commission"] += flt(frappe.db.get_value("Additional Salary", b.additional_salary, "amount"))
	for s in stylists.values():
		s["label"] = frappe.db.get_value("Salon Stylist", s["key"], "stylist_name") or s["key"]

	pe_cc = "and pe.cost_center = %(cc)s" if cost_center else ""
	payments = frappe.db.sql(
		f"""select coalesce(pe.mode_of_payment, 'Other') as k, sum(pe.base_received_amount) as amount
		from `tabPayment Entry` pe
		where pe.docstatus = 1 and pe.payment_type = 'Receive' and pe.party_type = 'Customer'
			and pe.posting_date between %(start)s and %(end)s {pe_cc}
		group by pe.mode_of_payment""",
		v,
		as_dict=True,
	)
	pos = frappe.db.sql(
		f"""select sip.mode_of_payment as k, sum(sip.base_amount) as amount
		from `tabSales Invoice Payment` sip join `tabSales Invoice` si on si.name = sip.parent
		where si.docstatus = 1 and si.is_pos = 1 and si.posting_date between %(start)s and %(end)s {si_cc}
		group by sip.mode_of_payment""",
		v,
		as_dict=True,
	)
	gift = 0.0
	if frappe.db.exists("DocType", "Salon Gift Card Redemption"):
		gc_cc = "and g.cost_center = %(cc)s" if cost_center else ""
		gift = flt(
			frappe.db.sql(
				f"""select coalesce(sum(r.amount), 0) from `tabSalon Gift Card Redemption` r
				join `tabSalon Gift Card` g on g.name = r.parent
				where r.posting_date between %(start)s and %(end)s {gc_cc}""",
				v,
			)[0][0]
		)
	mix = {}
	for r in payments + pos:
		mix[r.k] = mix.get(r.k, 0) + flt(r.amount)
	if gift:
		mix["Gift Card"] = mix.get("Gift Card", 0) + gift
	payment_mix = sorted(
		[{"key": k, "label": k, "amount": a} for k, a in mix.items() if a], key=lambda x: -x["amount"]
	)

	new_clients = frappe.db.count(
		"Customer", {"creation": ["between", [f"{start} 00:00:00", f"{end} 23:59:59"]]}
	)

	return {
		"start": start,
		"end": end,
		"kpis": {
			"revenue": revenue,
			"invoices": invoices,
			"avg_ticket": revenue / invoices if invoices else 0,
			"collected": sum(r["amount"] for r in payment_mix),
			"bookings": len(bookings),
			"completed": status_counts.get("Completed", 0),
			"lost": lost,
			"lost_rate": (lost / len(bookings) * 100) if bookings else 0,
			"online": online,
			"new_clients": new_clients,
		},
		"by_day": [{"key": k, "amount": a} for k, a in by_day.items()],
		"by_service": group("item_code", "item_name", limit=10),
		"by_branch": group("cost_center"),
		"top_clients": group("customer", "customer_name", limit=10),
		"by_stylist": sorted(stylists.values(), key=lambda x: -x["amount"]),
		"payment_mix": payment_mix,
		"booking_status": [{"key": k, "label": k, "amount": c} for k, c in sorted(status_counts.items(), key=lambda x: -x[1])],
	}
