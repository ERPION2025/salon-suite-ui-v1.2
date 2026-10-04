frappe.pages['salon-attendance'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonAttendance(page);
};

// Stylists: own check-in/out, own history, past-dated attendance.
// Managers: today's team on top, records for any stylist of the branch.
class SalonAttendance {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.employee = '';
		this.to_date = frappe.datetime.get_today();
		this.from_date = frappe.datetime.add_days(this.to_date, -30);
		this.data = null;
		this.render_shell();
		this.load();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('attendance')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>${__('Attendance')}</h1>
							<p>${__('Check in, check out and attendance history — feeds payroll automatically')}</p>
						</div>
						<button class="salon-btn" data-act="mark">+ ${__('Mark Attendance')}</button>
					</div>
					<section id="att-me"></section>
					<section id="att-team"></section>
					<div class="salon-list-head">
						<h2 class="salon-section-title">${__('Attendance records')}</h2>
						<div class="salon-cal-controls">
							<select class="form-control salon-cal-branch" id="att-employee" style="display:none"></select>
							<input type="date" class="form-control salon-cal-date" id="att-from" />
							<span class="salon-muted">${__('to')}</span>
							<input type="date" class="form-control salon-cal-date" id="att-to" />
						</div>
					</div>
					<table class="salon-table salon-table-fit">
						<thead><tr>
							<th>${__('Date')}</th><th class="att-col-emp">${__('Stylist / Employee')}</th><th>${__('Branch')}</th>
							<th>${__('Status')}</th><th>${__('Check-in')}</th><th>${__('Check-out')}</th><th class="num">${__('Hours')}</th>
						</tr></thead>
						<tbody id="att-records"></tbody>
					</table>
				</main>
			</div>
		`;
		const $ = (sel) => this.body.querySelector(sel);
		$('#att-from').value = this.from_date;
		$('#att-to').value = this.to_date;
		$('#att-from').addEventListener('change', (e) => {
			this.from_date = e.target.value;
			this.load();
		});
		$('#att-to').addEventListener('change', (e) => {
			this.to_date = e.target.value;
			this.load();
		});
		$('#att-employee').addEventListener('change', (e) => {
			this.employee = e.target.value;
			this.load();
		});
		this.body.addEventListener('click', (e) => {
			const btn = e.target.closest('[data-act]');
			if (!btn) return;
			const emp = btn.dataset.employee || null;
			if (btn.dataset.act === 'mark') this.open_mark(emp);
			if (btn.dataset.act === 'in') this.check_in(emp);
			if (btn.dataset.act === 'out') this.check_out(emp);
		});
	}

	load() {
		frappe
			.call('salon.hr.get_attendance_dashboard', {
				employee: this.employee || null,
				from_date: this.from_date,
				to_date: this.to_date,
			})
			.then((r) => {
				this.data = r.message;
				this.render();
			});
	}

	branch_options(selected) {
		return (this.data.branches || [])
			.map(
				(b) =>
					`<option value="${frappe.utils.escape_html(b.name)}" ${b.name === selected ? 'selected' : ''}>${frappe.utils.escape_html(
						b.name.replace(/ - [^-]+$/, ''),
					)}</option>`,
			)
			.join('');
	}

	time(v) {
		return v ? salon_common.fmt_time(v) : '<span class="salon-muted">—</span>';
	}

	render() {
		const d = this.data;
		const esc = frappe.utils.escape_html;

		// ---- My day ----
		const me = d.my_today;
		const meEl = this.body.querySelector('#att-me');
		if (me) {
			const att = me.attendance;
			const first_in = me.logs.find((l) => l.log_type === 'IN');
			const last_out = [...me.logs].reverse().find((l) => l.log_type === 'OUT');
			meEl.innerHTML = `
				<div class="salon-myday">
					<div class="salon-myday-who">
						<div class="salon-avatar-sm">${esc((me.employee_name || '?').slice(0, 1))}</div>
						<div>
							<div class="t">${esc(me.employee_name)}</div>
							<div class="salon-muted">${frappe.datetime.str_to_user(frappe.datetime.get_today())} · ${
								att ? salon_common.status_pill(att.status) : salon_common.status_pill('Not marked')
							}</div>
						</div>
					</div>
					<div class="salon-myday-stats">
						<div><span>${__('Check-in')}</span><b>${this.time(first_in && first_in.time)}</b></div>
						<div><span>${__('Check-out')}</span><b>${this.time(last_out && last_out.time)}</b></div>
						<div><span>${__('Hours')}</span><b>${att && att.working_hours ? flt(att.working_hours, 2) : '—'}</b></div>
					</div>
					<div class="salon-myday-actions">
						<select class="form-control" id="att-my-branch" title="${__('Branch / store')}">${this.branch_options(
							me.default_branch,
						)}</select>
						${
							me.checked_in
								? `<button class="salon-btn" data-act="out">${__('Check out')}</button>`
								: `<button class="salon-btn" data-act="in">${__('Check in')}</button>`
						}
					</div>
				</div>`;
		} else {
			meEl.innerHTML = d.is_manager
				? ''
				: `<div class="salon-note">${__(
						"Your login isn't linked to an Employee yet, so you can't check in. Ask your Salon Manager to link it from Stylists → Add Stylist → Login.",
					)}</div>`;
		}

		// ---- Team today (managers) ----
		const teamEl = this.body.querySelector('#att-team');
		if (d.is_manager) {
			const rows = d.team_today.length
				? d.team_today
						.map(
							(t) => `<tr>
								<td>${esc(t.employee_name)}</td>
								<td>${esc((t.branch || '').replace(/ - [^-]+$/, '') || '—')}</td>
								<td class="nowrap">${t.status ? salon_common.status_pill(t.status) : salon_common.status_pill('Not marked')}</td>
								<td class="nowrap">${this.time(t.in_time)}</td>
								<td class="nowrap">${this.time(t.out_time)}</td>
								<td class="num">${t.working_hours ? flt(t.working_hours, 2) : '—'}</td>
								<td class="nowrap salon-row-actions">
									${
										t.checked_in
											? `<button class="salon-link-btn" data-act="out" data-employee="${esc(t.employee)}">${__('Check out')}</button>`
											: `<button class="salon-link-btn" data-act="in" data-employee="${esc(t.employee)}">${__('Check in')}</button>`
									}
									<button class="salon-link-btn" data-act="mark" data-employee="${esc(t.employee)}">${__('Mark')}</button>
								</td>
							</tr>`,
						)
						.join('')
				: `<tr><td colspan="7" class="salon-muted">${__('No stylists in your branch yet.')}</td></tr>`;
			const present = d.team_today.filter((t) => t.status && t.status !== 'Absent').length;
			teamEl.innerHTML = `
				<div class="salon-list-head">
					<h2 class="salon-section-title">${__("Today's attendance")} <span class="salon-muted">${__('{0} of {1} in', [
						present,
						d.team_today.length,
					])}</span></h2>
				</div>
				<table class="salon-table salon-table-fit" style="margin-bottom:24px">
					<thead><tr><th>${__('Stylist / Employee')}</th><th>${__('Branch')}</th><th>${__('Status')}</th><th>${__(
						'Check-in',
					)}</th><th>${__('Check-out')}</th><th class="num">${__('Hours')}</th><th></th></tr></thead>
					<tbody>${rows}</tbody>
				</table>`;

			const sel = this.body.querySelector('#att-employee');
			sel.style.display = '';
			sel.innerHTML =
				`<option value="">${__('All stylists')}</option>` +
				d.employees
					.map(
						(e) =>
							`<option value="${esc(e.name)}" ${e.name === this.employee ? 'selected' : ''}>${esc(e.employee_name)}</option>`,
					)
					.join('');
		} else {
			teamEl.innerHTML = '';
			this.body.querySelectorAll('.att-col-emp').forEach((el) => (el.style.display = 'none'));
		}

		// ---- Records ----
		const body = this.body.querySelector('#att-records');
		body.innerHTML = d.records.length
			? d.records
					.map(
						(r) => `<tr>
							<td class="nowrap">${frappe.datetime.str_to_user(r.attendance_date)}</td>
							${d.is_manager ? `<td>${esc(r.employee_name)}</td>` : ''}
							<td>${esc((r.custom_salon_branch || '').replace(/ - [^-]+$/, '') || '—')}</td>
							<td class="nowrap">${salon_common.status_pill(r.status)}${
								r.leave_type ? `<span class="salon-muted"> ${esc(r.leave_type)}</span>` : ''
							}</td>
							<td class="nowrap">${this.time(r.in_time)}</td>
							<td class="nowrap">${this.time(r.out_time)}</td>
							<td class="num">${r.working_hours ? flt(r.working_hours, 2) : '—'}</td>
						</tr>`,
					)
					.join('')
			: `<tr><td colspan="7" class="salon-muted">${__('No attendance in this period.')}</td></tr>`;
	}

	selected_branch() {
		const el = this.body.querySelector('#att-my-branch');
		return el ? el.value : null;
	}

	check_in(employee) {
		frappe
			.call({
				method: 'salon.hr.check_in',
				args: { employee, branch: employee ? null : this.selected_branch() },
				freeze: true,
			})
			.then(() => {
				frappe.show_alert({ message: __('Checked in'), indicator: 'green' });
				this.load();
			});
	}

	check_out(employee) {
		frappe.call({ method: 'salon.hr.check_out', args: { employee }, freeze: true }).then(() => {
			frappe.show_alert({ message: __('Checked out'), indicator: 'green' });
			this.load();
		});
	}

	open_mark(employee) {
		const d = this.data;
		const esc = frappe.utils.escape_html;
		if (!d.is_manager && !d.me) {
			frappe.msgprint(__("Your login isn't linked to an Employee yet."));
			return;
		}
		const emp_default = employee || d.me || (d.employees[0] && d.employees[0].name);
		const branch_for = (emp) => {
			const e = (d.employees || []).find((x) => x.name === emp);
			return (e && e.branch) || (d.my_today && d.my_today.default_branch) || '';
		};
		let dlg = null;
		dlg = salon_common.make_dialog({
			title: __('Mark Attendance'),
			fields: [
				d.is_manager
					? {
							fieldname: 'employee',
							label: __('Stylist / Employee'),
							fieldtype: 'Select',
							options: d.employees.map((e) => ({ value: e.name, label: e.employee_name })),
							default: emp_default,
							reqd: 1,
							onchange: () => dlg && dlg.set_value('branch', branch_for(dlg.get_value('employee'))),
						}
					: {
							fieldname: 'who',
							fieldtype: 'HTML',
							options: `<b>${esc(d.my_today ? d.my_today.employee_name : '')}</b>`,
						},
				{
					fieldname: 'attendance_date',
					label: __('Date'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					reqd: 1,
					description: __('Past dates are allowed — they flow into payroll for that period.'),
				},
				{
					fieldname: 'status',
					label: __('Status'),
					fieldtype: 'Select',
					options: d.statuses.join('\n'),
					default: 'Present',
					reqd: 1,
				},
				{
					fieldname: 'branch',
					label: __('Branch / store'),
					fieldtype: 'Select',
					options: d.branches.map((b) => b.name).join('\n'),
					default: branch_for(emp_default),
				},
				{ fieldtype: 'Section Break', depends_on: "eval:doc.status!='Absent'" },
				{ fieldname: 'in_time', label: __('Check-in time'), fieldtype: 'Time' },
				{ fieldtype: 'Column Break' },
				{ fieldname: 'out_time', label: __('Check-out time'), fieldtype: 'Time' },
			],
			primary_action_label: __('Save'),
			primary_action: (v) => {
				if (v.attendance_date > frappe.datetime.get_today()) {
					frappe.msgprint(__("Attendance can't be marked for a future date"));
					return;
				}
				frappe
					.call({
						method: 'salon.hr.mark_attendance',
						args: {
							data: JSON.stringify({
								employee: d.is_manager ? v.employee : null,
								attendance_date: v.attendance_date,
								status: v.status,
								branch: v.branch,
								in_time: v.status !== 'Absent' ? v.in_time : null,
								out_time: v.status !== 'Absent' ? v.out_time : null,
							}),
						},
						freeze: true,
					})
					.then(() => {
						dlg.hide();
						frappe.show_alert({ message: __('Attendance saved'), indicator: 'green' });
						this.load();
					});
			},
		});
		dlg.show();
	}
}
