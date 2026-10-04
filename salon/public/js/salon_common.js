// Every custom Salon Suite page (Desk Page name == route segment).
const SALON_PAGES = [
	'salon-dashboard',
	'salon-calendar',
	'salon-bookings',
	'salon-client-360',
	'salon-loyalty',
	'salon-packages',
	'salon-services',
	'salon-stylists',
	'salon-stock',
	'salon-payroll',
	'salon-gl',
	'salon-pnl',
	'salon-purchases',
	'salon-pos-profiles',
	'salon-attendance',
	'salon-leave',
];

// Screens only Salon Manager (and System Manager) may open.
const SALON_MANAGER_PAGES = ['salon-pos-profiles'];

// The only places a Salon User (without System Manager) may go. Anything
// else under /app - doctype lists/forms, reports, workspaces, settings -
// bounces back to the Salon Dashboard.
const SALON_USER_ALLOWED_ROUTES = SALON_PAGES.concat(['point-of-sale']);

window.salon_common = {
	nav_groups: [
		{
			title: 'Salon Operations',
			items: [
				{ key: 'dashboard', label: 'Dashboard', href: '/app/salon-dashboard' },
				{ key: 'calendar', label: 'Calendar', href: '/app/salon-calendar' },
				{ key: 'bookings', label: 'Bookings', href: '/app/salon-bookings' },
				{ key: 'clients', label: 'Clients (CRM)', href: '/app/salon-client-360' },
			],
		},
		{
			title: 'Programs',
			items: [
				{ key: 'loyalty', label: 'Loyalty', href: '/app/salon-loyalty' },
				{ key: 'packages', label: 'Packages', href: '/app/salon-packages' },
				{ key: 'services', label: 'Services', href: '/app/salon-services' },
			],
		},
		{
			title: 'Accounts — ERPNext',
			items: [
				{
					key: 'pos',
					label: 'POS & Invoicing',
					// Always the native POS register — never the raw Sales
					// Invoice list, for any role, for now.
					href: '/app/point-of-sale',
				},
				{
					key: 'pos-profiles',
					label: 'POS Profiles',
					href: '/app/salon-pos-profiles',
					roles: ['Salon Manager', 'System Manager'],
				},
				{ key: 'gl', label: 'GL Postings', href: '/app/salon-gl' },
			],
		},
		{
			title: 'Inventory — ERPNext',
			items: [
				{ key: 'stock', label: 'Stock & Consumables', href: '/app/salon-stock' },
				{ key: 'purchases', label: 'Purchases', href: '/app/salon-purchases' },
			],
		},
		{
			title: 'HR & Payroll — ERPNext',
			items: [
				{ key: 'stylists', label: 'Stylists / Employees', href: '/app/salon-stylists' },
				{ key: 'attendance', label: 'Attendance', href: '/app/salon-attendance' },
				{ key: 'leave', label: 'Leave', href: '/app/salon-leave' },
				{ key: 'payroll', label: 'Payroll & Commissions', href: '/app/salon-payroll' },
			],
		},
		{
			title: 'Finance — ERPNext',
			items: [{ key: 'pnl', label: 'P&L by Branch', href: '/app/salon-pnl' }],
		},
	],

	// Salon User / Salon Manager without System Manager: locked into the
	// salon screens.
	is_salon_only() {
		const roles = frappe.user_roles || [];
		const salon = roles.includes('Salon User') || roles.includes('Salon Manager');
		return salon && !roles.includes('System Manager');
	},

	is_manager() {
		const roles = frappe.user_roles || [];
		return roles.includes('Salon Manager') || roles.includes('System Manager');
	},

	can_open_page(page) {
		if (SALON_MANAGER_PAGES.includes(page)) return this.is_manager();
		return SALON_USER_ALLOWED_ROUTES.includes(page);
	},

	render_sidebar_html(active_key) {
		const groups = this.nav_groups
			.map((group) => {
				const links = group.items
					.filter((item) => !item.roles || item.roles.some((r) => (frappe.user_roles || []).includes(r)))
					.map((item) => {
						const cls = item.key === active_key ? 'active' : '';
						const href = typeof item.href === 'function' ? item.href() : item.href;
						return `<a class="${cls}" href="${href}">${item.label}</a>`;
					})
					.join('');
				if (!links) return '';
				// "Accounts — ERPNext" -> heading "Accounts" + a small "ERPNext" tag.
				const [heading, source] = group.title.split(' — ');
				return `
					<div class="salon-nav-group">
						<div class="salon-nav-group-title">${heading}${
							source ? `<span class="salon-nav-group-source">${source}</span>` : ''
						}</div>
						<nav>${links}</nav>
					</div>
				`;
			})
			.join('');

		// The native navbar (and with it the avatar/logout menu) is hidden
		// on every salon screen, so the sidebar carries the user + logout.
		const full_name = frappe.utils.escape_html(frappe.session.user_fullname || frappe.session.user);
		const initial = (full_name || '?').trim().charAt(0).toUpperCase();
		const desk_link = this.is_salon_only()
			? ''
			: `<a class="salon-user-action" href="/app">${__('Open ERPNext')}</a>`;

		return `
			<aside class="salon-sidebar">
				<div class="salon-sidebar-scroll">
					<div class="salon-brand">
						<span class="salon-brand-dot"></span>
						<span>Salon Suite</span>
					</div>
					${groups}
				</div>
				<div class="salon-user">
					<div class="salon-user-id">
						<span class="salon-user-avatar">${initial}</span>
						<span class="salon-user-name">${full_name}</span>
					</div>
					<div class="salon-user-actions">
						${desk_link}
						<a class="salon-user-action" href="#" data-salon-logout>${__('Log out')}</a>
					</div>
				</div>
			</aside>
		`;
	},

	// Documents that open in a salon popup instead of a native form.
	POPUP_DOCS: { 'sales-invoice': 'open_invoice', 'salon-booking': 'open_booking', item: 'open_item' },

	// Link to a document. Bookings, invoices and items open a salon popup for
	// everyone; any other native document is a plain link for admins and plain
	// text for salon-only users (they never get native forms).
	doc_link(route_slug, name, label) {
		const text = frappe.utils.escape_html(label == null ? name : label);
		if (!name) return text;
		if (this.POPUP_DOCS[route_slug]) {
			return `<a href="#" class="salon-doc-link" data-salon-doc="${route_slug}" data-name="${frappe.utils.escape_html(
				name,
			)}">${text}</a>`;
		}
		if (this.is_salon_only()) return `<span>${text}</span>`;
		return `<a href="/app/${route_slug}/${encodeURIComponent(name)}">${text}</a>`;
	},

	open_doc(route_slug, name, on_change) {
		const fn = this.POPUP_DOCS[route_slug];
		if (fn) this[fn](name, on_change);
	},

	// Every salon popup goes through here so they look the same.
	make_dialog(opts) {
		const d = new frappe.ui.Dialog(opts);
		d.$wrapper.addClass('salon-dialog');
		return d;
	},

	fmt_date(value) {
		return value ? frappe.datetime.str_to_user(String(value).slice(0, 10)) : '';
	},

	fmt_time(value) {
		// "2026-10-04 12:31:26" -> "12:31" (as stored, no timezone shifting)
		const t = String(value || '').split(' ')[1] || '';
		return t.slice(0, 5);
	},

	status_pill(status) {
		const cls = String(status || '')
			.toLowerCase()
			.replace(/\s+/g, '-');
		return `<span class="salon-status salon-status-${cls}">${frappe.utils.escape_html(__(status || ''))}</span>`;
	},

	// Shared "New Booking" dialog (Calendar + Bookings pages).
	open_quick_booking({ prefill = {}, cost_center = null, on_done = null } = {}) {
		const d = this.make_dialog({
			title: __('New Booking'),
			fields: [
				{ fieldname: 'customer', label: __('Client'), fieldtype: 'Link', options: 'Customer', reqd: 1 },
				{
					fieldname: 'salon_stylist',
					label: __('Stylist'),
					fieldtype: 'Link',
					options: 'Salon Stylist',
					reqd: 1,
					default: prefill.salon_stylist,
				},
				{
					fieldname: 'booking_datetime',
					label: __('Date & Time'),
					fieldtype: 'Datetime',
					reqd: 1,
					default: prefill.booking_datetime,
				},
				{ fieldname: 'item', label: __('Service'), fieldtype: 'Link', options: 'Item', reqd: 1 },
			],
			primary_action_label: __('Create'),
			primary_action: (values) => {
				frappe
					.call({
						method: 'salon.api.create_quick_booking',
						args: Object.assign({}, values, { cost_center }),
						freeze: true,
					})
					.then(() => {
						d.hide();
						frappe.show_alert({ message: __('Booking created'), indicator: 'green' });
						on_done && on_done();
					});
			},
		});
		d.show();
		return d;
	},

	// Booking popup - the same for every role; nobody lands on the native
	// Salon Booking form from the suite.
	open_booking(name, on_change) {
		if (!name) return;
		let b;
		frappe
			.call('frappe.client.get', { doctype: 'Salon Booking', name })
			.then((r) => {
				b = r.message;
				if (!b || !b.salon_stylist) return null;
				return frappe.db.get_value('Salon Stylist', b.salon_stylist, 'stylist_name');
			})
			.then((sr) => {
				if (!b) return;
				const stylist_name = (sr && sr.message && sr.message.stylist_name) || b.salon_stylist || '';
				const esc = frappe.utils.escape_html;
				const services = (b.services || [])
					.map(
						(s) =>
							`<tr><td>${esc(s.item || '')}</td><td class="num">${s.qty || 1}</td><td class="num">${format_currency(
								s.amount || 0,
							)}</td></tr>`,
					)
					.join('');
				const locked = ['Completed', 'Cancelled', 'No-Show'].includes(b.status);

				const d = this.make_dialog({
					title: __('Booking {0}', [b.name]),
					size: 'large',
					fields: [{ fieldname: 'summary', fieldtype: 'HTML' }],
				});
				d.fields_dict.summary.$wrapper.html(`
					<div class="salon-popup">
						<div class="salon-popup-grid">
							<div><span>${__('Client')}</span><b>${esc(b.customer || '')}</b></div>
							<div><span>${__('Stylist')}</span><b>${esc(stylist_name)}</b></div>
							<div><span>${__('Date')}</span><b>${this.fmt_date(b.booking_datetime)} · ${this.fmt_time(
								b.booking_datetime,
							)}</b></div>
							<div><span>${__('Branch')}</span><b>${esc(b.cost_center || '')}</b></div>
							<div><span>${__('Status')}</span><b>${this.status_pill(b.status)}</b></div>
							<div><span>${__('Invoice')}</span><b>${
								b.sales_invoice ? this.doc_link('sales-invoice', b.sales_invoice) : '—'
							}</b></div>
						</div>
						${
							services
								? `<table class="salon-table salon-popup-table">
									<thead><tr><th>${__('Service')}</th><th class="num">${__('Qty')}</th><th class="num">${__(
										'Amount',
									)}</th></tr></thead>
									<tbody>${services}</tbody>
									<tfoot><tr><td>${__('Total')}</td><td></td><td class="num">${format_currency(
										b.total_amount || 0,
									)}</td></tr></tfoot>
								</table>`
								: ''
						}
						${b.notes ? `<div class="salon-popup-notes">${esc(b.notes)}</div>` : ''}
						${
							locked
								? ''
								: `<div class="salon-popup-actions">
									${['Confirmed', 'Checked In', 'No-Show', 'Cancelled']
										.filter((s) => s !== b.status)
										.map(
											(s) => `<button class="salon-btn salon-btn-ghost" data-status="${s}">${__(s)}</button>`,
										)
										.join('')}
									<button class="salon-btn" data-complete>${__('Complete & Bill')}</button>
								</div>`
						}
					</div>
				`);

				const done = (msg) => {
					d.hide();
					frappe.show_alert({ message: msg, indicator: 'green' });
					on_change && on_change();
				};
				d.$wrapper.on('click', '[data-status]', (e) => {
					const status = e.currentTarget.dataset.status;
					frappe
						.call({
							method: 'salon.api.update_booking_status',
							args: { booking: b.name, status },
							freeze: true,
						})
						.then(() => done(__('Status updated')));
				});
				d.$wrapper.on('click', '[data-complete]', () => {
					frappe
						.call({ method: 'salon.api.complete_and_bill', args: { booking: b.name }, freeze: true })
						.then((res) => {
							const m = res.message || {};
							done(__('Booking completed'));
							// Straight into the invoice to take payment.
							if (m.sales_invoice) this.open_invoice(m.sales_invoice, on_change);
						});
				});
				d.show();
			});
	},

	// Sales Invoice popup: details, payments, and Record Payment for anything
	// still owed (creates + submits a Payment Entry).
	open_invoice(name, on_change) {
		if (!name) return;
		frappe.call('salon.salon.billing.get_invoice_details', { name }).then((r) => {
			const inv = r.message;
			if (!inv) return;
			const esc = frappe.utils.escape_html;
			const cur = inv.currency;
			const items = inv.items
				.map(
					(i) =>
						`<tr><td>${esc(i.item_name || i.item_code)}</td><td class="num">${i.qty}</td><td class="num">${format_currency(
							i.rate,
							cur,
						)}</td><td class="num">${format_currency(i.amount, cur)}</td></tr>`,
				)
				.join('');
			const payments = inv.payments.length
				? inv.payments
						.map(
							(p) =>
								`<tr><td>${this.fmt_date(p.date)}</td><td>${esc(p.mode_of_payment || '')}</td><td>${esc(
									p.reference || '',
								)}</td><td class="num">${format_currency(p.amount, cur)}</td></tr>`,
						)
						.join('')
				: `<tr><td colspan="4" class="salon-muted">${__('No payments yet')}</td></tr>`;
			const is_draft = inv.docstatus === 0;
			const owed = flt(inv.outstanding_amount);
			const status = is_draft ? 'Draft' : inv.status;

			const d = this.make_dialog({
				title: __('Invoice {0}', [inv.name]),
				size: 'large',
				fields: [{ fieldname: 'summary', fieldtype: 'HTML' }],
			});
			d.fields_dict.summary.$wrapper.html(`
				<div class="salon-popup">
					<div class="salon-popup-grid">
						<div><span>${__('Client')}</span><b>${esc(inv.customer_name || inv.customer)}</b></div>
						<div><span>${__('Date')}</span><b>${this.fmt_date(inv.posting_date)}</b></div>
						<div><span>${__('Branch')}</span><b>${esc(inv.cost_center || '')}</b></div>
						<div><span>${__('Status')}</span><b>${this.status_pill(status)}</b></div>
						${inv.booking ? `<div><span>${__('Booking')}</span><b>${this.doc_link('salon-booking', inv.booking)}</b></div>` : ''}
						${inv.subscription ? `<div><span>${__('Subscription')}</span><b>${esc(inv.subscription)}</b></div>` : ''}
					</div>
					<table class="salon-table salon-popup-table">
						<thead><tr><th>${__('Item')}</th><th class="num">${__('Qty')}</th><th class="num">${__('Rate')}</th><th class="num">${__(
							'Amount',
						)}</th></tr></thead>
						<tbody>${items}</tbody>
						<tfoot>
							${flt(inv.discount_amount) ? `<tr><td colspan="3">${__('Discount')}</td><td class="num">-${format_currency(inv.discount_amount, cur)}</td></tr>` : ''}
							${flt(inv.total_taxes_and_charges) ? `<tr><td colspan="3">${__('Taxes')}</td><td class="num">${format_currency(inv.total_taxes_and_charges, cur)}</td></tr>` : ''}
							<tr><td colspan="3">${__('Total')}</td><td class="num">${format_currency(inv.grand_total, cur)}</td></tr>
							<tr class="${owed > 0 ? 'owed' : ''}"><td colspan="3">${__('Balance due')}</td><td class="num">${format_currency(
								owed,
								cur,
							)}</td></tr>
						</tfoot>
					</table>
					<div class="salon-popup-subtitle">${__('Payments')}</div>
					<table class="salon-table salon-popup-table">
						<thead><tr><th>${__('Date')}</th><th>${__('Paid by')}</th><th>${__('Reference')}</th><th class="num">${__(
							'Amount',
						)}</th></tr></thead>
						<tbody>${payments}</tbody>
					</table>
					<div class="salon-popup-actions">
						${is_draft ? `<button class="salon-btn" data-submit>${__('Submit invoice')}</button>` : ''}
						${!is_draft && owed > 0 ? `<button class="salon-btn" data-pay>${__('Record Payment')}</button>` : ''}
					</div>
				</div>
			`);
			const reopen = () => {
				d.hide();
				on_change && on_change();
				this.open_invoice(name, on_change);
			};
			d.$wrapper.on('click', '[data-submit]', () => {
				frappe
					.call({ method: 'salon.salon.billing.submit_invoice', args: { name }, freeze: true })
					.then(() => {
						frappe.show_alert({ message: __('Invoice submitted'), indicator: 'green' });
						reopen();
					});
			});
			d.$wrapper.on('click', '[data-pay]', () => this.open_record_payment(inv, reopen));
			d.show();
		});
	},

	open_record_payment(inv, on_done) {
		const modes = inv.modes_of_payment || [];
		if (!modes.length) {
			frappe.msgprint(__('No payment methods are set up for {0}.', [inv.company]));
			return;
		}
		const bank_modes = modes.filter((m) => m.account_type === 'Bank').map((m) => m.name);
		const owed = flt(inv.outstanding_amount);
		const d = this.make_dialog({
			title: __('Record Payment — {0}', [inv.name]),
			fields: [
				{
					fieldname: 'mode_of_payment',
					label: __('Paid by'),
					fieldtype: 'Select',
					options: modes.map((m) => m.name).join('\n'),
					default: modes[0].name,
					reqd: 1,
				},
				{
					fieldname: 'amount',
					label: __('Amount received'),
					fieldtype: 'Currency',
					options: 'currency',
					default: owed,
					reqd: 1,
					description: __('Balance due: {0}', [format_currency(owed, inv.currency)]),
				},
				{
					fieldname: 'posting_date',
					label: __('Payment date'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
				{
					fieldname: 'reference_no',
					label: __('Card / transfer reference'),
					fieldtype: 'Data',
					depends_on: `eval:${JSON.stringify(bank_modes)}.includes(doc.mode_of_payment)`,
					mandatory_depends_on: `eval:${JSON.stringify(bank_modes)}.includes(doc.mode_of_payment)`,
				},
				{ fieldname: 'currency', fieldtype: 'Data', hidden: 1, default: inv.currency },
			],
			primary_action_label: __('Save Payment'),
			primary_action: (values) => {
				if (flt(values.amount) <= 0 || flt(values.amount) > owed + 0.005) {
					frappe.msgprint(__('Amount must be between 0 and {0}', [format_currency(owed, inv.currency)]));
					return;
				}
				frappe
					.call({
						method: 'salon.salon.billing.record_payment',
						args: {
							invoice: inv.name,
							mode_of_payment: values.mode_of_payment,
							amount: values.amount,
							posting_date: values.posting_date,
							reference_no: values.reference_no,
						},
						freeze: true,
					})
					.then((r) => {
						d.hide();
						frappe.show_alert({
							message: __('Payment {0} recorded', [(r.message || {}).payment_entry || '']),
							indicator: 'green',
						});
						on_done && on_done();
					});
			},
		});
		d.show();
	},

	// Item popup (Services / Packages / Stock): read-only master details.
	open_item(item_code) {
		if (!item_code) return;
		frappe.call('salon.api.get_item_details', { item_code }).then((r) => {
			const it = r.message;
			if (!it) return;
			const esc = frappe.utils.escape_html;
			const yes = (v) => (v ? __('Yes') : __('No'));
			const prices = it.prices.length
				? it.prices
						.map(
							(p) =>
								`<tr><td>${esc(p.price_list)}</td><td>${p.selling ? __('Selling') : __('Buying')}</td><td class="num">${format_currency(
									p.price_list_rate,
									p.currency,
								)}</td></tr>`,
						)
						.join('')
				: `<tr><td colspan="3" class="salon-muted">${__('No prices set')}</td></tr>`;
			const recipe = it.recipe.length
				? `<div class="salon-popup-subtitle">${__('Consumables used per service')}</div>
					<table class="salon-table salon-popup-table">
						<thead><tr><th>${__('Item')}</th><th>${__('From')}</th><th class="num">${__('Qty')}</th></tr></thead>
						<tbody>${it.recipe
							.map(
								(c) =>
									`<tr><td>${esc(c.item_name)}</td><td>${esc(c.warehouse || '')}</td><td class="num">${c.qty}</td></tr>`,
							)
							.join('')}</tbody>
					</table>`
				: '';
			const stock = it.is_stock_item
				? `<div class="salon-popup-subtitle">${__('Stock on hand')}</div>
					<table class="salon-table salon-popup-table">
						<thead><tr><th>${__('Store room')}</th><th class="num">${__('On hand')}</th><th class="num">${__(
							'Avg cost',
						)}</th></tr></thead>
						<tbody>${
							it.stock.length
								? it.stock
										.map(
											(b) =>
												`<tr><td>${esc(b.warehouse)}</td><td class="num">${b.actual_qty}</td><td class="num">${format_currency(
													b.valuation_rate || 0,
												)}</td></tr>`,
										)
										.join('')
								: `<tr><td colspan="3" class="salon-muted">${__('No stock')}</td></tr>`
						}</tbody>
					</table>`
				: '';
			const d = this.make_dialog({
				title: esc(it.item_name || it.item_code),
				size: 'large',
				fields: [{ fieldname: 'summary', fieldtype: 'HTML' }],
			});
			d.fields_dict.summary.$wrapper.html(`
				<div class="salon-popup">
					<div class="salon-popup-grid">
						<div><span>${__('Item code')}</span><b>${esc(it.item_code)}</b></div>
						<div><span>${__('Group')}</span><b>${esc(it.item_group || '')}</b></div>
						<div><span>${__('Unit')}</span><b>${esc(it.stock_uom || '')}</b></div>
						<div><span>${__('Status')}</span><b>${this.status_pill(it.disabled ? 'Disabled' : 'Active')}</b></div>
						<div><span>${__('Stock item')}</span><b>${yes(it.is_stock_item)}</b></div>
						<div><span>${__('Sold / Bought')}</span><b>${yes(it.is_sales_item)} / ${yes(it.is_purchase_item)}</b></div>
						${it.brand ? `<div><span>${__('Brand')}</span><b>${esc(it.brand)}</b></div>` : ''}
						${
							it.package_sessions
								? `<div><span>${__('Package')}</span><b>${__('{0} sessions', [it.package_sessions])}${
										it.package_validity_days ? ' · ' + __('{0} days', [it.package_validity_days]) : ''
									}</b></div>`
								: ''
						}
					</div>
					${it.description ? `<div class="salon-popup-notes">${frappe.utils.html2text ? esc(frappe.utils.html2text(it.description)) : esc(it.description)}</div>` : ''}
					<div class="salon-popup-subtitle">${__('Prices')}</div>
					<table class="salon-table salon-popup-table">
						<thead><tr><th>${__('Price list')}</th><th>${__('Type')}</th><th class="num">${__('Rate')}</th></tr></thead>
						<tbody>${prices}</tbody>
					</table>
					${recipe}
					${stock}
				</div>
			`);
			d.show();
		});
	},
};

// ---------------------------------------------------------------------------
// Full-screen salon shell + Salon User lock-down
//
// NOTE: this used to be wrapped in frappe.ready(), which only exists on
// website pages - on Desk (/app) it is undefined, so the call threw and the
// full-chrome class was never applied for anyone. Desk boots in
// $(document).ready (frappe.Application), and our app_include_js runs after
// it, so frappe.user_roles / frappe.router are available here.
// ---------------------------------------------------------------------------
$(() => {
	if (!window.frappe || !frappe.router || !frappe.session || frappe.session.user === 'Guest') return;

	const salon_only = salon_common.is_salon_only();
	// Salon-only users: native navbar/sidebars hidden on EVERY Desk page.
	document.body.classList.toggle('salon-locked', salon_only);

	const current_page = () => {
		const route = frappe.get_route() || [];
		return (route[0] || '').toLowerCase();
	};

	const on_route = () => {
		const page = current_page();
		const is_salon_page = SALON_PAGES.includes(page);
		// Any user on a salon screen: full-screen shell, no Desk chrome.
		document.body.classList.toggle('salon-page', is_salon_page);
		// POS register: salon red/white theme for everyone (salon.css).
		document.body.classList.toggle('salon-on-pos', page === 'point-of-sale');

		if (salon_only) {
			if (salon_common.can_open_page(page)) {
				document.body.classList.add('salon-route-ok');
			} else {
				document.body.classList.remove('salon-route-ok');
				frappe.set_route('salon-dashboard');
			}
		}
	};

	frappe.router.on('change', on_route);
	on_route();

	// Sidebar logout (the native avatar menu is hidden on salon screens).
	$(document).on('click', '[data-salon-logout]', (e) => {
		e.preventDefault();
		frappe.app.logout();
	});

	// Link clicks are handled in the CAPTURE phase: Frappe's router binds
	// its own "a" click handler on <body>, which would otherwise route to
	// the native form before a bubbling handler here ever ran.
	document.addEventListener(
		'click',
		(e) => {
			if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
			const target = e.target instanceof Element ? e.target : null;
			if (!target) return;

			// Salon popups for bookings / invoices / items - for every role.
			const doc_el = target.closest('[data-salon-doc]');
			if (doc_el) {
				e.preventDefault();
				e.stopPropagation();
				salon_common.open_doc(doc_el.dataset.salonDoc, doc_el.dataset.name);
				return;
			}

			const a = target.closest('a[href^="/app/"]');
			if (!a) return;
			const parts = (a.getAttribute('href') || '').replace(/^\/app\//, '').split(/[/?#]/);
			const slug = decodeURIComponent(parts[0] || '').toLowerCase();
			const in_salon_ui = !!a.closest('.salon-shell, .salon-dialog');

			// Raw /app links to popup doctypes inside salon screens/popups (and
			// anywhere for salon-only users) open the popup, not the form.
			if (salon_common.POPUP_DOCS[slug] && parts[1] && (in_salon_ui || salon_only)) {
				e.preventDefault();
				e.stopPropagation();
				salon_common.open_doc(slug, decodeURIComponent(parts[1]));
				return;
			}

			// Salon-only users never open any other native screen.
			if (salon_only && !salon_common.can_open_page(slug)) {
				e.preventDefault();
				e.stopPropagation();
			}
		},
		true,
	);

	// Way back from the native POS register to the suite (the navbar is
	// hidden there for everyone).
	if (!document.querySelector('.salon-pos-back')) {
		const back = document.createElement('a');
		back.className = 'salon-pos-back';
		back.href = '/app/salon-dashboard';
		back.textContent = '← ' + __('Salon Suite');
		document.body.appendChild(back);
	}
});
