frappe.pages['salon-client-360'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonClient360(page);
};

class SalonClient360 {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		const preset = frappe.get_route()[1];
		if (preset) this.load_client(preset);
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('clients')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Client 360&deg;</h1>
							<p>Every visit, point, package and invoice in one view</p>
						</div>
					</div>
					<div class="salon-search">
						<input type="text" id="salon-client-search" placeholder="Search clients by name&hellip;">
					</div>
					<div class="salon-search-results" id="salon-search-results" style="display:none"></div>
					<div id="salon-client-profile"></div>
				</main>
			</div>
		`;
		const input = document.getElementById('salon-client-search');
		let debounce;
		input.addEventListener('input', () => {
			clearTimeout(debounce);
			const txt = input.value;
			debounce = setTimeout(() => this.search(txt), 250);
		});
	}

	search(txt) {
		if (!txt) {
			document.getElementById('salon-search-results').style.display = 'none';
			return;
		}
		frappe.call('salon.api.search_clients', { txt }).then((r) => {
			const results = r.message || [];
			const el = document.getElementById('salon-search-results');
			el.style.display = results.length ? 'block' : 'none';
			el.innerHTML = results
				.map(
					(c) => `<div class="salon-search-result" data-customer="${c.name}">
						${frappe.utils.escape_html(c.customer_name)}
						<span style="color:#9a9a9a">&middot; ${frappe.utils.escape_html(c.mobile_no || '')}</span>
					</div>`
				)
				.join('');
			el.querySelectorAll('.salon-search-result').forEach((row) => {
				row.addEventListener('click', () => {
					el.style.display = 'none';
					frappe.set_route('salon-client-360', row.dataset.customer);
					this.load_client(row.dataset.customer);
				});
			});
		});
	}

	load_client(customer) {
		frappe.call('salon.api.get_client_360', { customer }).then((r) => {
			this.render_profile(r.message);
		});
	}

	render_profile(d) {
		if (!d) return;
		const c = d.customer;
		const initials = (c.customer_name || '?').slice(0, 2).toUpperCase();
		const pkg = d.active_package;

		let html = `
			<div class="salon-profile-header">
				<div class="salon-avatar">${initials}</div>
				<h2>${frappe.utils.escape_html(c.customer_name)}</h2>
				<div class="salon-sub">${frappe.utils.escape_html(c.mobile_no || '')}${c.territory ? ' &middot; ' + frappe.utils.escape_html(c.territory) : ''}</div>
			</div>
			<div class="salon-stat-row">
				<div class="salon-stat-tile"><div class="v">${d.stats.visits}</div><div class="l">VISITS</div></div>
				<div class="salon-stat-tile"><div class="v">${format_currency(d.stats.ltv)}</div><div class="l">LIFETIME VALUE</div></div>
				<div class="salon-stat-tile"><div class="v">${d.stats.loyalty_points || 0}</div><div class="l">LOYALTY POINTS</div></div>
			</div>
		`;

		const p = d.preferences || {};
		const has_prefs = p.preferred_stylist_name || p.color_formula || p.allergies || p.birthday;
		if (has_prefs) {
			html += `<div class="salon-prefs">`;
			if (p.preferred_stylist_name) html += `<b>Stylist:</b> ${frappe.utils.escape_html(p.preferred_stylist_name)}<br>`;
			if (p.color_formula) html += `<b>Color formula:</b> ${frappe.utils.escape_html(p.color_formula)}<br>`;
			if (p.allergies) html += `<b>Allergies:</b> ${frappe.utils.escape_html(p.allergies)}<br>`;
			if (p.birthday) html += `<b>Birthday:</b> ${frappe.datetime.str_to_user(p.birthday)}`;
			html += `</div>`;
		}

		if (pkg) {
			const pct = Math.round((pkg.sessions_used / pkg.sessions_total) * 100);
			html += `
				<div class="salon-package-card">
					<div class="tag">Active Package</div>
					<div style="font-size:14px; font-weight:500; color:#1a1a1a; margin-top:4px">
						${frappe.utils.escape_html(pkg.package_item)} &mdash; ${pkg.sessions_remaining} of ${pkg.sessions_total} left
					</div>
					<div class="salon-package-bar"><div class="salon-package-bar-fill" style="width:${pct}%"></div></div>
				</div>
			`;
		}

		html += `<div class="salon-timeline"><h2>Visit Timeline</h2>`;
		if (!d.visits.length) {
			html += `<p style="color:#9a9a9a; font-size:13px">No completed visits yet.</p>`;
		} else {
			d.visits.forEach((v) => {
				html += `
					<div class="salon-timeline-item">
						<div class="salon-timeline-date">${frappe.datetime.str_to_user(v.booking_datetime)}</div>
						<div class="salon-timeline-content">
							<div class="t">${frappe.utils.escape_html(v.services_label || '')} &middot; ${format_currency(v.total_amount || 0)}</div>
							<div class="d">Stylist: ${frappe.utils.escape_html(v.salon_stylist_name || '')}
								${v.sales_invoice ? ' &middot; ' + salon_common.doc_link('sales-invoice', v.sales_invoice) : ''}
							</div>
						</div>
					</div>
				`;
			});
		}
		html += `</div>`;

		document.getElementById('salon-client-profile').innerHTML = html;
	}
}
