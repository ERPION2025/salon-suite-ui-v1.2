frappe.pages['salon-home'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: '', single_column: true });
	wrapper.classList.add('salon-suite');
	new SalonHome(page);
};

// The Salon Suite home: a module grid (one tile per screen the user may
// open). Every tile opens the existing custom screen.
class SalonHome {
	constructor(page) {
		this.page = page;
		this.body = page.body.get(0);
		this.render();
	}

	greeting() {
		const h = new Date().getHours();
		if (h < 12) return __('Good morning');
		if (h < 17) return __('Good afternoon');
		return __('Good evening');
	}

	render() {
		const esc = frappe.utils.escape_html;
		const tiles = salon_common
			.tiles()
			.map(
				(
					t,
				) => `<a class="sg-app" ${salon_common.link_attrs(t)} data-name="${esc((t.tile || t.label).toLowerCase())} ${esc(
					t.label.toLowerCase(),
				)}">
					<span class="sg-tile">${salon_common.icon(t.key)}</span>
					<span class="sg-label">${esc(t.tile || t.label)}</span>
				</a>`,
			)
			.join('');
		const today = new Date().toLocaleDateString(undefined, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});
		this.body.innerHTML = `
			<div class="salon-shell salon-home-shell">
				<div class="sg-home">
					<header class="sg-topbar">
						<div class="sg-brand"><span class="sg-dot"></span>Salon Suite</div>
						<label class="sg-search">
							<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M11 11l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
							<input type="search" id="sg-search" placeholder="${__('Search modules…')}" autocomplete="off">
						</label>
						<div class="salon-topbar-right">${salon_common.render_user_menu()}</div>
					</header>
					<div class="sg-greet">
						<b>${this.greeting()}, ${esc((frappe.session.user_fullname || '').split(' ')[0] || '')}</b>
						${esc(today)}
					</div>
					<nav class="sg-grid" id="sg-grid">${tiles}</nav>
					<p class="sg-empty" id="sg-empty" hidden>${__('No module matches your search.')}</p>
				</div>
			</div>`;
		salon_common.fill_branch_soon();

		const input = this.body.querySelector('#sg-search');
		input.addEventListener('input', () => {
			const q = input.value.trim().toLowerCase();
			let shown = 0;
			this.body.querySelectorAll('.sg-app').forEach((a) => {
				const hit = !q || a.dataset.name.includes(q);
				a.hidden = !hit;
				if (hit) shown += 1;
			});
			this.body.querySelector('#sg-empty').hidden = shown > 0;
		});
		input.addEventListener('keydown', (e) => {
			if (e.key !== 'Enter') return;
			const first = [...this.body.querySelectorAll('.sg-app')].find((a) => !a.hidden);
			if (first) first.click();
		});
	}
}
