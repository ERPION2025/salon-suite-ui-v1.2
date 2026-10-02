frappe.pages['salon-services'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonServices(page);
};

class SalonServices {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('services')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Services Catalog</h1>
							<p>Non-stock Items used as bookable services &mdash; consumables linked via Salon Service Recipe</p>
						</div>
						<button class="salon-btn" id="salon-new-service">+ New Service</button>
					</div>
					<table class="salon-table">
						<thead><tr><th>Item Code</th><th>Service</th><th>Category</th><th>Price</th><th>Consumes stock</th></tr></thead>
						<tbody id="salon-services-body"></tbody>
					</table>
				</main>
			</div>
		`;
		document.getElementById('salon-new-service').addEventListener('click', () => frappe.new_doc('Item'));
	}

	load_data() {
		frappe.call('salon.api.get_services_data').then((r) => {
			this.render(r.message || []);
		});
	}

	render(rows) {
		const body = document.getElementById('salon-services-body');
		body.innerHTML = rows.length
			? rows
					.map(
						(s) => `
				<tr>
					<td><a href="/app/item/${s.name}">${s.name}</a></td>
					<td>${frappe.utils.escape_html(s.item_name || '')}</td>
					<td>${frappe.utils.escape_html(s.item_group || '')}</td>
					<td>${format_currency(s.rate || 0)}</td>
					<td>${s.has_recipe ? '<span class="salon-status salon-status-confirmed">Yes</span>' : '<span class="salon-status salon-status-no-show">&mdash;</span>'}</td>
				</tr>
			`
					)
					.join('')
			: '<tr><td colspan="5">No services yet.</td></tr>';
	}
}
