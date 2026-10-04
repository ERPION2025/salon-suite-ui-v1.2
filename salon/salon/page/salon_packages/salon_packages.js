frappe.pages['salon-packages'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonPackages(page);
};

class SalonPackages {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('packages')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Service Packages</h1>
							<p>Prepaid session bundles &mdash; Items tagged under the "Packages" Item Group</p>
						</div>
						<button class="salon-btn" id="salon-new-package">+ New Package</button>
					</div>
					<div class="salon-pricing-grid" id="salon-pricing-grid"></div>
					<h2 class="salon-section-title">${__('Active Subscriptions')}</h2>
					<table class="salon-table salon-table-fit">
						<thead><tr>
							<th>${__('Sub ID')}</th><th>${__('Client')}</th><th>${__('Package')}</th><th>${__('Branch')}</th>
							<th>${__('Sessions')}</th><th>${__('Status')}</th><th>${__('Expires')}</th><th>${__('Invoice')}</th>
						</tr></thead>
						<tbody id="salon-subs-body"></tbody>
					</table>
				</main>
			</div>
		`;
		document.getElementById('salon-new-package').addEventListener('click', () => frappe.new_doc('Item'));
	}

	load_data() {
		frappe.call('salon.api.get_packages_data').then((r) => {
			this.render(r.message || { packages: [], subscriptions: [] });
		});
	}

	render(d) {
		const grid = document.getElementById('salon-pricing-grid');
		grid.innerHTML = d.packages.length
			? d.packages
					.map(
						(p) => `
				<div class="salon-pricing-card">
					<h3>${salon_common.doc_link('item', p.name, p.item_name)}</h3>
					<div class="desc">${frappe.utils.escape_html(p.description || '')}</div>
					<div class="price">${format_currency(p.rate)}</div>
				</div>
			`
					)
					.join('')
			: `<p class="salon-muted">${__('No Items tagged under Item Group "Packages" yet.')}</p>`;

		const body = document.getElementById('salon-subs-body');
		body.innerHTML = d.subscriptions.length
			? d.subscriptions
					.map(
						(s) => `
				<tr>
					<td class="nowrap">${frappe.utils.escape_html(s.name)}</td>
					<td><a href="/app/salon-client-360/${encodeURIComponent(s.customer)}">${frappe.utils.escape_html(s.customer_name || s.customer || '')}</a></td>
					<td>${salon_common.doc_link('item', s.package_item, s.package_name || s.package_item)}</td>
					<td>${frappe.utils.escape_html((s.cost_center || '').replace(/ - [^-]+$/, '') || '—')}</td>
					<td class="nowrap">${s.sessions_remaining} ${__('of')} ${s.sessions_total} ${__('left')}</td>
					<td class="nowrap">${salon_common.status_pill(s.status)}</td>
					<td class="nowrap">${s.expiry_date ? frappe.datetime.str_to_user(s.expiry_date) : '&mdash;'}</td>
					<td class="nowrap">${s.sales_invoice ? salon_common.doc_link('sales-invoice', s.sales_invoice) : '&mdash;'}</td>
				</tr>
			`
					)
					.join('')
			: `<tr><td colspan="8" class="salon-muted">${__('No active subscriptions.')}</td></tr>`;
	}
}
