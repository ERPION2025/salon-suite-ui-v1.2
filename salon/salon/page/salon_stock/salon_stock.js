frappe.pages['salon-stock'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonStock(page);
};

class SalonStock {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('stock')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Stock &amp; Consumables</h1>
							<p>On-hand balances and the most recent Material Issues from completed bookings</p>
						</div>
						<button class="salon-btn" id="salon-new-entry">+ Stock Entry</button>
					</div>
					<table class="salon-table" style="margin-bottom:28px">
						<thead><tr><th>Item</th><th>Warehouse</th><th class="num">On Hand</th><th class="num">Reserved</th><th class="num">Avg Cost</th></tr></thead>
						<tbody id="salon-stock-body"></tbody>
					</table>
					<h2 class="salon-section-title">Recent Stock Entries</h2>
					<table class="salon-table">
						<thead><tr><th>Entry</th><th>Date</th><th>Linked Booking</th><th>Items</th></tr></thead>
						<tbody id="salon-entries-body"></tbody>
					</table>
				</main>
			</div>
		`;
		document.getElementById('salon-new-entry').addEventListener('click', () => frappe.new_doc('Stock Entry'));
	}

	load_data() {
		frappe.call('salon.api.get_stock_data').then((r) => {
			this.render(r.message || { stock: [], recent_entries: [] });
		});
	}

	render(d) {
		const body = document.getElementById('salon-stock-body');
		body.innerHTML = d.stock.length
			? d.stock
					.map(
						(s) => `
				<tr>
					<td class="nowrap">${salon_common.doc_link('item', s.item_code)}</td>
					<td>${frappe.utils.escape_html(s.warehouse)}</td>
					<td class="num">${s.actual_qty}</td>
					<td class="num">${s.reserved_qty}</td>
					<td class="num">${format_currency(s.valuation_rate || 0)}</td>
				</tr>
			`
					)
					.join('')
			: '<tr><td colspan="5">No stock balances found for your branch yet.</td></tr>';

		const entries = document.getElementById('salon-entries-body');
		entries.innerHTML = d.recent_entries.length
			? d.recent_entries
					.map(
						(e) => `
				<tr>
					<td>${salon_common.doc_link('stock-entry', e.name)}</td>
					<td>${frappe.datetime.str_to_user(e.posting_date)}</td>
					<td>${e.booking ? salon_common.doc_link('salon-booking', e.booking) : '&mdash;'}</td>
					<td>${frappe.utils.escape_html(e.items_label || '')}</td>
				</tr>
			`
					)
					.join('')
			: '<tr><td colspan="4">No stock entries yet.</td></tr>';
	}
}
