frappe.pages['salon-payroll'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonPayroll(page);
};

class SalonPayroll {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('payroll')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Payroll &amp; Commissions</h1>
							<p id="salon-payroll-period">Service Commission accrued this month, from submitted POS invoices</p>
						</div>
					</div>
					<div class="salon-summary-row" id="salon-payroll-summary"></div>
					<table class="salon-table">
						<thead><tr><th>Stylist</th><th>Commission %</th><th>Entries</th><th>Amount Accrued</th></tr></thead>
						<tbody id="salon-payroll-body"></tbody>
					</table>
					<p style="color:#9a9a9a; font-size:12px; margin-top:12px">
						Each row is Additional Salary entries (Service Commission component) created by
						<code>salon/salon/events.py</code> when a cashier submits an invoice &mdash; not a
						full Salary Slip breakdown. Run normal Payroll for the authoritative payslip.
					</p>
				</main>
			</div>
		`;
	}

	load_data() {
		frappe.call('salon.api.get_payroll_data').then((r) => {
			this.render(r.message || { rows: [], total: 0 });
		});
	}

	render(d) {
		document.getElementById('salon-payroll-period').textContent =
			`Service Commission accrued ${frappe.datetime.str_to_user(d.month_start)} \u2013 ${frappe.datetime.str_to_user(d.month_end)}`;

		document.getElementById('salon-payroll-summary').innerHTML = `
			<div class="salon-card"><div class="salon-card-value">${d.rows.length}</div><div class="salon-card-label">Stylists</div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.total)}</div><div class="salon-card-label">Total commission this month</div></div>
		`;

		const body = document.getElementById('salon-payroll-body');
		body.innerHTML = d.rows.length
			? d.rows
					.map(
						(r) => `
				<tr>
					<td>${frappe.utils.escape_html(r.stylist_name || '')}</td>
					<td>${r.commission_rate || 0}%</td>
					<td>${r.entries}</td>
					<td>${format_currency(r.amount)}</td>
				</tr>
			`
					)
					.join('')
			: '<tr><td colspan="4">No commission accrued yet this month.</td></tr>';
	}
}
