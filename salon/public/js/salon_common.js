// Module icons (flat, two-tone, salon red palette) for the app grid,
// module top bar and menu drawer. 48x48 viewBox, scaled by CSS.
const SALON_ICONS = {
	dashboard:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="6" width="16" height="16" rx="4" fill="#e4002b"/><rect x="26" y="6" width="16" height="16" rx="8" fill="#f7a6b6"/><rect x="6" y="26" width="16" height="16" rx="4" fill="#f7a6b6"/><rect x="26" y="26" width="16" height="16" rx="4" fill="#8c001a"/></svg>',
	calendar:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="32" rx="5" fill="#f7a6b6"/><path d="M6 15a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v5H6z" fill="#e4002b"/><rect x="14" y="5" width="4" height="10" rx="2" fill="#2b2b2b"/><rect x="30" y="5" width="4" height="10" rx="2" fill="#2b2b2b"/><rect x="12" y="25" width="7" height="6" rx="1.5" fill="#8c001a"/><rect x="21" y="25" width="7" height="6" rx="1.5" fill="#ffffff"/><rect x="30" y="25" width="7" height="6" rx="1.5" fill="#ffffff"/><rect x="12" y="33" width="7" height="5" rx="1.5" fill="#ffffff"/><rect x="21" y="33" width="7" height="5" rx="1.5" fill="#ffffff"/></svg>',
	bookings:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="8" width="30" height="34" rx="4" fill="#f7a6b6"/><rect x="17" y="5" width="14" height="7" rx="3" fill="#e4002b"/><rect x="14" y="18" width="20" height="3" rx="1.5" fill="#8c001a"/><rect x="14" y="25" width="20" height="3" rx="1.5" fill="#ffffff"/><rect x="14" y="32" width="13" height="3" rx="1.5" fill="#ffffff"/><circle cx="35" cy="36" r="7" fill="#e4002b"/><path d="M32 36l2 2 4-4" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	clients:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="18" cy="16" r="7" fill="#e4002b"/><path d="M5 40c0-8 6-13 13-13s13 5 13 13z" fill="#e4002b"/><circle cx="32" cy="18" r="6" fill="#8c001a"/><path d="M24 40c0-7 4-11 9-11s10 4 10 11z" fill="#f7a6b6"/></svg>',
	loyalty:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L24 33.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill="#e4002b"/><path d="M24 14l3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1z" fill="#f7a6b6"/></svg>',
	packages:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l17 9v20l-17 9-17-9V14z" fill="#f7a6b6"/><path d="M24 23v20l-17-9V14z" fill="#e4002b"/><path d="M24 23l17-9v20l-17 9z" fill="#8c001a"/><path d="M15.5 9.5l17 9" stroke="#ffffff" stroke-width="3"/></svg>',
	services:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="13" cy="35" r="6" fill="none" stroke="#e4002b" stroke-width="4"/><circle cx="35" cy="35" r="6" fill="none" stroke="#8c001a" stroke-width="4"/><path d="M17 31L36 6" stroke="#e4002b" stroke-width="4" stroke-linecap="round"/><path d="M31 31L12 6" stroke="#8c001a" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="22" r="2.5" fill="#2b2b2b"/></svg>',
	'gift-cards':
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="12" width="38" height="26" rx="5" fill="#f7a6b6"/><rect x="16" y="12" width="6" height="26" fill="#e4002b"/><rect x="5" y="22" width="38" height="5" fill="#e4002b"/><path d="M19 12c-5-6-11-1-6 3zM19 12c5-6 11-1 6 3z" fill="#8c001a"/></svg>',
	pos: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 5h28v36l-4.7-3-4.6 3-4.7-3-4.6 3-4.7-3L10 41z" fill="#f7a6b6"/><rect x="15" y="12" width="18" height="3" rx="1.5" fill="#8c001a"/><rect x="15" y="19" width="12" height="3" rx="1.5" fill="#ffffff"/><rect x="15" y="26" width="18" height="5" rx="2" fill="#e4002b"/></svg>',
	'pos-profiles':
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="7" width="34" height="22" rx="4" fill="#2b2b2b"/><rect x="11" y="11" width="26" height="14" rx="2" fill="#f7a6b6"/><path d="M17 29h14l3 7H14z" fill="#8c001a"/><rect x="8" y="36" width="32" height="6" rx="3" fill="#e4002b"/></svg>',
	gl: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="6" width="30" height="36" rx="4" fill="#e4002b"/><rect x="13" y="6" width="25" height="36" rx="3" fill="#f7a6b6"/><rect x="18" y="14" width="15" height="3" rx="1.5" fill="#8c001a"/><rect x="18" y="21" width="15" height="3" rx="1.5" fill="#ffffff"/><rect x="18" y="28" width="10" height="3" rx="1.5" fill="#ffffff"/></svg>',
	stock:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="24" width="17" height="17" rx="3" fill="#e4002b"/><rect x="25" y="24" width="17" height="17" rx="3" fill="#8c001a"/><rect x="15" y="7" width="17" height="17" rx="3" fill="#f7a6b6"/><rect x="12" y="24" width="5" height="5" fill="#ffffff" opacity=".6"/><rect x="31" y="24" width="5" height="5" fill="#ffffff" opacity=".5"/><rect x="21" y="7" width="5" height="5" fill="#ffffff" opacity=".7"/></svg>',
	purchases:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 16h30l-2.5 24a3 3 0 0 1-3 2.7H14.5a3 3 0 0 1-3-2.7z" fill="#f7a6b6"/><path d="M17 20v-6a7 7 0 0 1 14 0v6" stroke="#e4002b" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="9" y="16" width="30" height="6" rx="2" fill="#8c001a" opacity=".85"/></svg>',
	stylists:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="22" cy="15" r="9" fill="#e4002b"/><path d="M6 42c0-9 7-15 16-15s16 6 16 15z" fill="#f7a6b6"/><rect x="31" y="5" width="12" height="18" rx="3" fill="#8c001a"/><rect x="34" y="9" width="2" height="10" fill="#ffffff"/><rect x="38" y="9" width="2" height="10" fill="#ffffff"/></svg>',
	attendance:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="22" cy="24" r="17" fill="#f7a6b6"/><path d="M22 13v12l8 5" stroke="#8c001a" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="36" r="8" fill="#e4002b"/><path d="M32.5 36l2.5 2.5 4-4.5" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	leave:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 22a19 17 0 0 1 38 0z" fill="#e4002b"/><path d="M5 22a19 17 0 0 1 19-17c-6 4-8 10-8 17z" fill="#f7a6b6"/><path d="M24 22v14a4 4 0 0 1-8 0" stroke="#2b2b2b" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M24 22c0-7-2-13-0-17 2 4 0 10 0 17z" fill="#8c001a"/></svg>',
	payroll:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="12" width="34" height="22" rx="4" fill="#f7a6b6"/><circle cx="21" cy="23" r="5.5" fill="#8c001a"/><circle cx="35" cy="34" r="9" fill="#e4002b"/><path d="M35 29v10M32 31.5h4.5a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5H38" stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
	pnl: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="26" width="8" height="15" rx="2" fill="#f7a6b6"/><rect x="20" y="17" width="8" height="24" rx="2" fill="#8c001a"/><rect x="33" y="8" width="8" height="33" rx="2" fill="#e4002b"/><path d="M8 18l11-8 9 5 12-9" stroke="#2b2b2b" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	reports:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="#f7a6b6"/><path d="M24 24V6a18 18 0 0 1 17.1 23.6z" fill="#e4002b"/><path d="M24 24l17.1 5.6A18 18 0 0 1 30 41z" fill="#8c001a"/><circle cx="24" cy="24" r="7" fill="#ffffff"/></svg>',
	online:
		'<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="12" y="4" width="24" height="40" rx="5" fill="#2b2b2b"/><rect x="15" y="9" width="18" height="28" rx="2" fill="#f7a6b6"/><circle cx="24" cy="23" r="7" fill="#e4002b"/><path d="M21 23l2.2 2.2L27.5 21" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="21" y="39.5" width="6" height="2" rx="1" fill="#ffffff"/></svg>',
};

