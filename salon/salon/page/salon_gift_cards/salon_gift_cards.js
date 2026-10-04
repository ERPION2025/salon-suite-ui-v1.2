frappe.pages['salon-gift-cards'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonGiftCards(page);
};

class SalonGiftCards {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('gift-cards')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>${__('Gift Cards')}</h1>
							<p>${__('Sell gift cards and take them as payment at billing')}</p>
						</div>
						<button class="salon-btn" id="gc-sell">+ ${__('Sell Gift Card')}</button>
					</div>
					<div class="salon-summary-row" id="gc-stats"></div>
					<div class="salon-list-head">
						<h2 class="salon-section-title">${__('Gift cards')}</h2>
						<div class="salon-cal-controls">
							<input class="form-control" id="gc-code" placeholder="${__('Check a card code…')}" style="min-width:200px">
							<button class="btn btn-default btn-sm" id="gc-check">${__('Check balance')}</button>
						</div>
					</div>
					<table class="salon-table salon-table-fit">
						<thead><tr>
							<th>${__('Card')}</th><th>${__('Bought by')}</th><th>${__('For')}</th><th>${__('Status')}</th>
							<th>${__('Issued')}</th><th>${__('Expires')}</th><th>${__('Invoice')}</th>
							<th class="num">${__('Value')}</th><th class="num">${__('Balance')}</th>
						</tr></thead>
						<tbody id="gc-body"></tbody>
					</table>
				</main>
			</div>
		`;
		this.body.querySelector('#gc-sell').addEventListener('click', () => this.open_sell());
		const check = () => {
			const code = this.body.querySelector('#gc-code').value.trim();
			if (code) this.open_card(code);
		};
		this.body.querySelector('#gc-check').addEventListener('click', check);
		this.body.querySelector('#gc-code').addEventListener('keydown', (e) => e.key === 'Enter' && check());
		this.body.querySelector('#gc-body').addEventListener('click', (e) => {
			const el = e.target.closest('[data-card]');
			if (el) {
				e.preventDefault();
				this.open_card(el.dataset.card);
			}
		});
	}

	load() {
		frappe.call('salon.gift_cards.get_gift_cards').then((r) => this.render(r.message));
	}

	render(d) {
		const esc = frappe.utils.escape_html;
		this.body.querySelector('#gc-stats').innerHTML = `
			<div class="salon-card"><div class="salon-card-value">${d.active}</div><div class="salon-card-label">${__('Active cards')}</div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.outstanding)}</div><div class="salon-card-label">${__(
				'Unused balance',
			)}<br><small>${__('Owed to card holders')}</small></div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.sold_month)}</div><div class="salon-card-label">${__(
				'Sold this month',
			)}</div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.redeemed_month)}</div><div class="salon-card-label">${__(
				'Redeemed this month',
			)}</div></div>`;
		this.body.querySelector('#gc-body').innerHTML = d.cards.length
			? d.cards
					.map(
						(c) => `<tr>
							<td class="nowrap"><a href="#" class="salon-doc-link" data-card="${esc(c.code)}">${esc(c.code)}</a></td>
							<td>${esc(c.customer_name || c.customer || '')}</td>
							<td>${esc(c.recipient_name || '—')}</td>
							<td class="nowrap">${salon_common.status_pill(c.status)}</td>
							<td class="nowrap">${c.issue_date ? frappe.datetime.str_to_user(c.issue_date) : '—'}</td>
							<td class="nowrap">${c.expiry_date ? frappe.datetime.str_to_user(c.expiry_date) : '—'}</td>
							<td class="nowrap">${c.sales_invoice ? salon_common.doc_link('sales-invoice', c.sales_invoice) : '—'}</td>
							<td class="num">${format_currency(c.value)}</td>
							<td class="num">${format_currency(c.balance)}</td>
						</tr>`,
					)
					.join('')
			: `<tr><td colspan="9" class="salon-muted">${__('No gift cards sold yet.')}</td></tr>`;
	}

	open_sell() {
		frappe.call('salon.api.get_branch_options').then((r) => {
			const b = r.message || { branches: [] };
			if (!b.branches.length) {
				frappe.msgprint(__('You are not assigned to a branch yet.'));
				return;
			}
			const dlg = salon_common.make_dialog({
				title: __('Sell Gift Card'),
				fields: [
					{
						fieldname: 'customer',
						label: __('Bought by (client)'),
						fieldtype: 'Link',
						options: 'Customer',
						reqd: 1,
					},
					{ fieldname: 'value', label: __('Card value'), fieldtype: 'Currency', reqd: 1 },
					{
						fieldname: 'validity_days',
						label: __('Valid for (days)'),
						fieldtype: 'Int',
						default: 365,
						description: __('0 = never expires'),
					},
					{
						fieldname: 'cost_center',
						label: __('Branch'),
						fieldtype: 'Select',
						options: b.branches.map((x) => x.name).join('\n'),
						default: b.branches[0].name,
						read_only: b.is_admin ? 0 : 1,
					},
					{ fieldtype: 'Section Break', label: __('Recipient (optional)') },
					{ fieldname: 'recipient_name', label: __('Name'), fieldtype: 'Data' },
					{ fieldname: 'recipient_mobile', label: __('Mobile'), fieldtype: 'Data', options: 'Phone' },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'recipient_email', label: __('Email'), fieldtype: 'Data', options: 'Email' },
					{ fieldname: 'message', label: __('Message'), fieldtype: 'Small Text' },
				],
				primary_action_label: __('Create & Bill'),
				primary_action: (v) => {
					frappe
						.call({
							method: 'salon.gift_cards.sell_gift_card',
							args: { data: JSON.stringify(v) },
							freeze: true,
						})
						.then((res) => {
							dlg.hide();
							const m = res.message || {};
							frappe.show_alert({ message: __('Gift card {0} created', [m.code]), indicator: 'green' });
							this.load();
							// Take the money for the card straight away.
							if (m.sales_invoice) salon_common.open_invoice(m.sales_invoice, () => this.load());
						});
				},
			});
			dlg.show();
		});
	}

	open_card(code) {
		frappe.call('salon.gift_cards.get_gift_card', { code }).then((r) => {
			const c = r.message;
			const esc = frappe.utils.escape_html;
			const rows = (c.redemptions || []).length
				? c.redemptions
						.map(
							(x) =>
								`<tr><td>${frappe.datetime.str_to_user(x.posting_date)}</td><td>${salon_common.doc_link(
									'sales-invoice',
									x.sales_invoice,
								)}</td><td class="num">${format_currency(x.amount)}</td></tr>`,
						)
						.join('')
				: `<tr><td colspan="3" class="salon-muted">${__('Not used yet')}</td></tr>`;
			const dlg = salon_common.make_dialog({
				title: __('Gift card {0}', [c.code]),
				fields: [{ fieldname: 'html', fieldtype: 'HTML' }],
			});
			dlg.fields_dict.html.$wrapper.html(`
				<div class="salon-popup">
					<div class="salon-popup-grid">
						<div><span>${__('Balance')}</span><b>${format_currency(c.balance)}</b></div>
						<div><span>${__('Value')}</span><b>${format_currency(c.value)}</b></div>
						<div><span>${__('Status')}</span><b>${salon_common.status_pill(c.usable ? 'Active' : c.status)}</b></div>
						<div><span>${__('Expires')}</span><b>${c.expiry_date ? frappe.datetime.str_to_user(c.expiry_date) : '—'}</b></div>
						<div><span>${__('Bought by')}</span><b>${esc(c.customer_name || c.customer || '')}</b></div>
						<div><span>${__('For')}</span><b>${esc(c.recipient_name || '—')}</b></div>
					</div>
					${c.message ? `<div class="salon-popup-notes">${esc(c.message)}</div>` : ''}
					<div class="salon-popup-subtitle">${__('Used on')}</div>
					<table class="salon-table salon-popup-table">
						<thead><tr><th>${__('Date')}</th><th>${__('Invoice')}</th><th class="num">${__('Amount')}</th></tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</div>`);
			dlg.show();
		});
	}
}
