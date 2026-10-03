frappe.pages['salon-pos-profiles'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonPosProfiles(page);
};

// Salon Manager + System Manager only (page roles, nav and server checks).
class SalonPosProfiles {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.profiles = [];
		this.setup = null;
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('pos-profiles')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>${__('POS Profiles')}</h1>
							<p>${__('One register per branch — payment methods, store room and the cashiers who can use it')}</p>
						</div>
						<button class="salon-btn" id="salon-new-profile">+ ${__('New POS Profile')}</button>
					</div>
					<div class="salon-profile-grid" id="salon-profile-grid"></div>
				</main>
			</div>
		`;
		this.body.querySelector('#salon-new-profile').addEventListener('click', () => this.open_editor());
		this.body.querySelector('#salon-profile-grid').addEventListener('click', (e) => {
			const btn = e.target.closest('[data-edit]');
			if (!btn) return;
			const profile = this.profiles.find((p) => p.name === btn.dataset.edit);
			if (profile) this.open_editor(profile);
		});
	}

	load_data() {
		frappe.call('salon.pos_profiles.get_pos_profiles').then((r) => {
			this.profiles = (r.message && r.message.profiles) || [];
			this.render();
		});
	}

	load_setup() {
		if (this.setup) return Promise.resolve(this.setup);
		return frappe.call('salon.pos_profiles.get_pos_profile_setup').then((r) => {
			this.setup = r.message;
			return this.setup;
		});
	}

	render() {
		const esc = frappe.utils.escape_html;
		const grid = this.body.querySelector('#salon-profile-grid');
		if (!this.profiles.length) {
			grid.innerHTML = `<p class="salon-muted">${__('No POS Profile yet for your branch. Create one so bookings and packages can be billed.')}</p>`;
			return;
		}
		grid.innerHTML = this.profiles
			.map((p) => {
				const modes = p.payments
					.map(
						(m) =>
							`<span class="salon-chip ${m.default ? 'salon-chip-default' : ''}">${esc(m.mode_of_payment)}${
								m.default ? ' · ' + __('default') : ''
							}</span>`,
					)
					.join('');
				const users = p.users.length
					? p.users.map((u) => `<span class="salon-chip">${esc(u.full_name)}</span>`).join('')
					: `<span class="salon-muted">${__('No cashiers assigned')}</span>`;
				return `
					<div class="salon-profile-card ${p.disabled ? 'disabled' : ''}">
						<div class="salon-profile-card-head">
							<div>
								<h3>${esc(p.name)}</h3>
								<div class="salon-muted">${esc(p.cost_center || '')}</div>
							</div>
							<span class="salon-status ${p.disabled ? 'salon-status-no-show' : 'salon-status-completed'}">${
								p.disabled ? __('Disabled') : __('Active')
							}</span>
						</div>
						<div class="salon-profile-row"><span>${__('Store room')}</span><b>${esc(p.warehouse || '—')}</b></div>
						<div class="salon-profile-row"><span>${__('Walk-in customer')}</span><b>${esc(p.customer || '—')}</b></div>
						<div class="salon-profile-row"><span>${__('Price list')}</span><b>${esc(p.selling_price_list || '—')}</b></div>
						<div class="salon-profile-label">${__('Payment methods')}</div>
						<div class="salon-chips">${modes || `<span class="salon-muted">—</span>`}</div>
						<div class="salon-profile-label">${__('Cashiers')}</div>
						<div class="salon-chips">${users}</div>
						<div class="salon-profile-actions">
							<button class="salon-btn salon-btn-ghost" data-edit="${esc(p.name)}">${__('Edit')}</button>
						</div>
					</div>`;
			})
			.join('');
	}

	async open_editor(profile) {
		const setup = await this.load_setup();
		if (!setup.branches.length) {
			frappe.msgprint(__('You are not assigned to a branch yet.'));
			return;
		}
		const is_new = !profile;
		profile = profile || { payments: [], users: [] };
		const branch_name = profile.cost_center || setup.branches[0].name;
		const branch = () =>
			setup.branches.find((b) => b.name === (d && d.get_value('cost_center'))) || setup.branches[0];
		const company_opts = (b) => setup.companies[b.company] || { warehouses: [], modes_of_payment: [] };
		const chosen_modes = profile.payments.map((m) => m.mode_of_payment);
		const chosen_users = profile.users.map((u) => u.user);
		const default_mode = (profile.payments.find((m) => m.default) || {}).mode_of_payment;

		const first_co = company_opts(setup.branches.find((b) => b.name === branch_name) || setup.branches[0]);

		// Store rooms / payment methods are per company: only rebuild them when
		// the branch change actually moves to another company (this also
		// keeps the initial default-application tick from clobbering values).
		let current_company = (setup.branches.find((b) => b.name === branch_name) || setup.branches[0]).company;
		let d = null;
		const resync = () => {
			if (!d) return;
			const b = branch();
			if (b.company === current_company) return;
			current_company = b.company;
			this.sync_editor(d, company_opts(b));
		};
		d = new frappe.ui.Dialog({
			title: is_new ? __('New POS Profile') : __('Edit {0}', [profile.name]),
			size: 'large',
			fields: [
				{
					fieldname: 'profile_name',
					label: __('Register name'),
					fieldtype: 'Data',
					reqd: is_new ? 1 : 0,
					read_only: is_new ? 0 : 1,
					default: is_new ? '' : profile.name,
					description: is_new ? __('e.g. the branch name — this cannot be changed later') : '',
				},
				{
					fieldname: 'cost_center',
					label: __('Branch'),
					fieldtype: 'Select',
					options: setup.branches.map((b) => b.name).join('\n'),
					default: branch_name,
					reqd: 1,
					read_only: setup.is_admin ? 0 : 1,
					onchange: resync,
				},
				{
					fieldname: 'warehouse',
					label: __('Store room (sells from)'),
					fieldtype: 'Select',
					options: first_co.warehouses.map((w) => w.name).join('\n'),
					default: profile.warehouse,
					reqd: 1,
				},
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'customer',
					label: __('Walk-in customer (optional)'),
					fieldtype: 'Link',
					options: 'Customer',
					default: profile.customer,
				},
				{
					fieldname: 'selling_price_list',
					label: __('Price list (optional)'),
					fieldtype: 'Select',
					options: [''].concat(setup.price_lists || []).join('\n'),
					default: profile.selling_price_list || '',
				},
				{ fieldname: 'disabled', label: __('Disabled'), fieldtype: 'Check', default: profile.disabled || 0 },
				{ fieldtype: 'Section Break', label: __('Payment methods') },
				{
					fieldname: 'payment_methods',
					fieldtype: 'MultiCheck',
					columns: 3,
					options: first_co.modes_of_payment.map((m) => ({
						label: m,
						value: m,
						checked: chosen_modes.includes(m) ? 1 : 0,
					})),
				},
				{
					fieldname: 'default_payment_method',
					label: __('Default payment method'),
					fieldtype: 'Select',
					options: first_co.modes_of_payment.join('\n'),
					default: default_mode || first_co.modes_of_payment[0],
				},
				{ fieldtype: 'Section Break', label: __('Cashiers') },
				{
					fieldname: 'users',
					fieldtype: 'MultiCheck',
					columns: 2,
					options: setup.users.map((u) => ({
						label: u.full_name || u.name,
						value: u.name,
						checked: chosen_users.includes(u.name) ? 1 : 0,
					})),
				},
				{ fieldtype: 'Section Break', label: __('Register switches') },
				{
					fieldname: 'allow_rate_change',
					label: __('Cashier can change price'),
					fieldtype: 'Check',
					default: profile.allow_rate_change || 0,
				},
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'allow_discount_change',
					label: __('Cashier can give discount'),
					fieldtype: 'Check',
					default: profile.allow_discount_change || 0,
				},
			],
			primary_action_label: is_new ? __('Create') : __('Save'),
			primary_action: (values) => {
				const payload = Object.assign({}, values, {
					name: is_new ? null : profile.name,
					payment_methods: d.fields_dict.payment_methods.get_checked_options(),
					users: d.fields_dict.users.get_checked_options(),
				});
				frappe
					.call({
						method: 'salon.pos_profiles.save_pos_profile',
						args: { data: JSON.stringify(payload) },
						freeze: true,
					})
					.then((r) => {
						d.hide();
						frappe.show_alert({ message: __('POS Profile {0} saved', [r.message]), indicator: 'green' });
						this.load_data();
					});
			},
		});
		d.$wrapper.addClass('salon-dialog');
		d.show();
	}

	// Changing the branch can change the company -> store rooms and
	// payment methods are per company.
	sync_editor(d, co) {
		const warehouses = co.warehouses.map((w) => w.name);
		d.set_df_property('warehouse', 'options', warehouses.join('\n'));
		if (!warehouses.includes(d.get_value('warehouse'))) d.set_value('warehouse', warehouses[0] || '');

		const checked = d.fields_dict.payment_methods.get_checked_options();
		d.set_df_property(
			'payment_methods',
			'options',
			co.modes_of_payment.map((m) => ({ label: m, value: m, checked: checked.includes(m) ? 1 : 0 })),
		);
		d.set_df_property('default_payment_method', 'options', co.modes_of_payment.join('\n'));
		if (!co.modes_of_payment.includes(d.get_value('default_payment_method'))) {
			d.set_value('default_payment_method', co.modes_of_payment[0] || '');
		}
	}
}
