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
];

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
				{ key: 'gl', label: 'GL Postings', href: '/app/salon-gl' },
			],
		},
		{
			title: 'Inventory — ERPNext',
			items: [{ key: 'stock', label: 'Stock & Consumables', href: '/app/salon-stock' }],
		},
		{
			title: 'HR & Payroll — ERPNext',
			items: [
				{ key: 'stylists', label: 'Stylists / Employees', href: '/app/salon-stylists' },
				{ key: 'payroll', label: 'Payroll & Commissions', href: '/app/salon-payroll' },
			],
		},
		{
			title: 'Finance — ERPNext',
			items: [{ key: 'pnl', label: 'P&L by Branch', href: '/app/salon-pnl' }],
		},
	],

	// Salon User without System Manager: locked into the salon screens.
	is_salon_only() {
		const roles = frappe.user_roles || [];
		return roles.includes('Salon User') && !roles.includes('System Manager');
	},

	render_sidebar_html(active_key) {
		const groups = this.nav_groups
			.map((group) => {
				const links = group.items
					.map((item) => {
						const cls = item.key === active_key ? 'active' : '';
						const href = typeof item.href === 'function' ? item.href() : item.href;
						return `<a class="${cls}" href="${href}">${item.label}</a>`;
					})
					.join('');
				return `
					<div class="salon-nav-group">
						<div class="salon-nav-group-title">${group.title}</div>
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

	// Link to a native document. Salon-only users never get native forms,
	// so for them it renders as plain text instead of a link.
	doc_link(route_slug, name, label) {
		const text = frappe.utils.escape_html(label == null ? name : label);
		if (!name) return text;
		if (this.is_salon_only()) return `<span>${text}</span>`;
		return `<a href="/app/${route_slug}/${encodeURIComponent(name)}">${text}</a>`;
	},

	// Shared "New Booking" dialog (Calendar + Bookings pages).
	open_quick_booking({ prefill = {}, cost_center = null, on_done = null } = {}) {
		const d = new frappe.ui.Dialog({
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
		d.$wrapper.addClass('salon-dialog');
		d.show();
		return d;
	},

	// Open a booking. System Managers keep the full native form; salon-only
	// users get a salon-styled summary dialog with the status actions they
	// actually need, so they never land on a native ERPNext form.
	open_booking(name, on_change) {
		if (!name) return;
		if (!this.is_salon_only()) {
			frappe.set_route('Form', 'Salon Booking', name);
			return;
		}
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
					.map((s) => `<li>${esc(s.item || '')}${s.qty && s.qty !== 1 ? ' × ' + s.qty : ''}</li>`)
					.join('');
				const when = b.booking_datetime ? `${frappe.datetime.str_to_user(b.booking_datetime)}` : '';
				const locked = ['Completed', 'Cancelled', 'No-Show'].includes(b.status);
				const status_class = (b.status || '').toLowerCase().replace(/\s+/g, '-');

				const d = new frappe.ui.Dialog({
					title: esc(b.name),
					fields: [{ fieldname: 'summary', fieldtype: 'HTML' }],
				});
				d.$wrapper.addClass('salon-dialog');
				d.fields_dict.summary.$wrapper.html(`
				<div class="salon-booking-summary">
					<div class="row-line"><span>${__('Client')}</span><b>${esc(b.customer || '')}</b></div>
					<div class="row-line"><span>${__('Stylist')}</span><b>${esc(stylist_name)}</b></div>
					<div class="row-line"><span>${__('When')}</span><b>${esc(when)}</b></div>
					<div class="row-line"><span>${__('Branch')}</span><b>${esc(b.cost_center || '')}</b></div>
					<div class="row-line"><span>${__('Status')}</span><span class="salon-status salon-status-${status_class}">${esc(b.status || '')}</span></div>
					<div class="row-line"><span>${__('Total')}</span><b>${format_currency(b.total_amount || 0)}</b></div>
					${services ? `<div class="services"><span>${__('Services')}</span><ul>${services}</ul></div>` : ''}
					${b.notes ? `<div class="notes">${esc(b.notes)}</div>` : ''}
					${
						locked
							? ''
							: `<div class="salon-booking-actions">
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
							done(
								m.sales_invoice
									? __('Booking completed — draft invoice {0} created', [m.sales_invoice])
									: __('Booking completed'),
							);
						});
				});
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
		document.body.classList.toggle('salon-on-pos', page === 'point-of-sale');

		if (salon_only) {
			if (SALON_USER_ALLOWED_ROUTES.includes(page)) {
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

	if (!salon_only) return;

	// Salon-only users: a click on a native document link never opens the
	// native form. Booking links open the salon booking dialog instead;
	// everything else outside the salon screens is swallowed.
	$(document).on('click', 'a[href^="/app/"]', (e) => {
		const href = e.currentTarget.getAttribute('href') || '';
		const parts = href.replace(/^\/app\//, '').split(/[/?#]/);
		const page = decodeURIComponent(parts[0] || '').toLowerCase();
		if (SALON_USER_ALLOWED_ROUTES.includes(page)) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		if (page === 'salon-booking' && parts[1]) {
			salon_common.open_booking(decodeURIComponent(parts[1]));
		}
	});

	// Way back from the native POS register (no navbar there for them).
	if (!document.querySelector('.salon-pos-back')) {
		const back = document.createElement('a');
		back.className = 'salon-pos-back';
		back.href = '/app/salon-dashboard';
		back.textContent = '← ' + __('Salon Suite');
		document.body.appendChild(back);
	}
});
