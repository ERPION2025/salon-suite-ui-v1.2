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

// Full-chrome mode: hide Frappe's own navbar/sidebar/breadcrumbs,
// site-wide, ONLY for users with the Salon User role (and never for
// System Manager, even if they also happen to have Salon User - admins
// always keep normal Desk). Anyone else - other ERPNext users with no
// stake in the salon side at all - is untouched either way. This file
// is already loaded on every Desk page via app_include_js, so this
// runs everywhere automatically, not just on our own custom pages.
frappe.ready(() => {
	const is_salon_only = frappe.user.has_role('Salon User') && !frappe.user.has_role('System Manager');
	document.body.classList.toggle('salon-full-chrome', is_salon_only);
});
