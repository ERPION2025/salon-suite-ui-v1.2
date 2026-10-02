frappe.pages['salon-pnl'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonPnl(page);
};

class SalonPnl {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('pnl')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>P&amp;L by Branch</h1>
							<p id="salon-pnl-period">This month, by account</p>
						</div>
						<a class="salon-btn" style="text-decoration:none" href="/app/query-report/Profit and Loss Statement">Full Report &rarr;</a>
					</div>
					<div class="salon-summary-row" id="salon-pnl-summary"></div>
					<div id="salon-pnl-tables"></div>
					<p style="color:#9a9a9a; font-size:12px; margin-top:12px">
						Simplified view &mdash; direct Income/Expense account totals from GL Entry for the
						period, not a full consolidated Financial Statement (no budget, prior-year
						comparison, or multi-currency handling). Use "Full Report" above for anything
						audited or shared externally.
					</p>
				</main>
			</div>
		`;
	}

	load_data() {
		frappe.call('salon.api.get_pnl_data').then((r) => {
			this.render(r.message);
		});
	}

	render(d) {
		document.getElementById('salon-pnl-period').textContent =
			`${frappe.datetime.str_to_user(d.month_start)} \u2013 ${frappe.datetime.str_to_user(d.month_end)}, by account`;

		document.getElementById('salon-pnl-summary').innerHTML = `
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.total_revenue)}</div><div class="salon-card-label">Revenue</div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.total_expense)}</div><div class="salon-card-label">Expenses</div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.net_profit)}</div><div class="salon-card-label">Net Profit</div></div>
		`;

		const row = (r) => `<tr><td>${frappe.utils.escape_html(r.account_name)}</td><td style="text-align:right">${format_currency(Math.abs(r.net))}</td></tr>`;

		document.getElementById('salon-pnl-tables').innerHTML = `
			<div class="salon-pnl-section-title">Revenue</div>
			<table class="salon-table">
				<tbody>
					${d.revenue.map(row).join('') || '<tr><td colspan="2">No revenue posted this period.</td></tr>'}
					<tr class="salon-pnl-total-row"><td>Total Revenue</td><td style="text-align:right">${format_currency(d.total_revenue)}</td></tr>
				</tbody>
			</table>
			<div class="salon-pnl-section-title">Expenses</div>
			<table class="salon-table">
				<tbody>
					${d.expense.map(row).join('') || '<tr><td colspan="2">No expenses posted this period.</td></tr>'}
					<tr class="salon-pnl-total-row"><td>Total Expenses</td><td style="text-align:right">${format_currency(d.total_expense)}</td></tr>
				</tbody>
			</table>
		`;
	}
}
