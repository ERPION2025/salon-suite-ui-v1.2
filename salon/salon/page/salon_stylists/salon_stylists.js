frappe.pages['salon-stylists'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonStylists(page);
};

class SalonStylists {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('stylists')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Stylists &amp; Employees</h1>
							<p>Salon Stylist records, each wrapping one Employee</p>
						</div>
						<button class="salon-btn" id="salon-new-stylist">+ Add Stylist</button>
					</div>
					<table class="salon-table" style="margin-bottom:28px">
						<thead><tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Branch</th><th>Skills</th><th class="num">Commission</th></tr></thead>
						<tbody id="salon-stylists-body"></tbody>
					</table>
					<div class="salon-schedule-head">
						<h2 class="salon-section-title">Today's Attendance</h2>
						<a href="/app/salon-attendance">${__('Open Attendance')} &rarr;</a>
					</div>
					<table class="salon-table">
						<thead><tr><th>Employee</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Hours Worked</th></tr></thead>
						<tbody id="salon-attendance-body"></tbody>
					</table>
				</main>
			</div>
		`;
		const add_btn = document.getElementById('salon-new-stylist');
		// Adding stylists is a Salon Manager / System Manager job.
		if (!salon_common.is_manager()) add_btn.style.display = 'none';
		add_btn.addEventListener('click', () => this.open_add_stylist());
	}

	load_data() {
		frappe.call('salon.api.get_stylists_data').then((r) => {
			this.render(r.message || { stylists: [], attendance: [] });
		});
	}

	render(d) {
		const body = document.getElementById('salon-stylists-body');
		body.innerHTML = d.stylists.length
			? d.stylists
					.map(
						(s) => `
				<tr>
					<td>${salon_common.doc_link('employee', s.employee)}</td>
					<td>${frappe.utils.escape_html(s.stylist_name || '')}</td>
					<td>${frappe.utils.escape_html(s.designation || '')}</td>
					<td>${frappe.utils.escape_html(s.cost_center || '')}</td>
					<td>${frappe.utils.escape_html(s.skills || '')}</td>
					<td class="num">${s.commission_rate || 0}%</td>
				</tr>
			`,
					)
					.join('')
			: '<tr><td colspan="6">No stylists yet.</td></tr>';

		const att = document.getElementById('salon-attendance-body');
		att.innerHTML = d.attendance.length
			? d.attendance
					.map(
						(a) => `
				<tr>
					<td>${frappe.utils.escape_html(a.employee_name || a.employee)}</td>
					<td><span class="salon-status salon-status-${(a.status || '').toLowerCase().replace(/\s+/g, '-')}">${a.status}</span></td>
					<td>${a.in_time ? salon_common.fmt_time(a.in_time) : '&mdash;'}</td>
					<td>${a.out_time ? salon_common.fmt_time(a.out_time) : '&mdash;'}</td>
					<td>${a.working_hours ? flt_fmt(a.working_hours) + ' h' : '&mdash;'}</td>
				</tr>
			`,
					)
					.join('')
			: '<tr><td colspan="5">No attendance marked yet today.</td></tr>';
	}
}

SalonStylists.prototype.open_add_stylist = function () {
	frappe.call('salon.team.get_stylist_setup').then((r) => {
		const s = r.message;
		if (!s.branches.length) {
			frappe.msgprint(__('You are not assigned to a branch yet.'));
			return;
		}
		const is_new = "eval:doc.mode=='New employee'";
		const dlg = salon_common.make_dialog({
			title: __('Add Stylist'),
			size: 'large',
			fields: [
				{
					fieldname: 'mode',
					label: __('Stylist is'),
					fieldtype: 'Select',
					options: ['New employee', 'Existing employee'].join('\n'),
					default: 'New employee',
					reqd: 1,
				},
				{
					fieldname: 'employee',
					label: __('Employee'),
					fieldtype: 'Select',
					options: s.employees.map((e) => ({ value: e.name, label: `${e.employee_name} (${e.name})` })),
					depends_on: "eval:doc.mode=='Existing employee'",
					mandatory_depends_on: "eval:doc.mode=='Existing employee'",
				},
				{
					fieldname: 'first_name',
					label: __('First name'),
					fieldtype: 'Data',
					depends_on: is_new,
					mandatory_depends_on: is_new,
				},
				{ fieldname: 'last_name', label: __('Last name'), fieldtype: 'Data', depends_on: is_new },
				{
					fieldname: 'gender',
					label: __('Gender'),
					fieldtype: 'Select',
					options: s.genders.join('\n'),
					depends_on: is_new,
					mandatory_depends_on: is_new,
				},
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'date_of_birth',
					label: __('Date of birth'),
					fieldtype: 'Date',
					depends_on: is_new,
					mandatory_depends_on: is_new,
				},
				{
					fieldname: 'date_of_joining',
					label: __('Joining date'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					depends_on: is_new,
					mandatory_depends_on: is_new,
				},
				{ fieldname: 'mobile', label: __('Mobile'), fieldtype: 'Data', options: 'Phone', depends_on: is_new },
				{
					fieldname: 'designation',
					label: __('Designation'),
					fieldtype: 'Select',
					options: [''].concat(s.designations).join('\n'),
					depends_on: is_new,
				},
				{ fieldtype: 'Section Break', label: __('Salon') },
				{
					fieldname: 'branch',
					label: __('Branch'),
					fieldtype: 'Select',
					options: s.branches.map((b) => b.name).join('\n'),
					default: s.branches[0].name,
					reqd: 1,
					read_only: s.is_admin ? 0 : 1,
				},
				{ fieldname: 'commission_rate', label: __('Commission %'), fieldtype: 'Percent', default: 10 },
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'skills',
					label: __('Skills'),
					fieldtype: 'Small Text',
					description: __('e.g. Colour, Keratin, Bridal makeup'),
				},
				{ fieldtype: 'Section Break', label: __('Login') },
				{
					fieldname: 'login_email',
					label: __('Login email (optional)'),
					fieldtype: 'Data',
					options: 'Email',
					description: __(
						'Creates their Salon Suite login (Salon User) so they can check in and apply for leave. A welcome email is sent to set the password.',
					),
				},
			],
			primary_action_label: __('Add Stylist'),
			primary_action: (v) => {
				frappe
					.call({ method: 'salon.team.create_stylist', args: { data: JSON.stringify(v) }, freeze: true })
					.then((res) => {
						dlg.hide();
						const m = res.message || {};
						frappe.show_alert({
							message: m.user
								? __('Stylist {0} added, login {1}', [m.employee, m.user])
								: __('Stylist {0} added', [m.employee]),
							indicator: 'green',
						});
						this.load_data();
					});
			},
		});
		dlg.show();
	});
};

function flt_fmt(v) {
	return Math.round(parseFloat(v) * 10) / 10;
}
