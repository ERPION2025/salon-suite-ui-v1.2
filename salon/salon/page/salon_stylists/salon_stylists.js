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
						<thead><tr><th>Employee ID</th><th>Name</th><th>Designation</th><th>Branch</th><th>Skills</th><th>Commission</th></tr></thead>
						<tbody id="salon-stylists-body"></tbody>
					</table>
					<h2 style="font-size:16px; font-weight:500; margin-bottom:12px; color:#1a1a1a">Today's Attendance</h2>
					<table class="salon-table">
						<thead><tr><th>Employee</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Hours Worked</th></tr></thead>
						<tbody id="salon-attendance-body"></tbody>
					</table>
				</main>
			</div>
		`;
		document.getElementById('salon-new-stylist').addEventListener('click', () => frappe.new_doc('Salon Stylist'));
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
					<td><a href="/app/employee/${s.employee}">${s.employee}</a></td>
					<td>${frappe.utils.escape_html(s.stylist_name || '')}</td>
					<td>${frappe.utils.escape_html(s.designation || '')}</td>
					<td>${frappe.utils.escape_html(s.cost_center || '')}</td>
					<td>${frappe.utils.escape_html(s.skills || '')}</td>
					<td>${s.commission_rate || 0}%</td>
				</tr>
			`
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
					<td>${a.in_time ? frappe.datetime.str_to_user(a.in_time, true) : '&mdash;'}</td>
					<td>${a.out_time ? frappe.datetime.str_to_user(a.out_time, true) : '&mdash;'}</td>
					<td>${a.working_hours ? flt_fmt(a.working_hours) + ' h' : '&mdash;'}</td>
				</tr>
			`
					)
					.join('')
			: '<tr><td colspan="5">No attendance marked yet today.</td></tr>';
	}
}

function flt_fmt(v) {
	return Math.round(parseFloat(v) * 10) / 10;
}
