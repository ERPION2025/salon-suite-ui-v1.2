frappe.pages['salon-bookings'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonBookings(page);
};

class SalonBookings {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('bookings')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>All Bookings</h1>
							<p>Every booking, linked to its draft or submitted POS invoice and stock entry</p>
						</div>
						<button class="salon-btn" id="salon-new-booking">+ New Booking</button>
					</div>
					<table class="salon-table">
						<thead>
							<tr>
								<th>Booking ID</th><th>Date / Time</th><th>Branch</th><th>Client</th>
								<th>Services</th><th>Stylist</th><th>Status</th><th>Invoice</th><th>Stock</th><th>Total</th>
							</tr>
						</thead>
						<tbody id="salon-bookings-body"></tbody>
					</table>
				</main>
			</div>
		`;
		document.getElementById('salon-new-booking').addEventListener('click', () => {
			salon_common.open_quick_booking({ on_done: () => this.load_data() });
		});
	}

	load_data() {
		frappe.call('salon.api.get_all_bookings').then((r) => {
			this.render_rows(r.message || []);
		});
	}

	render_rows(rows) {
		const body = document.getElementById('salon-bookings-body');
		if (!rows.length) {
			body.innerHTML = '<tr><td colspan="10">No bookings yet.</td></tr>';
			return;
		}
		body.onclick = (e) => {
			const link = e.target.closest('.salon-booking-link');
			if (!link) return;
			e.preventDefault();
			salon_common.open_booking(link.dataset.booking, () => this.load_data());
		};
		body.innerHTML = rows
			.map((r) => {
				const status_class = (r.status || '').toLowerCase().replace(/\s+/g, '-');
				let invoice_cell = '<span class="salon-status salon-status-no-show">&mdash;</span>';
				if (r.sales_invoice && r.invoice_docstatus === 1) {
					invoice_cell = salon_common.doc_link('sales-invoice', r.sales_invoice);
				} else if (r.sales_invoice) {
					invoice_cell = salon_common.is_salon_only()
						? '<span class="salon-status">Draft (POS)</span>'
						: `<a href="/app/sales-invoice/${encodeURIComponent(r.sales_invoice)}"><span class="salon-status">Draft (POS)</span></a>`;
				}
				const stock_cell = r.stock_entry
					? salon_common.doc_link('stock-entry', r.stock_entry)
					: '<span class="salon-status salon-status-no-show">&mdash;</span>';
				return `
				<tr>
					<td><a href="#" class="salon-booking-link" data-booking="${frappe.utils.escape_html(r.name)}">${frappe.utils.escape_html(r.name)}</a></td>
					<td>${frappe.datetime.str_to_user(r.booking_datetime)} ${frappe.datetime.str_to_user(r.booking_datetime, true)}</td>
					<td>${frappe.utils.escape_html(r.cost_center || '')}</td>
					<td>${frappe.utils.escape_html(r.customer || '')}</td>
					<td>${frappe.utils.escape_html(r.services_label || '')}</td>
					<td>${frappe.utils.escape_html(r.salon_stylist_name || '')}</td>
					<td><span class="salon-status salon-status-${status_class}">${r.status}</span></td>
					<td>${invoice_cell}</td>
					<td>${stock_cell}</td>
					<td>${format_currency(r.total_amount || 0)}</td>
				</tr>`;
			})
			.join('');
	}
}
