frappe.pages['salon-gl'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonGL(page);
};

class SalonGL {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render_shell();
		this.load_data();
	}

	render_shell() {
		this.body.innerHTML = `
			<div class="salon-shell">
				${salon_common.render_sidebar_html('gl')}
				<main class="salon-main">
					<div class="salon-pagehead">
						<div>
							<h1>GL Postings</h1>
							<p>Every Sales Invoice, Stock Entry and commission posting &mdash; grouped by voucher</p>
						</div>
					</div>
					<div id="salon-gl-body"><p style="color:#9a9a9a; font-size:13px">Loading&hellip;</p></div>
				</main>
			</div>
		`;
	}

	load_data() {
		frappe.call('salon.api.get_gl_postings').then((r) => {
			this.render(r.message || []);
		});
	}

	render(postings) {
		const root = document.getElementById('salon-gl-body');
		if (!postings.length) {
			root.innerHTML = `<p style="color:#9a9a9a; font-size:13px">No GL postings yet.</p>`;
			return;
		}
		root.innerHTML = postings
			.map((p) => {
				const lines = p.lines
					.map((l) => {
						const is_credit = flt(l.credit) > 0;
						return `
						<div class="salon-je-line ${is_credit ? 'credit' : ''}">
							<span>${frappe.utils.escape_html(l.account)}</span>
							<span class="amt">${flt(l.debit) ? format_currency(l.debit) : ''}</span>
							<span class="amt">${flt(l.credit) ? format_currency(l.credit) : ''}</span>
						</div>
					`;
					})
					.join('');
				return `
					<div class="salon-je-card">
						<div class="salon-je-head">
							<span>${frappe.utils.escape_html(p.voucher_type)} &middot; ${salon_common.doc_link(frappe.router.slug(p.voucher_type), p.voucher_no)}</span>
							<span class="sub">${p.lines[0] ? frappe.datetime.str_to_user(p.lines[0].posting_date) : ''}</span>
						</div>
						${lines}
					</div>
				`;
			})
			.join('');
	}
}

function flt(v) {
	return parseFloat(v) || 0;
}
