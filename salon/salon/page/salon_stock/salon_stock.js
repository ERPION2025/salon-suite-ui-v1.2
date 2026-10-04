frappe.pages['salon-stock'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonStock(page);
};

class SalonStock {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('stock')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>Stock &amp; Consumables</h1>
							<p>On-hand balances, transfers, receipts and consumption from completed bookings</p>
						</div>
						<button class="salon-btn" id="salon-new-entry">+ Stock Entry</button>
					</div>
					<table class="salon-table" style="margin-bottom:28px">
						<thead><tr><th>Item</th><th>Warehouse</th><th class="num">On Hand</th><th class="num">Reserved</th><th class="num">Avg Cost</th></tr></thead>
						<tbody id="salon-stock-body"></tbody>
					</table>
					<h2 class="salon-section-title">Recent Stock Entries</h2>
					<table class="salon-table">
						<thead><tr><th>Entry</th><th>Date</th><th>Type</th><th>From → To</th><th>Linked Booking</th><th>Items</th></tr></thead>
						<tbody id="salon-entries-body"></tbody>
					</table>
				</main>
			</div>
		`;
		document.getElementById('salon-new-entry').addEventListener('click', () => this.open_stock_entry());
	}

	load_data() {
		frappe.call('salon.api.get_stock_data').then((r) => {
			this.render(r.message || { stock: [], recent_entries: [] });
		});
	}

	render(d) {
		const body = document.getElementById('salon-stock-body');
		body.innerHTML = d.stock.length
			? d.stock
					.map(
						(s) => `
				<tr>
					<td class="nowrap">${salon_common.doc_link('item', s.item_code)}</td>
					<td>${frappe.utils.escape_html(s.warehouse)}</td>
					<td class="num">${s.actual_qty}</td>
					<td class="num">${s.reserved_qty}</td>
					<td class="num">${format_currency(s.valuation_rate || 0)}</td>
				</tr>
			`,
					)
					.join('')
			: '<tr><td colspan="5">No stock balances found for your branch yet.</td></tr>';

		const entries = document.getElementById('salon-entries-body');
		entries.innerHTML = d.recent_entries.length
			? d.recent_entries
					.map(
						(e) => `
				<tr>
					<td>${salon_common.doc_link('stock-entry', e.name)}</td>
					<td class="nowrap">${frappe.datetime.str_to_user(e.posting_date)}</td>
					<td class="nowrap">${frappe.utils.escape_html(e.stock_entry_type || '')}</td>
					<td>${frappe.utils.escape_html([e.from_warehouse, e.to_warehouse].filter(Boolean).join(' → ') || '—')}</td>
					<td>${e.booking ? salon_common.doc_link('salon-booking', e.booking) : '&mdash;'}</td>
					<td>${frappe.utils.escape_html(e.items_label || '')}</td>
				</tr>
			`,
					)
					.join('')
			: '<tr><td colspan="6" class="salon-muted">No stock entries yet.</td></tr>';
	}
}

// Stock Entry popup: transfer between store rooms, receive or issue stock.
SalonStock.prototype.open_stock_entry = function () {
	frappe.call('salon.stock.get_stock_entry_setup').then((r) => {
		const s = r.message;
		const whs = s.warehouses.map((w) => w.name);
		const needs_from = "eval:['Material Transfer','Material Issue'].includes(doc.entry_type)";
		const needs_to = "eval:['Material Transfer','Material Receipt'].includes(doc.entry_type)";
		const dlg = salon_common.make_dialog({
			title: __('New Stock Entry'),
			size: 'large',
			fields: [
				{
					fieldname: 'entry_type',
					label: __('Type'),
					fieldtype: 'Select',
					options: s.types.join('\n'),
					default: 'Material Transfer',
					reqd: 1,
					description: __('Transfer: move between store rooms · Receipt: stock in · Issue: use / write off'),
				},
				{
					fieldname: 'posting_date',
					label: __('Date'),
					fieldtype: 'Date',
					default: frappe.datetime.get_today(),
					reqd: 1,
				},
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'from_warehouse',
					label: __('From store room'),
					fieldtype: 'Select',
					options: whs.join('\n'),
					default: s.own_warehouse || whs[0],
					depends_on: needs_from,
					mandatory_depends_on: needs_from,
				},
				{
					fieldname: 'to_warehouse',
					label: __('To store room'),
					fieldtype: 'Select',
					options: whs.join('\n'),
					default: whs.find((w) => w !== s.own_warehouse) || whs[0],
					depends_on: needs_to,
					mandatory_depends_on: needs_to,
				},
				{ fieldtype: 'Section Break', label: __('Items') },
				{
					fieldname: 'items',
					fieldtype: 'Table',
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
						{
							fieldname: 'rate',
							label: __('Rate (receipts)'),
							fieldtype: 'Currency',
							in_list_view: 1,
							columns: 3,
						},
					],
				},
				{ fieldname: 'remarks', label: __('Notes'), fieldtype: 'Small Text' },
			],
			primary_action_label: __('Submit Stock Entry'),
			primary_action: (v) => {
				const items = (v.items || [])
					.filter((i) => i.item_code)
					.map((i) => ({ item_code: i.item_code, qty: i.qty, rate: i.rate }));
				if (!items.length) {
					frappe.msgprint(__('Add at least one item'));
					return;
				}
				frappe
					.call({
						method: 'salon.stock.create_stock_entry',
						args: { data: JSON.stringify(Object.assign({}, v, { items })) },
						freeze: true,
					})
					.then((res) => {
						dlg.hide();
						frappe.show_alert({
							message: __('Stock Entry {0} submitted', [res.message]),
							indicator: 'green',
						});
						this.load_data();
					});
			},
		});
		dlg.show();
	});
};
