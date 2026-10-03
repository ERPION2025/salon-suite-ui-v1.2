frappe.pages['salon-purchases'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonPurchases(page);
};

const PURCHASE_TILES = [
	{ category: 'Consumables', hint: __('Colour, shampoo, foils — expensed when used') },
	{ category: 'Retail Products', hint: __('Products you sell — expensed when sold') },
	{ category: 'Overheads & Bills', hint: __('Rent, power, internet — expensed now') },
	{ category: 'Equipment', hint: __('Dryers, scissors, small tools — expensed now') },
	{ category: 'Assets', hint: __('Chairs, fit-out, big machines — balance sheet') },
];

class SalonPurchases {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.cost_center = null;
		this.setup = null;
		this.render_shell();
		this.load_setup();
		this.load_data();
	}

	render_shell() {
		const esc = frappe.utils.escape_html;
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('purchases')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>${__('Purchases')}</h1>
							<p>${__('Record what the branch buys — it posts to the books and to P&L by Branch automatically')}</p>
						</div>
						<div style="display:flex; gap:10px; align-items:center">
							<div class="salon-branch-filter" id="salon-purchase-branch"></div>
							<button class="salon-btn" id="salon-new-purchase">+ ${__('New Purchase')}</button>
						</div>
					</div>
					<div class="salon-purchase-tiles">
						${PURCHASE_TILES.map(
							(t) => `
							<button class="salon-purchase-tile" data-category="${esc(t.category)}">
								<span class="t">${esc(__(t.category))}</span>
								<span class="h">${esc(t.hint)}</span>
							</button>`,
						).join('')}
					</div>
					<div class="salon-summary-row" id="salon-purchase-summary"></div>
					<h2 class="salon-section-title">${__('Recent purchases')}</h2>
					<table class="salon-table">
						<thead><tr>
							<th>${__('Date')}</th><th>${__('Bill')}</th><th>${__('Supplier')}</th><th>${__('Category')}</th>
							<th>${__('Branch')}</th><th style="text-align:right">${__('Amount')}</th><th>${__('Payment')}</th>
						</tr></thead>
						<tbody id="salon-purchase-body"></tbody>
					</table>
				</main>
			</div>
		`;
		this.body.querySelector('#salon-new-purchase').addEventListener('click', () => this.open_new_purchase());
		this.body
			.querySelectorAll('.salon-purchase-tile')
			.forEach((el) => el.addEventListener('click', () => this.open_new_purchase(el.dataset.category)));
		this.body.querySelector('#salon-purchase-body').addEventListener('click', (e) => {
			const btn = e.target.closest('[data-pay]');
			if (btn) this.open_pay(btn.dataset.pay, btn.dataset.company);
		});
	}

	load_setup() {
		return frappe.call('salon.purchases.get_purchase_setup').then((r) => {
			this.setup = r.message;
			this.render_branch_filter();
			return this.setup;
		});
	}

	render_branch_filter() {
		const el = this.body.querySelector('#salon-purchase-branch');
		if (!this.setup) return;
		if (!this.setup.is_admin) {
			const b = this.setup.branches[0];
			el.innerHTML = `<span class="salon-branch-locked">${frappe.utils.escape_html(
				b ? b.name : __('No store assigned'),
			)}</span>`;
			return;
		}
		el.innerHTML = `
			<select class="form-control">
				<option value="">${__('All Branches')}</option>
				${this.setup.branches
					.map(
						(b) =>
							`<option value="${frappe.utils.escape_html(b.name)}">${frappe.utils.escape_html(b.name)}</option>`,
					)
					.join('')}
			</select>`;
		el.querySelector('select').addEventListener('change', (e) => {
			this.cost_center = e.target.value || null;
			this.load_data();
		});
	}

	load_data() {
		frappe.call('salon.purchases.get_purchases', { cost_center: this.cost_center }).then((r) => {
			this.render(r.message || { purchases: [] });
		});
	}

	render(d) {
		const esc = frappe.utils.escape_html;
		this.body.querySelector('#salon-purchase-summary').innerHTML = `
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.expensed_now || 0)}</div>
				<div class="salon-card-label">${__('Expensed this month')}<br><small>${__('Overheads, bills, equipment — in P&L now')}</small></div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.stock_bought || 0)}</div>
				<div class="salon-card-label">${__('Stock bought this month')}<br><small>${__('In P&L when used or sold')}</small></div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.assets_bought || 0)}</div>
				<div class="salon-card-label">${__('Assets bought this month')}<br><small>${__('Balance sheet, not P&L')}</small></div></div>
			<div class="salon-card"><div class="salon-card-value">${format_currency(d.unpaid || 0)}</div>
				<div class="salon-card-label">${__('Unpaid bills')}<br><small>${__('Bought on credit, still owed')}</small></div></div>
		`;

		const body = this.body.querySelector('#salon-purchase-body');
		if (!d.purchases.length) {
			body.innerHTML = `<tr><td colspan="7">${__('No purchases recorded yet — pick a type above to add one.')}</td></tr>`;
			return;
		}
		body.innerHTML = d.purchases
			.map((p) => {
				const amount = p.rounded_total || p.grand_total;
				const owed = flt(p.outstanding_amount);
				const company = this.company_for(p.cost_center);
				const payment =
					owed > 0
						? `<span class="salon-status salon-status-no-show">${__('Owes')} ${format_currency(owed, p.currency)}</span>
						   <button class="salon-link-btn" data-pay="${esc(p.name)}" data-company="${esc(company || '')}">${__('Mark paid')}</button>`
						: `<span class="salon-status salon-status-completed">${__('Paid')}</span>`;
				return `
					<tr>
						<td>${frappe.datetime.str_to_user(p.posting_date)}</td>
						<td>${salon_common.doc_link('purchase-invoice', p.name)}${p.bill_no ? `<div class="salon-muted">${esc(p.bill_no)}</div>` : ''}</td>
						<td>${esc(p.supplier_name || p.supplier || '')}</td>
						<td>${esc(__(p.category || ''))}</td>
						<td>${esc(p.cost_center || '')}</td>
						<td style="text-align:right">${format_currency(amount, p.currency)}</td>
						<td>${payment}</td>
					</tr>`;
			})
			.join('');
	}

	company_for(cost_center) {
		const b = ((this.setup && this.setup.branches) || []).find((x) => x.name === cost_center);
		return b ? b.company : null;
	}

	// ---- New Purchase dialog ----

	async open_new_purchase(category) {
		const setup = this.setup || (await this.load_setup());
		if (!setup.branches.length) {
			frappe.msgprint(
				__('You are not assigned to a branch yet. Ask your manager to add you to a POS Profile.'),
			);
			return;
		}
		const stock_cats = setup.stock_categories;
		const asset_cats = setup.asset_categories;
		const default_branch =
			(this.cost_center && setup.branches.find((b) => b.name === this.cost_center)) || setup.branches[0];
		const is_stock = `eval:${JSON.stringify(stock_cats)}.includes(doc.category)`;
		const is_bill = `eval:doc.category && !${JSON.stringify(stock_cats)}.includes(doc.category)`;

		// `let` + guarded onchange: Select onchange can fire while the dialog
		// is still being constructed.
		let d = null;
		const sync = () => d && this.sync_dialog(d);
		d = new frappe.ui.Dialog({
			title: __('New Purchase'),
			size: 'large',
			fields: [
				{
					fieldname: 'category',
					label: __('What did you buy?'),
					fieldtype: 'Select',
					options: setup.categories.join('\n'),
					reqd: 1,
					default: category || setup.categories[0],
					onchange: sync,
				},
				{
					fieldname: 'cost_center',
					label: __('Branch'),
					fieldtype: 'Select',
					options: setup.branches.map((b) => b.name).join('\n'),
					default: default_branch.name,
					reqd: 1,
					read_only: setup.is_admin ? 0 : 1,
					onchange: sync,
				},
				{ fieldtype: 'Column Break' },
				{ fieldname: 'supplier', label: __('Bought from (supplier)'), fieldtype: 'Data', reqd: 1 },
				{
					fieldname: 'posting_date',
					label: __('Date'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
				{ fieldname: 'bill_no', label: __('Supplier bill no. (optional)'), fieldtype: 'Data' },
				{ fieldtype: 'Section Break', depends_on: is_stock, label: __('Items') },
				{ fieldname: 'warehouse', label: __('Store room'), fieldtype: 'Select', depends_on: is_stock },
				{
					fieldname: 'stock_lines',
					label: __('Items'),
					fieldtype: 'Table',
					depends_on: is_stock,
					in_place_edit: true,
					data: [{ qty: 1 }],
					fields: [
						{
							fieldname: 'item_code',
							label: __('Item'),
							fieldtype: 'Link',
							options: 'Item',
							in_list_view: 1,
							columns: 5,
							get_query: () => ({ filters: { is_stock_item: 1, disabled: 0 } }),
						},
						{
							fieldname: 'qty',
							label: __('Qty'),
							fieldtype: 'Float',
							in_list_view: 1,
							columns: 2,
							default: 1,
						},
						{ fieldname: 'rate', label: __('Rate'), fieldtype: 'Currency', in_list_view: 1, columns: 3 },
					],
				},
				{ fieldtype: 'Section Break', depends_on: is_bill, label: __('Bill lines') },
				{
					fieldname: 'expense_lines',
					label: __('Lines'),
					fieldtype: 'Table',
					depends_on: is_bill,
					in_place_edit: true,
					data: [{}],
					fields: [
						{
							fieldname: 'account',
							label: __('Expense head'),
							fieldtype: 'Select',
							in_list_view: 1,
							columns: 4,
						},
						{
							fieldname: 'description',
							label: __('What for'),
							fieldtype: 'Data',
							in_list_view: 1,
							columns: 3,
						},
						{ fieldname: 'amount', label: __('Amount'), fieldtype: 'Currency', in_list_view: 1, columns: 3 },
					],
				},
				{ fieldtype: 'Section Break', label: __('Payment') },
				{
					fieldname: 'payment',
					label: __('Payment'),
					fieldtype: 'Select',
					options: ['Paid now', 'On credit (pay later)'].join('\n'),
					default: 'Paid now',
					reqd: 1,
				},
				{
					fieldname: 'mode_of_payment',
					label: __('Paid by'),
					fieldtype: 'Select',
					depends_on: "eval:doc.payment=='Paid now'",
				},
				{ fieldtype: 'Column Break' },
				{ fieldname: 'notes', label: __('Notes'), fieldtype: 'Small Text' },
			],
			primary_action_label: __('Save Purchase'),
			primary_action: (values) => this.submit_purchase(d, values),
		});
		d.$wrapper.addClass('salon-dialog');
		d.show();

		// Supplier: free text with suggestions - a new name creates the supplier.
		const list_id = 'salon-supplier-list';
		const datalist = document.createElement('datalist');
		datalist.id = list_id;
		datalist.innerHTML = (setup.suppliers || [])
			.map((s) => `<option value="${frappe.utils.escape_html(s)}"></option>`)
			.join('');
		d.$wrapper.append(datalist);
		d.fields_dict.supplier.$input.attr('list', list_id).attr('autocomplete', 'off');

		// Dialog defaults are applied a tick after show(); sync once they land
		// (the category onchange also re-syncs).
		setTimeout(() => this.sync_dialog(d), 0);
	}

	// Branch / category drive which accounts, store rooms and payment modes apply.
	sync_dialog(d) {
		const setup = this.setup;
		const values = d.get_values(true) || {};
		const branch = setup.branches.find((b) => b.name === values.cost_center) || setup.branches[0];
		const co = setup.companies[branch.company] || {};
		const is_asset = setup.asset_categories.includes(values.category);
		const accounts = (is_asset ? co.asset_accounts : co.expense_accounts) || [];

		const set_options = (fieldname, options, fallback) => {
			const f = d.fields_dict[fieldname];
			d.set_df_property(fieldname, 'options', options.join('\n'));
			const current = f.get_value();
			if (!current || !options.includes(current)) f.set_value(fallback || options[0] || '');
		};
		set_options(
			'warehouse',
			(co.warehouses || []).map((w) => w.name),
			branch.warehouse,
		);
		set_options('mode_of_payment', co.modes_of_payment || []);

		const grid = d.fields_dict.expense_lines.grid;
		const acc_options = accounts.map((a) => a.name);
		const acc_df = d.fields_dict.expense_lines.df.fields.find((f) => f.fieldname === 'account');
		acc_df.options = acc_options.join('\n');
		if (grid.update_docfield_property) grid.update_docfield_property('account', 'options', acc_df.options);
		(grid.get_data ? grid.get_data() : []).forEach((row) => {
			if (row.account && !acc_options.includes(row.account)) row.account = '';
		});
		const acc_label = is_asset ? __('Asset account') : __('Expense head');
		acc_df.label = acc_label;
		if (grid.update_docfield_property) grid.update_docfield_property('account', 'label', acc_label);
		grid.refresh();
	}

	submit_purchase(d, values) {
		const stock = this.setup.stock_categories.includes(values.category);
		const lines = stock
			? (values.stock_lines || [])
					.filter((r) => r.item_code)
					.map((r) => ({ item_code: r.item_code, qty: r.qty, rate: r.rate }))
			: (values.expense_lines || [])
					.filter((r) => r.account || r.amount)
					.map((r) => ({ account: r.account, description: r.description, amount: r.amount }));
		if (!lines.length) {
			frappe.msgprint(__('Add at least one line'));
			return;
		}
		const payload = {
			category: values.category,
			cost_center: values.cost_center,
			supplier: values.supplier,
			posting_date: values.posting_date,
			bill_no: values.bill_no,
			warehouse: values.warehouse,
			payment: values.payment === 'Paid now' ? 'Paid now' : 'On credit',
			mode_of_payment: values.mode_of_payment,
			notes: values.notes,
			lines,
		};
		frappe
			.call({
				method: 'salon.purchases.create_purchase',
				args: { data: JSON.stringify(payload) },
				freeze: true,
			})
			.then((r) => {
				const m = r.message || {};
				d.hide();
				frappe.show_alert({
					message: __('Purchase {0} saved — {1}', [m.name, format_currency(m.grand_total || 0)]),
					indicator: 'green',
				});
				// A brand-new supplier name should show up in suggestions next time.
				if (values.supplier && !this.setup.suppliers.includes(values.supplier))
					this.setup.suppliers.push(values.supplier);
				this.load_data();
			});
	}

	open_pay(invoice, company) {
		const modes = ((this.setup && this.setup.companies[company]) || {}).modes_of_payment || [];
		const d = new frappe.ui.Dialog({
			title: __('Mark {0} as paid', [invoice]),
			fields: [
				{
					fieldname: 'mode_of_payment',
					label: __('Paid by'),
					fieldtype: 'Select',
					options: modes.join('\n'),
					default: modes[0],
					reqd: 1,
				},
			],
			primary_action_label: __('Mark paid'),
			primary_action: (values) => {
				frappe
					.call({
						method: 'salon.purchases.pay_purchase',
						args: { purchase_invoice: invoice, mode_of_payment: values.mode_of_payment },
						freeze: true,
					})
					.then(() => {
						d.hide();
						frappe.show_alert({ message: __('Payment recorded'), indicator: 'green' });
						this.load_data();
					});
			},
		});
		d.$wrapper.addClass('salon-dialog');
		d.show();
	}
}
