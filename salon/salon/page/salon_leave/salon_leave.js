frappe.pages['salon-leave'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonLeave(page);
};

// Tabs: Leaves (everyone) | Allocations, Leave Policies (Salon Manager /
// System Manager only - the server refuses the rest anyway).
class SalonLeave {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.tab = 'leaves';
		this.employee = '';
		this.data = null;
		this.admin = null;
		this.render_shell();
		this.load();
	}

	render_shell() {
		const manager = salon_common.is_manager();
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('leave')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>${__('Leave')}</h1>
							<p>${__('Apply for leave, see balances and approvals')}</p>
						</div>
						<button class="salon-btn" id="leave-primary">+ ${__('Apply Leave')}</button>
					</div>
					${
						manager
							? `<div class="salon-tabs">
								<button class="active" data-tab="leaves">${__('Leaves')}</button>
								<button data-tab="allocations">${__('Leave Allocation')}</button>
								<button data-tab="policies">${__('Leave Policy')}</button>
							</div>`
							: ''
					}
					<div id="leave-body"></div>
				</main>
			</div>
		`;
		this.body.querySelectorAll('[data-tab]').forEach((b) =>
			b.addEventListener('click', () => {
				this.tab = b.dataset.tab;
				this.body.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
				this.load();
			}),
		);
		this.body.querySelector('#leave-primary').addEventListener('click', () => {
			if (this.tab === 'allocations') this.open_allocation();
			else if (this.tab === 'policies') this.open_policy();
			else this.open_apply();
		});
		this.body.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-decide]');
			if (btn) this.decide(btn.dataset.name, btn.dataset.decide);
			const as = e.target.closest('[data-assign]');
			if (as) this.open_assign(as.dataset.assign);
		});
	}

	set_primary(label) {
		this.body.querySelector('#leave-primary').textContent = '+ ' + label;
	}

	load() {
		if (this.tab === 'leaves') {
			this.set_primary(__('Apply Leave'));
			frappe.call('salon.hr.get_leave_dashboard', { employee: this.employee || null }).then((r) => {
				this.data = r.message;
				this.render_leaves();
			});
		} else {
			this.set_primary(this.tab === 'allocations' ? __('New Allocation') : __('New Leave Policy'));
			frappe.call('salon.hr.get_leave_admin').then((r) => {
				this.admin = r.message;
				if (this.tab === 'allocations') this.render_allocations();
				else this.render_policies();
			});
		}
	}

	// ---------------- Leaves ----------------
	render_leaves() {
		const d = this.data;
		const esc = frappe.utils.escape_html;
		const el = this.body.querySelector('#leave-body');
		const types = Object.keys(d.balances || {});
		const balances = types.length
			? types
					.map((t) => {
						const b = d.balances[t];
						return `<div class="salon-card salon-balance">
							<div class="salon-card-value">${flt(b.remaining_leaves)}</div>
							<div class="salon-card-label">${esc(t)}<br><small>${__('{0} of {1} left · {2} pending', [
								flt(b.remaining_leaves),
								flt(b.total_leaves),
								flt(b.leaves_pending_approval),
							])}</small></div>
						</div>`;
					})
					.join('')
			: `<div class="salon-note">${
					d.focus
						? __('No leave allocated to {0} yet.', [esc(d.focus_name || d.focus)])
						: __("Your login isn't linked to an Employee yet.")
				}</div>`;

		const pending = d.applications.filter((a) => a.status === 'Open' && a.docstatus === 0).length;
		const rows = d.applications.length
			? d.applications
					.map((a) => {
						const open = a.status === 'Open' && a.docstatus === 0;
						return `<tr>
							${d.is_manager ? `<td>${esc(a.employee_name)}</td>` : ''}
							<td>${esc(a.leave_type)}</td>
							<td class="nowrap">${frappe.datetime.str_to_user(a.from_date)}${
								a.to_date !== a.from_date ? ' – ' + frappe.datetime.str_to_user(a.to_date) : ''
							}</td>
							<td class="num">${flt(a.total_leave_days)}${a.half_day ? ' ½' : ''}</td>
							<td class="nowrap">${salon_common.status_pill(open ? 'Pending' : a.status)}</td>
							<td>${esc(a.description || '')}</td>
							${
								d.is_manager
									? `<td class="nowrap salon-row-actions">${
											open
												? `<button class="salon-link-btn" data-decide="Approved" data-name="${esc(a.name)}">${__(
														'Approve',
													)}</button><button class="salon-link-btn muted" data-decide="Rejected" data-name="${esc(
														a.name,
													)}">${__('Reject')}</button>`
												: ''
										}</td>`
									: ''
							}
						</tr>`;
					})
					.join('')
			: `<tr><td colspan="7" class="salon-muted">${__('No leave applications yet.')}</td></tr>`;

		el.innerHTML = `
			${
				d.is_manager
					? `<div class="salon-list-head">
						<h2 class="salon-section-title">${__('Balances')} <span class="salon-muted">${esc(d.focus_name || '')}</span></h2>
						<select class="form-control salon-cal-branch" id="leave-employee">
							<option value="">${__('All stylists')}</option>
							${d.employees
								.map(
									(e) =>
										`<option value="${esc(e.name)}" ${e.name === this.employee ? 'selected' : ''}>${esc(e.employee_name)}</option>`,
								)
								.join('')}
						</select>
					</div>`
					: `<h2 class="salon-section-title">${__('My balances')}</h2>`
			}
			<div class="salon-summary-row">${balances}</div>
			<h2 class="salon-section-title">${d.is_manager ? __('Leave applications') : __('My leave applications')}${
				pending
					? ` <span class="salon-status salon-status-pending">${__('{0} pending', [pending])}</span>`
					: ''
			}</h2>
			<table class="salon-table salon-table-fit">
				<thead><tr>
					${d.is_manager ? `<th>${__('Stylist / Employee')}</th>` : ''}
					<th>${__('Leave type')}</th><th>${__('Dates')}</th><th class="num">${__('Days')}</th><th>${__('Status')}</th>
					<th>${__('Reason')}</th>${d.is_manager ? '<th></th>' : ''}
				</tr></thead>
				<tbody>${rows}</tbody>
			</table>`;
		const sel = el.querySelector('#leave-employee');
		if (sel)
			sel.addEventListener('change', (e) => {
				this.employee = e.target.value;
				this.load();
			});
	}

	open_apply() {
		const d = this.data;
		if (!d) return;
		if (!d.is_manager && !d.me) {
			frappe.msgprint(__("Your login isn't linked to an Employee yet."));
			return;
		}
		const type_options = (balances) =>
			d.leave_types.map((t) => {
				const b = balances[t.name];
				const tail = t.is_lwp
					? __('unpaid')
					: b
						? __('{0} left', [flt(b.remaining_leaves)])
						: __('not allocated');
				return { value: t.name, label: `${t.name} — ${tail}` };
			});
		let dlg = null;
		const refresh_types = (emp) =>
			frappe.call('salon.hr.get_leave_balance', { employee: emp }).then((r) => {
				dlg.set_df_property('leave_type', 'options', type_options(r.message || {}));
			});
		const emp_default = this.employee || d.me || (d.employees[0] && d.employees[0].name);
		dlg = salon_common.make_dialog({
			title: __('Apply Leave'),
			fields: [
				d.is_manager
					? {
							fieldname: 'employee',
							label: __('Stylist / Employee'),
							fieldtype: 'Select',
							options: d.employees.map((e) => ({ value: e.name, label: e.employee_name })),
							default: emp_default,
							reqd: 1,
							onchange: () => dlg && refresh_types(dlg.get_value('employee')),
						}
					: {
							fieldname: 'who',
							fieldtype: 'HTML',
							options: `<b>${frappe.utils.escape_html(d.focus_name || '')}</b>`,
						},
				{
					fieldname: 'leave_type',
					label: __('Leave type'),
					fieldtype: 'Select',
					options: type_options(d.focus === emp_default ? d.balances : {}),
					reqd: 1,
				},
				{
					fieldname: 'from_date',
					label: __('From'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'to_date',
					label: __('To'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
				{ fieldtype: 'Section Break' },
				{ fieldname: 'half_day', label: __('Half day'), fieldtype: 'Check' },
				{ fieldname: 'half_day_date', label: __('Half day on'), fieldtype: 'Date', depends_on: 'half_day' },
				{ fieldname: 'reason', label: __('Reason'), fieldtype: 'Small Text' },
			],
			primary_action_label: __('Apply'),
			primary_action: (v) => {
				if (v.to_date < v.from_date) {
					frappe.msgprint(__('"To" date must be on or after "From"'));
					return;
				}
				frappe
					.call({
						method: 'salon.hr.apply_leave',
						args: {
							data: JSON.stringify({
								employee: d.is_manager ? v.employee : null,
								leave_type: v.leave_type,
								from_date: v.from_date,
								to_date: v.to_date,
								half_day: v.half_day,
								half_day_date: v.half_day_date,
								reason: v.reason,
							}),
						},
						freeze: true,
					})
					.then(() => {
						dlg.hide();
						frappe.show_alert({ message: __('Leave applied — waiting for approval'), indicator: 'green' });
						this.load();
					});
			},
		});
		dlg.show();
		if (d.is_manager && d.focus !== emp_default) refresh_types(emp_default);
	}

	decide(name, status) {
		frappe.confirm(
			__('{0} leave application {1}?', [status === 'Approved' ? __('Approve') : __('Reject'), name]),
			() =>
				frappe.call({ method: 'salon.hr.decide_leave', args: { name, status }, freeze: true }).then(() => {
					frappe.show_alert({ message: __('Leave {0}', [__(status)]), indicator: 'green' });
					this.load();
				}),
		);
	}

	// ---------------- Allocations ----------------
	render_allocations() {
		const a = this.admin;
		const esc = frappe.utils.escape_html;
		const rows = a.allocations.length
			? a.allocations
					.map(
						(r) => `<tr>
							<td>${esc(r.employee_name)}</td>
							<td>${esc(r.leave_type)}</td>
							<td class="nowrap">${frappe.datetime.str_to_user(r.from_date)} – ${frappe.datetime.str_to_user(r.to_date)}</td>
							<td class="num">${flt(r.new_leaves_allocated)}</td>
							<td class="num">${flt(r.total_leaves_allocated)}</td>
							<td>${r.leave_policy ? esc(r.leave_policy) : '<span class="salon-muted">' + __('Manual') + '</span>'}</td>
						</tr>`,
					)
					.join('')
			: `<tr><td colspan="6" class="salon-muted">${__('No leave allocated yet.')}</td></tr>`;
		this.body.querySelector('#leave-body').innerHTML = `
			<table class="salon-table salon-table-fit">
				<thead><tr><th>${__('Stylist / Employee')}</th><th>${__('Leave type')}</th><th>${__('Period')}</th>
				<th class="num">${__('New days')}</th><th class="num">${__('Total days')}</th><th>${__('Source')}</th></tr></thead>
				<tbody>${rows}</tbody>
			</table>`;
	}

	employee_checks(checked = []) {
		return this.admin.employees.map((e) => ({
			label: e.employee_name,
			value: e.name,
			checked: checked.includes(e.name) ? 1 : 0,
		}));
	}

	year_bounds() {
		const y = frappe.datetime.get_today().slice(0, 4);
		return [`${y}-01-01`, `${y}-12-31`];
	}

	open_allocation() {
		const a = this.admin;
		const [from, to] = this.year_bounds();
		const dlg = salon_common.make_dialog({
			title: __('New Leave Allocation'),
			fields: [
				{
					fieldname: 'leave_type',
					label: __('Leave type'),
					fieldtype: 'Select',
					options: a.leave_types.join('\n'),
					reqd: 1,
				},
				{ fieldname: 'new_leaves_allocated', label: __('Days'), fieldtype: 'Float', reqd: 1 },
				{ fieldname: 'carry_forward', label: __('Carry forward unused leave'), fieldtype: 'Check' },
				{ fieldtype: 'Column Break' },
				{ fieldname: 'from_date', label: __('From'), fieldtype: 'Date', default: from, reqd: 1 },
				{ fieldname: 'to_date', label: __('To'), fieldtype: 'Date', default: to, reqd: 1 },
				{ fieldtype: 'Section Break', label: __('Stylists / Employees') },
				{ fieldname: 'employees', fieldtype: 'MultiCheck', columns: 2, options: this.employee_checks() },
			],
			primary_action_label: __('Allocate'),
			primary_action: (v) => {
				frappe
					.call({
						method: 'salon.hr.create_allocation',
						args: {
							employees: JSON.stringify(dlg.fields_dict.employees.get_checked_options()),
							leave_type: v.leave_type,
							from_date: v.from_date,
							to_date: v.to_date,
							new_leaves_allocated: v.new_leaves_allocated,
							carry_forward: v.carry_forward,
						},
						freeze: true,
					})
					.then((r) => {
						dlg.hide();
						frappe.show_alert({
							message: __('{0} allocation(s) created', [(r.message || []).length]),
							indicator: 'green',
						});
						this.load();
					});
			},
		});
		dlg.show();
	}

	// ---------------- Policies ----------------
	render_policies() {
		const a = this.admin;
		const esc = frappe.utils.escape_html;
		this.body.querySelector('#leave-body').innerHTML = a.policies.length
			? `<div class="salon-profile-grid">${a.policies
					.map(
						(p) => `<div class="salon-profile-card">
							<div class="salon-profile-card-head">
								<div><h3>${esc(p.title)}</h3><div class="salon-muted">${esc(p.name)}</div></div>
								<span class="salon-status salon-status-active">${__('{0} assigned', [p.assigned])}</span>
							</div>
							${p.details
								.map(
									(r) =>
										`<div class="salon-profile-row"><span>${esc(r.leave_type)}</span><b>${__(
											'{0} days / year',
											[flt(r.annual_allocation)],
										)}</b></div>`,
								)
								.join('')}
							<div class="salon-profile-actions">
								<button class="salon-btn salon-btn-ghost" data-assign="${esc(p.name)}">${__('Assign to stylists')}</button>
							</div>
						</div>`,
					)
					.join('')}</div>`
			: `<p class="salon-muted">${__('No leave policy yet. Create one, then assign it to stylists to allocate their leave for the year.')}</p>`;
	}

	open_policy() {
		const a = this.admin;
		const dlg = salon_common.make_dialog({
			title: __('New Leave Policy'),
			size: 'large',
			fields: [
				{
					fieldname: 'title',
					label: __('Policy name'),
					fieldtype: 'Data',
					reqd: 1,
					description: __('e.g. Stylists 2026'),
				},
				{
					fieldname: 'details',
					label: __('Leave per year'),
					fieldtype: 'Table',
					in_place_edit: true,
					data: [{}],
					fields: [
						{
							fieldname: 'leave_type',
							label: __('Leave type'),
							fieldtype: 'Select',
							options: a.leave_types.join('\n'),
							in_list_view: 1,
							columns: 6,
						},
						{
							fieldname: 'annual_allocation',
							label: __('Days per year'),
							fieldtype: 'Float',
							in_list_view: 1,
							columns: 4,
						},
					],
				},
			],
			primary_action_label: __('Create Policy'),
			primary_action: (v) => {
				frappe
					.call({
						method: 'salon.hr.create_policy',
						args: { title: v.title, details: JSON.stringify(v.details || []) },
						freeze: true,
					})
					.then(() => {
						dlg.hide();
						frappe.show_alert({ message: __('Leave policy created'), indicator: 'green' });
						this.load();
					});
			},
		});
		dlg.show();
	}

	open_assign(policy) {
		const [from, to] = this.year_bounds();
		const dlg = salon_common.make_dialog({
			title: __('Assign {0}', [policy]),
			fields: [
				{ fieldname: 'effective_from', label: __('From'), fieldtype: 'Date', default: from, reqd: 1 },
				{ fieldtype: 'Column Break' },
				{ fieldname: 'effective_to', label: __('To'), fieldtype: 'Date', default: to, reqd: 1 },
				{ fieldtype: 'Section Break' },
				{ fieldname: 'carry_forward', label: __('Carry forward unused leave'), fieldtype: 'Check' },
				{ fieldtype: 'Section Break', label: __('Stylists / Employees') },
				{ fieldname: 'employees', fieldtype: 'MultiCheck', columns: 2, options: this.employee_checks() },
			],
			primary_action_label: __('Assign & Allocate'),
			primary_action: (v) => {
				frappe
					.call({
						method: 'salon.hr.assign_policy',
						args: {
							leave_policy: policy,
							employees: JSON.stringify(dlg.fields_dict.employees.get_checked_options()),
							effective_from: v.effective_from,
							effective_to: v.effective_to,
							carry_forward: v.carry_forward,
						},
						freeze: true,
					})
					.then((r) => {
						dlg.hide();
						frappe.show_alert({
							message: __('Assigned to {0} employee(s)', [(r.message || []).length]),
							indicator: 'green',
						});
						this.load();
					});
			},
		});
		dlg.show();
	}
}
