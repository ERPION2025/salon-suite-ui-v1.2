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
					<h2 style="font-size:16px; font-weight:500; margin-bottom:12px; color:#1a1a1a">Active Subscriptions</h2>
					<table class="salon-table">
						<thead><tr><th>Sub ID</th><th>Client</th><th>Package</th><th>Sessions</th><th>Expires</th></tr></thead>
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
					<h3>${frappe.utils.escape_html(p.item_name)}</h3>
					<div class="desc">${frappe.utils.escape_html(p.description || '')}</div>
					<div class="price">${format_currency(p.rate)}</div>
				</div>
			`
					)
					.join('')
			: `<p style="color:#9a9a9a; font-size:13px">No Items tagged under Item Group "Packages" yet.</p>`;

		const body = document.getElementById('salon-subs-body');
		body.innerHTML = d.subscriptions.length
			? d.subscriptions
					.map(
						(s) => `
				<tr>
					<td>${salon_common.doc_link('package-subscription', s.name)}</td>
					<td>${frappe.utils.escape_html(s.customer || '')}</td>
					<td>${frappe.utils.escape_html(s.package_item || '')}</td>
					<td>${s.sessions_remaining} of ${s.sessions_total} left</td>
					<td>${s.expiry_date ? frappe.datetime.str_to_user(s.expiry_date) : '&mdash;'}</td>
				</tr>
			`
					)
					.join('')
			: '<tr><td colspan="5">No active subscriptions.</td></tr>';
	}
}
