frappe.pages['salon-bookings'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonBookings(page);
};

class SalonBookings {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.date = frappe.datetime.get_today();
		this.cost_center = null;
		this.render_shell();
		this.wire_toolbar();
		this.load_branches();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('bookings')}
				<main class="salon-main salon-main-fit">
					<header class="salon-cal-toolbar">
						<div class="salon-cal-title">
							<h1>${__('All Bookings')}</h1>
							<p>${__('Every booking with its invoice and stock entry')}</p>
						</div>
						<div class="salon-cal-controls">
							<button class="btn btn-default btn-sm" data-nav="prev" title="${__('Previous day')}">&larr;</button>
							<input type="date" class="form-control salon-cal-date" />
							<button class="btn btn-default btn-sm" data-nav="today">${__('Today')}</button>
							<button class="btn btn-default btn-sm" data-nav="next" title="${__('Next day')}">&rarr;</button>
							<button class="btn btn-default btn-sm" data-nav="all">${__('All dates')}</button>
							<span class="salon-branch-slot"></span>
							<a class="btn btn-default btn-sm" href="/book" target="_blank" rel="noopener" title="${__('Public page clients use to book online')}">${__('Online booking')} ↗</a>
							<button class="btn btn-primary salon-cal-new" id="salon-new-booking">+ ${__('New Booking')}</button>
						</div>
					</header>
					<div class="salon-table-scroll">
						<table class="salon-table salon-table-fit">
							<thead>
								<tr>
									<th>${__('Booking')}</th><th>${__('Date / Time')}</th><th class="col-branch">${__('Branch')}</th><th>${__('Client')}</th>
									<th>${__('Services')}</th><th>${__('Stylist')}</th><th>${__('Status')}</th><th>${__('Invoice')}</th>
									<th class="col-stock">${__('Stock')}</th><th class="num">${__('Total')}</th>
								</tr>
							</thead>
							<tbody id="salon-bookings-body"></tbody>
						</table>
					</div>
				</main>
			</div>
		`;
		this.$date = this.body.querySelector('.salon-cal-date');
		this.$date.value = this.date;
		this.$tbody = this.body.querySelector('#salon-bookings-body');
	}

	wire_toolbar() {
		this.$date.addEventListener('change', () => {
			this.date = this.$date.value || null;
			this.load_data();
		});
		this.body.querySelectorAll('[data-nav]').forEach((btn) =>
			btn.addEventListener('click', () => {
				const nav = btn.dataset.nav;
				if (nav === 'all') {
					this.date = null;
				} else if (nav === 'today' || !this.date) {
					this.date = frappe.datetime.get_today();
				} else {
					this.date = frappe.datetime.add_days(this.date, nav === 'next' ? 1 : -1);
				}
				this.$date.value = this.date || '';
				this.load_data();
			}),
		);
		this.body
			.querySelector('#salon-new-booking')
			.addEventListener('click', () =>
				salon_common.open_quick_booking({ cost_center: this.cost_center, on_done: () => this.load_data() }),
			);
	}

	// Same branch picker as the Calendar: admins choose, staff are locked
	// to their own branch (the server enforces that either way).
	load_branches() {
		frappe.call('salon.api.get_branch_options').then((r) => {
			const d = r.message || { branches: [] };
			const slot = this.body.querySelector('.salon-branch-slot');
			const esc = frappe.utils.escape_html;
			if (!d.is_admin) {
				const b = d.branches[0];
				slot.outerHTML = `<span class="salon-branch-locked">${esc(b ? b.name : __('No store assigned'))}</span>`;
				return;
			}
			slot.outerHTML = `
				<select class="form-control salon-cal-branch">
					<option value="">${__('All Branches')}</option>
					${d.branches.map((b) => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}
				</select>`;
			this.body.querySelector('.salon-cal-branch').addEventListener('change', (e) => {
				this.cost_center = e.target.value || null;
				this.load_data();
			});
		});
	}

	load_data() {
		frappe
			.call('salon.api.get_all_bookings', { cost_center: this.cost_center, date: this.date })
			.then((r) => this.render_rows(r.message || []));
	}

	render_rows(rows) {
		const esc = frappe.utils.escape_html;
		if (!rows.length) {
			this.$tbody.innerHTML = `<tr><td colspan="10" class="salon-muted">${
				this.date
					? __('No bookings on {0}.', [frappe.datetime.str_to_user(this.date)])
					: __('No bookings yet.')
			}</td></tr>`;
			return;
		}
		const dash = '<span class="salon-muted">&mdash;</span>';
		this.$tbody.innerHTML = rows
			.map((r) => {
				let invoice_cell = dash;
				if (r.sales_invoice) {
					let state = '';
					if (r.invoice_docstatus === 0) state = salon_common.status_pill('Draft');
					else if (flt(r.invoice_outstanding) > 0) state = salon_common.status_pill('Unpaid');
					else state = salon_common.status_pill('Paid');
					invoice_cell = `${salon_common.doc_link('sales-invoice', r.sales_invoice)}<span class="cell-sub">${state}</span>`;
				}
				return `
				<tr>
					<td class="nowrap">${salon_common.doc_link('salon-booking', r.name)}</td>
					<td class="nowrap">${salon_common.fmt_date(r.booking_datetime)}<div class="salon-muted">${salon_common.fmt_time(
						r.booking_datetime,
					)}</div></td>
					<td class="col-branch">${esc((r.cost_center || '').replace(/ - [^-]+$/, ''))}</td>
					<td>${esc(r.customer || '')}</td>
					<td>${esc(r.services_label || '')}</td>
					<td>${esc(r.salon_stylist_name || '')}</td>
					<td class="nowrap">${salon_common.status_pill(r.status)}</td>
					<td class="nowrap">${invoice_cell}</td>
					<td class="nowrap col-stock">${r.stock_entry ? esc(r.stock_entry) : dash}</td>
					<td class="num">${format_currency(r.total_amount || 0)}</td>
				</tr>`;
			})
			.join('');
	}
}