// Every custom Salon Suite page (Desk Page name == route segment).
const SALON_PAGES = [
	'salon-home',
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
	'salon-gift-cards',
	'salon-reports',
];

// Screens only Salon Manager (and System Manager) may open.
const SALON_MANAGER_PAGES = ['salon-pos-profiles'];

// The only places a Salon User (without System Manager) may go. Anything
// else under /app - doctype lists/forms, reports, workspaces, settings -
// bounces back to the Salon Suite home (module grid).
const SALON_USER_ALLOWED_ROUTES = SALON_PAGES.concat(['point-of-sale']);

window.salon_common = {
	nav_groups: [
		{
			title: 'Salon Operations',
			items: [
				{ key: 'dashboard', label: 'Dashboard', href: '/app/salon-dashboard' },
				{ key: 'calendar', label: 'Calendar', href: '/app/salon-calendar' },
				{ key: 'bookings', label: 'Bookings', href: '/app/salon-bookings' },
				{ key: 'clients', label: 'Clients (CRM)', tile: 'Clients', href: '/app/salon-client-360' },
				{ key: 'online', label: 'Online Booking', href: '/book', external: true },
			],
		},
		{
			title: 'Programs',
			items: [
				{ key: 'loyalty', label: 'Loyalty', href: '/app/salon-loyalty' },
				{ key: 'packages', label: 'Packages', href: '/app/salon-packages' },
				{ key: 'services', label: 'Services', href: '/app/salon-services' },
				{ key: 'gift-cards', label: 'Gift Cards', href: '/app/salon-gift-cards' },
			],
		},
		{
			title: 'Accounts — ERPNext',
			items: [
				{
					key: 'pos',
					label: 'POS & Invoicing',
					tile: 'POS & Billing',
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
				{ key: 'stock', label: 'Stock & Consumables', tile: 'Stock', href: '/app/salon-stock' },
				{ key: 'purchases', label: 'Purchases', href: '/app/salon-purchases' },
			],
		},
		{
			title: 'HR & Payroll — ERPNext',
			items: [
				{ key: 'stylists', label: 'Stylists / Employees', tile: 'Stylists', href: '/app/salon-stylists' },
				{ key: 'attendance', label: 'Attendance', href: '/app/salon-attendance' },
				{ key: 'leave', label: 'Leave', href: '/app/salon-leave' },
				{ key: 'payroll', label: 'Payroll & Commissions', tile: 'Payroll', href: '/app/salon-payroll' },
			],
		},
		{
			title: 'Finance — ERPNext',
			items: [
				{ key: 'pnl', label: 'P&L by Branch', href: '/app/salon-pnl' },
				{ key: 'reports', label: 'Reports & Analytics', tile: 'Reports', href: '/app/salon-reports' },
			],
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

	// Order of tiles on the home grid (keys of nav items).
	TILE_ORDER: [
		'dashboard',
		'calendar',
		'bookings',
		'clients',
		'online',
		'services',
		'packages',
		'loyalty',
		'gift-cards',
		'pos',
		'pos-profiles',
		'gl',
		'stock',
		'purchases',
		'stylists',
		'attendance',
		'leave',
		'payroll',
		'pnl',
		'reports',
	],

	icon(key) {
		return SALON_ICONS[key] || SALON_ICONS.dashboard;
	},

	allowed(item) {
		return !item.roles || item.roles.some((r) => (frappe.user_roles || []).includes(r));
	},

	all_items() {
		return [].concat(...this.nav_groups.map((g) => g.items)).filter((i) => this.allowed(i));
	},

	// Modules the current user can open, in grid order.
	tiles() {
		const items = this.all_items();
		return this.TILE_ORDER.map((k) => items.find((i) => i.key === k)).filter(Boolean);
	},

	link_attrs(item) {
		const href = typeof item.href === 'function' ? item.href() : item.href;
		return item.external ? `href="${href}" target="_blank" rel="noopener"` : `href="${href}"`;
	},

	initials() {
		const n = (frappe.session.user_fullname || frappe.session.user || '?').trim();
		return n.charAt(0).toUpperCase();
	},

	// Avatar button + dropdown (name, branch, Open ERPNext, Log out). Shared
	// by the home grid and the module top bar.
	render_user_menu() {
		const esc = frappe.utils.escape_html;
		const name = esc(frappe.session.user_fullname || frappe.session.user);
		return `
			<span class="salon-top-branch" title="${__('Branch')}"></span>
			<div class="salon-usermenu">
				<button class="salon-avatar-btn" data-salon-avatar aria-haspopup="true" title="${name}">${this.initials()}</button>
				<div class="salon-usermenu-pop" role="menu">
					<div class="salon-usermenu-head"><b>${name}</b><span class="salon-top-branch-text"></span></div>
					<a href="/app/salon-home">${__('All modules')}</a>
					${this.is_salon_only() ? '' : `<a href="/app">${__('Open ERPNext')}</a>`}
					<a href="#" data-salon-logout>${__('Log out')}</a>
				</div>
			</div>`;
	},

	// Kept under its old name so every page keeps calling it: renders the
	// module top bar (grid button, Menu button, module name) plus the menu
	// drawer - the old sidebar, now collapsed behind the Menu button.
	render_sidebar_html(active_key) {
		const esc = frappe.utils.escape_html;
		const groups = this.nav_groups
			.map((group) => {
				const links = group.items
					.filter((item) => this.allowed(item))
					.map((item) => {
						const cls = item.key === active_key ? 'active' : '';
						return `<a class="${cls}" ${this.link_attrs(item)}><span class="salon-nav-ico">${this.icon(
							item.key,
						)}</span>${item.label}${item.external ? ' <span class="salon-ext">↗</span>' : ''}</a>`;
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

		const current = this.all_items().find((i) => i.key === active_key);
		const title = current ? current.tile || current.label : __('Salon Suite');
		this.fill_branch_soon();

		return `
			<header class="salon-topbar">
				<a class="salon-icon-btn" href="/app/salon-home" title="${__('All modules')}" aria-label="${__('All modules')}">
					<svg width="16" height="16" viewBox="0 0 16 16"><g fill="currentColor">${[0, 6, 12]
						.map((x) =>
							[0, 6, 12].map((y) => `<rect x="${x}" y="${y}" width="4" height="4" rx="1"/>`).join(''),
						)
						.join('')}</g></svg>
				</a>
				<button class="salon-menu-btn" data-salon-menu aria-label="${__('Menu')}">
					<svg width="16" height="16" viewBox="0 0 16 16"><g fill="currentColor"><rect y="2" width="16" height="2" rx="1"/><rect y="7" width="16" height="2" rx="1"/><rect y="12" width="16" height="2" rx="1"/></g></svg>
					<span>${__('Menu')}</span>
				</button>
				<div class="salon-crumb">
					<span class="salon-crumb-ico">${this.icon(active_key)}</span>
					<span class="salon-crumb-title">${esc(title)}</span>
				</div>
				<div class="salon-topbar-right">${this.render_user_menu()}</div>
			</header>
			<div class="salon-scrim" data-salon-menu-close></div>
			<aside class="salon-sidebar salon-drawer" aria-label="${__('Menu')}">
				<div class="salon-sidebar-scroll">
					<div class="salon-brand">
						<span class="salon-brand-dot"></span>
						<span>Salon Suite</span>
						<button class="salon-drawer-close" data-salon-menu-close aria-label="${__('Close menu')}">×</button>
					</div>
					${groups}
				</div>
			</aside>
		`;
	},

	// Branch chip text (same for every screen) - fetched once, then filled
	// into whatever top bar is on screen.
	fill_branch_soon() {
		setTimeout(() => {
			const apply = (label) => {
				document.querySelectorAll('.salon-top-branch, .salon-top-branch-text').forEach((el) => {
					el.textContent = label || '';
					el.style.display = label ? '' : 'none';
				});
			};
			if (this._branch_label !== undefined) return apply(this._branch_label);
			if (!this._branch_promise) {
				this._branch_promise = frappe.call('salon.api.get_branch_options').then((r) => {
					const d = r.message || { branches: [] };
					this._branch_label = d.is_admin
						? __('All branches')
						: ((d.branches[0] && d.branches[0].name) || '').replace(/ - [^-]+$/, '');
				});
			}
			this._branch_promise.then(() => apply(this._branch_label));
		}, 0);
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
						<div class="salon-popup-actions salon-popup-engage">
							${b.booking_source ? `<span class="salon-muted">${__('Source')}: ${esc(__(b.booking_source))}</span>` : ''}
							${b.reminder_sent ? `<span class="salon-muted">· ${__('Reminder sent')}</span>` : ''}
							<button class="salon-btn salon-btn-ghost" data-whatsapp>${__('WhatsApp')}</button>
							${
								['Tentative', 'Confirmed'].includes(b.status)
									? `<button class="salon-btn salon-btn-ghost" data-remind>${__('Send reminder')}</button>`
									: ''
							}
						</div>
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
				d.$wrapper.on('click', '[data-whatsapp]', () => this.open_whatsapp({ booking: b.name }));
				d.$wrapper.on('click', '[data-remind]', () => {
					frappe
						.call({ method: 'salon.notifications.send_reminder', args: { booking: b.name }, freeze: true })
						.then((r) =>
							frappe.show_alert({
								message: __('Reminder sent by {0}', [(r.message || []).join(' & ')]),
								indicator: 'green',
							}),
						);
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

	// WhatsApp click-to-chat with a ready message (booking reminder, or a
	// plain hello for a client).
	open_whatsapp(args) {
		frappe.call('salon.notifications.get_whatsapp_link', args).then((r) => {
			if (r.message) window.open(r.message, '_blank', 'noopener');
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
		const GIFT = 'Gift Card';
		const modes = (inv.modes_of_payment || []).concat([{ name: GIFT, account_type: 'Gift' }]);
		const bank_modes = modes.filter((m) => m.account_type === 'Bank').map((m) => m.name);
		const owed = flt(inv.outstanding_amount);
		const is_gift = `eval:doc.mode_of_payment=='${GIFT}'`;
		let d = null;
		d = this.make_dialog({
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
				{
					fieldname: 'gift_card',
					label: __('Gift card code'),
					fieldtype: 'Data',
					depends_on: is_gift,
					mandatory_depends_on: is_gift,
					description: __('e.g. GC-AB12-CD34 — press Tab to check the balance'),
					onchange: () => {
						const code = (d && d.get_value('gift_card')) || '';
						if (!code) return;
						frappe.call('salon.gift_cards.get_gift_card', { code }).then((r) => {
							const c = r.message || {};
							const bal = flt(c.balance);
							d.set_df_property(
								'gift_card',
								'description',
								c.usable
									? __('Balance {0}', [format_currency(bal, inv.currency)])
									: __('This card is {0}', [c.status]),
							);
							if (c.usable) d.set_value('amount', Math.min(bal, owed));
						});
					},
				},
				{ fieldname: 'currency', fieldtype: 'Data', hidden: 1, default: inv.currency },
			],
			primary_action_label: __('Save Payment'),
			primary_action: (values) => {
				if (flt(values.amount) <= 0 || flt(values.amount) > owed + 0.005) {
					frappe.msgprint(__('Amount must be between 0 and {0}', [format_currency(owed, inv.currency)]));
					return;
				}
				const call =
					values.mode_of_payment === GIFT
						? {
								method: 'salon.gift_cards.redeem_gift_card',
								args: {
									invoice: inv.name,
									code: values.gift_card,
									amount: values.amount,
									posting_date: values.posting_date,
								},
							}
						: {
								method: 'salon.salon.billing.record_payment',
								args: {
									invoice: inv.name,
									mode_of_payment: values.mode_of_payment,
									amount: values.amount,
									posting_date: values.posting_date,
									reference_no: values.reference_no,
								},
							};
				frappe.call(Object.assign({ freeze: true }, call)).then((r) => {
					d.hide();
					const m = r.message || {};
					frappe.show_alert({
						message:
							values.mode_of_payment === GIFT
								? __('Paid by gift card — {0} left on the card', [format_currency(m.balance, inv.currency)])
								: __('Payment {0} recorded', [m.payment_entry || '']),
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
				frappe.set_route('salon-home');
			}
		}
	};

	// Salon staff (Salon User / Salon Manager, System Managers included)
	// land on the Salon Dashboard right after signing in, whichever login
	// path they came through - not on the ERPNext workspace home.
	const roles = frappe.user_roles || [];
	const has_salon_role = roles.includes('Salon User') || roles.includes('Salon Manager');
	const just_logged_in = /\/login(\?|$|#)/.test(document.referrer || '');
	const first_page = current_page();
	if (has_salon_role && just_logged_in && ['', 'home', 'workspaces', 'app'].includes(first_page)) {
		frappe.set_route('salon-home');
	}

	frappe.router.on('change', on_route);
	on_route();

	// Sidebar logout (the native avatar menu is hidden on salon screens).
	// Phones: every table becomes a stack of cards (salon.css); each cell
	// gets its column name as data-label so the card can label the value.
	const label_tables = () => {
		document.querySelectorAll('.salon-shell table.salon-table').forEach((table) => {
			const heads = [...table.querySelectorAll('thead th')]
				.filter((th) => th.style.display !== 'none')
				.map((th) => th.textContent.trim());
			if (!heads.length) return;
			table.querySelectorAll('tbody tr').forEach((tr) => {
				let col = 0;
				[...tr.children].forEach((td) => {
					const span = parseInt(td.getAttribute('colspan') || '1', 10);
					if (span === 1 && heads[col] !== undefined) td.setAttribute('data-label', heads[col]);
					// One value element per cell, so the card row is "label | value".
					if (span === 1 && td.childNodes.length > 1 && !td.querySelector(':scope > .cell-val')) {
						const wrap = document.createElement('span');
						wrap.className = 'cell-val';
						while (td.firstChild) wrap.appendChild(td.firstChild);
						td.appendChild(wrap);
					}
					col += span;
				});
			});
		});
	};
	let label_timer = null;
	new MutationObserver(() => {
		clearTimeout(label_timer);
		label_timer = setTimeout(label_tables, 60);
	}).observe(document.body, { childList: true, subtree: true });

	// Menu drawer (the collapsed sidebar) and the avatar menu.
	const close_menus = () => {
		document.body.classList.remove('salon-menu-open');
		document.querySelectorAll('.salon-usermenu.open').forEach((el) => el.classList.remove('open'));
	};
	$(document).on('click', '[data-salon-menu]', (e) => {
		e.preventDefault();
		document.body.classList.toggle('salon-menu-open');
	});
	$(document).on('click', '[data-salon-menu-close]', (e) => {
		e.preventDefault();
		document.body.classList.remove('salon-menu-open');
	});
	$(document).on('click', '.salon-drawer nav a', () => document.body.classList.remove('salon-menu-open'));
	$(document).on('click', '[data-salon-avatar]', (e) => {
		e.preventDefault();
		e.stopPropagation();
		const menu = e.currentTarget.closest('.salon-usermenu');
		const open = !menu.classList.contains('open');
		close_menus();
		menu.classList.toggle('open', open);
	});
	$(document).on('click', (e) => {
		if (!e.target.closest('.salon-usermenu')) {
			document.querySelectorAll('.salon-usermenu.open').forEach((el) => el.classList.remove('open'));
		}
	});
	$(document).on('keydown', (e) => e.key === 'Escape' && close_menus());
	frappe.router.on('change', close_menus);

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
		back.href = '/app/salon-home';
		back.textContent = '← ' + __('Salon Suite');
		document.body.appendChild(back);
	}
});
