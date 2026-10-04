frappe.pages['salon-loyalty'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonLoyalty(page);
};

class SalonLoyalty {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('loyalty')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Loyalty Programme</h1>
							<p>Tiers and earning rules from your Loyalty Program setup</p>
						</div>
					</div>
					<div id="salon-loyalty-body"><p class="salon-muted">Loading&hellip;</p></div>
				</main>
			</div>
		`;
	}

	load_data() {
		frappe.call('salon.api.get_loyalty_data').then((r) => {
			this.render(r.message || { programs: [] });
		});
	}

	render(d) {
		const root = document.getElementById('salon-loyalty-body');
		if (!d.programs.length) {
			root.innerHTML = `<p class="salon-muted">No Loyalty Program configured yet. Create one under Accounts &gt; Loyalty Program.</p>`;
			return;
		}

		let html = '';
		d.programs.forEach((p) => {
			html += `<h2 class="salon-section-title">${frappe.utils.escape_html(p.loyalty_program_name)}</h2>`;
			if (!p.tiers.length) {
				html += `<p class="salon-muted" style="margin-bottom:20px">No tiers defined on this program yet.</p>`;
			} else {
				html += `<div class="salon-tier-grid">`;
				p.tiers.forEach((t) => {
					html += `
						<div class="salon-tier-card">
							<h3>${frappe.utils.escape_html(t.tier_name)}</h3>
							<div class="threshold">${format_currency(t.min_spent)}+ / yr</div>
							<div class="factor">${t.collection_factor} pt per QAR 10</div>
						</div>
					`;
				});
				html += `</div>`;
			}

			html += `
				<table class="salon-table" style="margin-bottom:28px">
					<thead><tr><th>Rule</th><th>Value</th></tr></thead>
					<tbody>
						<tr><td>Conversion factor</td><td>1 point = ${format_currency(p.conversion_factor || 0)} toward services</td></tr>
						<tr><td>Expiry</td><td>${p.expiry_duration || '&mdash;'} days from earning date</td></tr>
					</tbody>
				</table>
			`;
		});

		root.innerHTML = html;
	}
}
