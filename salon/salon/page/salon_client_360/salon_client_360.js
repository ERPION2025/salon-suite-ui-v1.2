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
					</div>`,
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
		this.customer = customer;
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
				<div class="salon-profile-buttons">
					<button class="salon-btn salon-profile-action" id="salon-add-subscription">+ ${__('Add Subscription')}</button>
					${c.mobile_no ? `<button class="salon-btn salon-btn-ghost salon-profile-action" id="salon-client-whatsapp">${__('WhatsApp')}</button>` : ''}
				</div>
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
			if (p.preferred_stylist_name)
				html += `<b>Stylist:</b> ${frappe.utils.escape_html(p.preferred_stylist_name)}<br>`;
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
					<div class="salon-package-card-title">
						${frappe.utils.escape_html(pkg.package_item)} &mdash; ${pkg.sessions_remaining} of ${pkg.sessions_total} left
					</div>
					<div class="salon-package-bar"><div class="salon-package-bar-fill" style="width:${pct}%"></div></div>
				</div>
			`;
		}

		html += this.render_subscriptions(d.subscriptions || []);

		html += `<div class="salon-timeline"><h2>Visit Timeline</h2>`;
		if (!d.visits.length) {
			html += `<p class="salon-muted">No completed visits yet.</p>`;
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
		document
			.getElementById('salon-add-subscription')
			.addEventListener('click', () => this.open_add_subscription(c.name, c.customer_name));
		const wa = document.getElementById('salon-client-whatsapp');
		if (wa) wa.addEventListener('click', () => salon_common.open_whatsapp({ customer: c.name }));
	}

	render_subscriptions(subs) {
		const esc = frappe.utils.escape_html;
		const status_cls = {
			Active: 'salon-status-confirmed',
			'Pending Payment': 'salon-status-checked-in',
			Completed: 'salon-status-completed',
			Expired: 'salon-status-no-show',
		};
		const rows = subs.length
			? subs
					.map(
						(s) => `
				<tr>
					<td>${esc(s.name)}</td>
					<td>${esc(s.package_name || s.package_item || '')}</td>
					<td>${esc(s.cost_center || '—')}</td>
					<td>${s.sessions_remaining} ${__('of')} ${s.sessions_total} ${__('left')}</td>
					<td><span class="salon-status ${status_cls[s.status] || ''}">${esc(__(s.status || ''))}</span></td>
					<td>${s.start_date ? frappe.datetime.str_to_user(s.start_date) : '&mdash;'}</td>
					<td>${s.expiry_date ? frappe.datetime.str_to_user(s.expiry_date) : '&mdash;'}</td>
					<td>${s.sales_invoice ? salon_common.doc_link('sales-invoice', s.sales_invoice) : '&mdash;'}</td>
				</tr>`,
					)
					.join('')
			: `<tr><td colspan="8">${__('No subscriptions yet.')}</td></tr>`;
		return `
			<div class="salon-client-subs">
				<h2>${__('Subscriptions')}</h2>
				<table class="salon-table">
					<thead><tr>
						<th>${__('Sub ID')}</th><th>${__('Package')}</th><th>${__('Branch')}</th><th>${__('Sessions')}</th>
						<th>${__('Status')}</th><th>${__('Started')}</th><th>${__('Expires')}</th><th>${__('Invoice')}</th>
					</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>`;
	}

	// Sell a package to this client: a draft POS invoice goes to the
	// branch register; the subscription turns Active once it's paid there.
	open_add_subscription(customer, customer_name) {
		frappe.call('salon.api.get_subscription_options').then((r) => {
			const opts = r.message || { packages: [], branches: [] };
			if (!opts.packages.length) {
				frappe.msgprint(__('No packages yet. Add Items under the "Packages" Item Group first.'));
				return;
			}
			if (!opts.branches.length) {
				frappe.msgprint(__('You are not assigned to a branch yet.'));
				return;
			}
			const by_code = {};
			opts.packages.forEach((p) => (by_code[p.name] = p));
			const pkg_options = opts.packages.map((p) => ({
				value: p.name,
				label: `${p.item_name} — ${format_currency(p.rate)}`,
			}));
			const first = opts.packages[0];

			let d = null;
			const update_summary = () => {
				if (!d) return;
				const p = by_code[d.get_value('package_item')] || first;
				if (!d.get_value('sessions_total') && p.custom_package_sessions) {
					d.set_value('sessions_total', p.custom_package_sessions);
				}
				d.fields_dict.summary.$wrapper.html(`
					<div class="salon-sub-summary">
						<div><span>${__('Client')}</span><b>${frappe.utils.escape_html(customer_name)}</b></div>
						<div><span>${__('Price')}</span><b>${format_currency(p.rate)}</b></div>
						<div><span>${__('Validity')}</span><b>${
							p.custom_package_validity_days
								? __('{0} days from payment', [p.custom_package_validity_days])
								: __('No expiry')
						}</b></div>
						<p>${__('An invoice is created and the package becomes Active straight away. Record the payment from the invoice.')}</p>
					</div>`);
			};
			d = new frappe.ui.Dialog({
				title: __('Add Subscription'),
				fields: [
					{
						fieldname: 'package_item',
						label: __('Package'),
						fieldtype: 'Select',
						options: pkg_options,
						default: first.name,
						reqd: 1,
						onchange: () => {
							if (!d) return;
							const p = by_code[d.get_value('package_item')];
							d.set_value('sessions_total', (p && p.custom_package_sessions) || 0);
							update_summary();
						},
					},
					{
						fieldname: 'sessions_total',
						label: __('Sessions included'),
						fieldtype: 'Int',
						default: first.custom_package_sessions || 0,
						reqd: 1,
					},
					{
						fieldname: 'cost_center',
						label: __('Sold at branch'),
						fieldtype: 'Select',
						options: opts.branches.map((b) => b.name).join('\n'),
						default: opts.branches[0].name,
						reqd: 1,
						read_only: opts.is_admin ? 0 : 1,
					},
					{ fieldname: 'summary', fieldtype: 'HTML' },
				],
				primary_action_label: __('Create & Bill'),
				primary_action: (values) => {
					frappe
						.call({
							method: 'salon.api.create_subscription',
							args: {
								customer,
								package_item: values.package_item,
								sessions_total: values.sessions_total,
								cost_center: values.cost_center,
							},
							freeze: true,
						})
						.then((res) => {
							d.hide();
							this.load_client(customer);
							const m = res.message || {};
							const done = new frappe.ui.Dialog({
								title: __('Subscription created'),
								fields: [
									{
										fieldname: 'msg',
										fieldtype: 'HTML',
										options: `<p>${__(
											'Subscription {0} is {1}. Invoice {2} has been created — record the payment now or later from the invoice.',
											[m.subscription, m.status, m.sales_invoice],
										)}</p>`,
									},
								],
								primary_action_label: __('Record payment now'),
								primary_action: () => {
									done.hide();
									salon_common.open_invoice(m.sales_invoice, () => this.load_client(customer));
								},
								secondary_action_label: __('Later'),
								secondary_action: () => done.hide(),
							});
							done.$wrapper.addClass('salon-dialog');
							done.show();
						});
				},
			});
			d.$wrapper.addClass('salon-dialog');
			d.show();
			update_summary();
		});
	}
}
