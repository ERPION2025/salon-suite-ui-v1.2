frappe.pages['salon-reports'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonReports(page);
};

// One series per chart, so one brand hue (no categorical palette); values
// are always printed as text beside the bar so colour never carries meaning
// alone, and every bar has a hover tooltip.
class SalonReports {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.period = 'month';
		this.cost_center = null;
		this.render_shell();
		this.load_branches();
		this.load();
	}

	render_shell() {
		const periods = [
			['today', __('Today')],
			['7d', __('Last 7 days')],
			['month', __('This month')],
			['last_month', __('Last month')],
			['custom', __('Custom')],
		];
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('reports')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>${__('Reports & Analytics')}</h1>
							<p id="rp-period-label">${__('Sales, bookings, staff and payments')}</p>
						</div>
					</div>
					<div class="salon-list-head">
						<div class="salon-tabs" style="margin:0">
							${periods.map(([k, l]) => `<button data-period="${k}" class="${k === this.period ? 'active' : ''}">${l}</button>`).join('')}
						</div>
						<div class="salon-cal-controls">
							<span id="rp-custom" style="display:none">
								<input type="date" class="form-control salon-cal-date" id="rp-from">
								<input type="date" class="form-control salon-cal-date" id="rp-to">
							</span>
							<span class="rp-branch-slot"></span>
						</div>
					</div>
					<div class="salon-summary-row" id="rp-kpis"></div>
					<div class="rp-panel">
						<div class="rp-panel-head"><h2>${__('Revenue by day')}</h2><span class="salon-muted" id="rp-day-total"></span></div>
						<div class="rp-columns" id="rp-by-day"></div>
					</div>
					<div class="rp-grid">
						<div class="rp-panel"><div class="rp-panel-head"><h2>${__('Top services')}</h2></div><div id="rp-services"></div></div>
						<div class="rp-panel"><div class="rp-panel-head"><h2>${__('Stylists')}</h2><span class="salon-muted">${__(
							'completed bookings · commission',
						)}</span></div><div id="rp-stylists"></div></div>
						<div class="rp-panel"><div class="rp-panel-head"><h2>${__('Branches')}</h2></div><div id="rp-branches"></div></div>
						<div class="rp-panel"><div class="rp-panel-head"><h2>${__('Payments received')}</h2></div><div id="rp-payments"></div></div>
						<div class="rp-panel"><div class="rp-panel-head"><h2>${__('Bookings by status')}</h2></div><div id="rp-status"></div></div>
						<div class="rp-panel"><div class="rp-panel-head"><h2>${__('Top clients')}</h2></div><div id="rp-clients"></div></div>
					</div>
				</main>
			</div>
			<div class="rp-tip" id="rp-tip"></div>
		`;
		this.body.querySelectorAll('[data-period]').forEach((b) =>
			b.addEventListener('click', () => {
				this.period = b.dataset.period;
				this.body.querySelectorAll('[data-period]').forEach((x) => x.classList.toggle('active', x === b));
				this.body.querySelector('#rp-custom').style.display = this.period === 'custom' ? '' : 'none';
				if (this.period === 'custom') {
					const f = this.body.querySelector('#rp-from');
					const t = this.body.querySelector('#rp-to');
					if (!f.value) f.value = frappe.datetime.add_days(frappe.datetime.get_today(), -29);
					if (!t.value) t.value = frappe.datetime.get_today();
				}
				this.load();
			}),
		);
		['#rp-from', '#rp-to'].forEach((s) =>
			this.body.querySelector(s).addEventListener('change', () => this.load()),
		);

		// Shared hover tooltip for every bar.
		const tip = this.body.querySelector('#rp-tip');
		this.body.addEventListener('mouseover', (e) => {
			const el = e.target.closest('[data-tip]');
			if (!el) return;
			tip.innerHTML = el.dataset.tip;
			tip.style.display = 'block';
		});
		this.body.addEventListener('mousemove', (e) => {
			if (tip.style.display !== 'block') return;
			tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8) + 'px';
			tip.style.top = e.clientY - tip.offsetHeight - 10 + 'px';
		});
		this.body.addEventListener('mouseout', (e) => {
			if (e.target.closest('[data-tip]')) tip.style.display = 'none';
		});
	}

	load_branches() {
		frappe.call('salon.api.get_branch_options').then((r) => {
			const d = r.message || { branches: [] };
			const slot = this.body.querySelector('.rp-branch-slot');
			const esc = frappe.utils.escape_html;
			if (!d.is_admin) {
				const b = d.branches[0];
				slot.outerHTML = `<span class="salon-branch-locked">${esc(b ? b.name : __('No store assigned'))}</span>`;
				return;
			}
			slot.outerHTML = `<select class="form-control salon-cal-branch" id="rp-branch">
				<option value="">${__('All Branches')}</option>
				${d.branches.map((b) => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('')}
			</select>`;
			this.body.querySelector('#rp-branch').addEventListener('change', (e) => {
				this.cost_center = e.target.value || null;
				this.load();
			});
		});
	}

	load() {
		const args = { period: this.period, cost_center: this.cost_center };
		if (this.period === 'custom') {
			args.from_date = this.body.querySelector('#rp-from').value;
			args.to_date = this.body.querySelector('#rp-to').value;
		}
		frappe.call('salon.reports.get_report', args).then((r) => this.render(r.message));
	}

	bars(rows, opts = {}) {
		const esc = frappe.utils.escape_html;
		if (!rows.length) return `<p class="salon-muted">${__('Nothing in this period.')}</p>`;
		const max = Math.max(...rows.map((r) => flt(r.amount))) || 1;
		const fmt = opts.count ? (v) => `${v}` : (v) => format_currency(v);
		return `<div class="rp-bars">${rows
			.map((r) => {
				const label = String(r.label || r.key).replace(/ - [^-]+$/, '');
				const pct = Math.max(2, (flt(r.amount) / max) * 100);
				const extra = opts.extra ? opts.extra(r) : '';
				const tip = `<b>${esc(label)}</b><br>${fmt(r.amount)}${extra ? ' · ' + extra : ''}`;
				return `<div class="rp-bar-row" data-tip="${esc(tip)}">
					<div class="rp-bar-label">${esc(label)}</div>
					<div class="rp-bar-track"><div class="rp-bar" style="width:${pct}%"></div></div>
					<div class="rp-bar-value">${fmt(r.amount)}${extra ? `<small>${extra}</small>` : ''}</div>
				</div>`;
			})
			.join('')}</div>`;
	}

	render(d) {
		const k = d.kpis;
		const esc = frappe.utils.escape_html;
		this.body.querySelector('#rp-period-label').textContent =
			`${frappe.datetime.str_to_user(d.start)} – ${frappe.datetime.str_to_user(d.end)}`;
		const tile = (v, l, s) =>
			`<div class="salon-card"><div class="salon-card-value">${v}</div><div class="salon-card-label">${l}${
				s ? `<br><small>${s}</small>` : ''
			}</div></div>`;
		this.body.querySelector('#rp-kpis').innerHTML = [
			tile(format_currency(k.revenue), __('Revenue'), __('{0} invoices', [k.invoices])),
			tile(format_currency(k.avg_ticket), __('Average ticket')),
			tile(format_currency(k.collected), __('Payments received')),
			tile(k.completed, __('Completed bookings'), __('of {0} booked', [k.bookings])),
			tile(`${flt(k.lost_rate, 1)}%`, __('No-show / cancelled'), __('{0} bookings', [k.lost])),
			tile(k.new_clients, __('New clients'), __('{0} online bookings', [k.online])),
		].join('');

		// Revenue by day: vertical columns, one hue, baseline-anchored.
		const days = d.by_day;
		const max = Math.max(...days.map((x) => flt(x.amount))) || 1;
		const total = days.reduce((s, x) => s + flt(x.amount), 0);
		this.body.querySelector('#rp-day-total').textContent = __('Total {0}', [format_currency(total)]);
		const every = Math.ceil(days.length / 12);
		this.body.querySelector('#rp-by-day').innerHTML = days
			.map((x, i) => {
				const h = flt(x.amount) ? Math.max(2, (flt(x.amount) / max) * 100) : 0;
				const label = frappe.datetime.str_to_user(x.key);
				return `<div class="rp-col" data-tip="${esc(`<b>${label}</b><br>${format_currency(x.amount)}`)}">
					<div class="rp-col-bar-wrap"><div class="rp-col-bar" style="height:${h}%"></div></div>
					<div class="rp-col-label">${i % every === 0 ? esc(x.key.slice(8, 10) + '/' + x.key.slice(5, 7)) : ''}</div>
				</div>`;
			})
			.join('');

		this.body.querySelector('#rp-services').innerHTML = this.bars(d.by_service, {
			extra: (r) => __('{0} sold', [flt(r.qty)]),
		});
		this.body.querySelector('#rp-stylists').innerHTML = this.bars(d.by_stylist, {
			extra: (r) => `${r.qty} · ${format_currency(r.commission)}`,
		});
		this.body.querySelector('#rp-branches').innerHTML = this.bars(d.by_branch);
		this.body.querySelector('#rp-payments').innerHTML = this.bars(d.payment_mix);
		this.body.querySelector('#rp-status').innerHTML = this.bars(d.booking_status, { count: true });
		this.body.querySelector('#rp-clients').innerHTML = this.bars(d.top_clients);
	}
}
