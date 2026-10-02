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
				{ key: 'loyalty', label: 'Loyalty', href: '/app/loyalty-program' },
				{ key: 'packages', label: 'Packages', href: '/app/package-subscription' },
				{ key: 'services', label: 'Services', href: '/app/item' },
			],
		},
		{
			title: 'Accounts — ERPNext',
			items: [
				{
					key: 'pos',
					label: 'POS & Invoicing',
					// Admins manage invoices directly; everyone else (cashiers,
					// branch staff on a POS Profile) goes straight to the POS
					// register instead of the raw Sales Invoice list.
					href: () => (frappe.user.has_role('System Manager') ? '/app/sales-invoice' : '/app/point-of-sale'),
				},
				{ key: 'gl', label: 'GL Postings', href: '/app/gl-entry' },
			],
		},
		{
			title: 'Inventory — ERPNext',
			items: [{ key: 'stock', label: 'Stock & Consumables', href: '/app/stock-entry' }],
		},
		{
			title: 'HR & Payroll — ERPNext',
			items: [
				{ key: 'stylists', label: 'Stylists / Employees', href: '/app/salon-stylist' },
				{ key: 'payroll', label: 'Payroll & Commissions', href: '/app/salary-slip' },
			],
		},
		{
			title: 'Finance — ERPNext',
			items: [{ key: 'pnl', label: 'P&L by Branch', href: '/app/query-report/Profit and Loss Statement' }],
		},
	],

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

		return `
			<aside class="salon-sidebar">
				<div class="salon-brand">
					<span class="salon-brand-dot"></span>
					<span>Salon Suite</span>
				</div>
				${groups}
			</aside>
		`;
	},
};

// Full-chrome mode: hide Frappe's own navbar/sidebar/breadcrumbs for
// everyone except System Managers, site-wide — not just on our custom
// pages. This file is already loaded on every Desk page via
// app_include_js, so this runs everywhere automatically. Mirrors the
// same admin/non-admin split salon/salon/permissions.py already uses
// for row-level scoping, rather than introducing a second, separate
// "is this a salon user" concept.
frappe.ready(() => {
	const is_admin = frappe.user.has_role('System Manager');
	document.body.classList.toggle('salon-full-chrome', !is_admin);
});
