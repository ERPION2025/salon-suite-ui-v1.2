# Salon Suite UI — version 1.2

A booking, stylist-commission and stock-consumption suite for ERPNext,
built as an installable Frappe app (module `Salon`, app name `salon`).

Forked from [`ERPION2025/ERPNext-Upgraded-UI-Salon`](https://github.com/ERPION2025/ERPNext-Upgraded-UI-Salon)
at `main` (full history preserved) — that repo is left untouched; this
one carries the full-site UI work forward as its own line.

Covers:

- **Salon Booking** — client + stylist + services, auto totals. On
  completion (status → Completed) it hands off to POS rather than
  billing anything itself: it creates a *draft* POS-flagged Sales
  Invoice (or redeems a Package Subscription) for the branch's POS
  Profile, and a Stock Entry for any consumables from a matching Salon
  Service Recipe. Revenue and the stylist's commission (Additional
  Salary, `Service Commission` component) only get created once a
  cashier actually submits that invoice in POS — see
  `salon/salon/events.py`.
- **Salon Stylist** — one per Employee, with commission % and branch
  (Cost Center).
- **Salon Service Recipe** / **Recipe Consumable** — raw materials a
  service consumes, for automatic stock deduction.
- **Package Subscription** — prepaid session packages redeemed by bookings.
- **Twelve fully custom pages** — every sidebar entry except one is
  now our own page, not a native Desk view:
  **Dashboard** (`/app/salon-dashboard`), **Calendar**
  (`/app/salon-calendar`, drag-to-reschedule grid + Kanban board),
  **All Bookings** (`/app/salon-bookings`), **Client 360°**
  (`/app/salon-client-360`), **Loyalty** (`/app/salon-loyalty`, tier
  cards from your real Loyalty Program), **Packages**
  (`/app/salon-packages`, pricing cards + active subscriptions),
  **Services** (`/app/salon-services`), **Stylists & Employees**
  (`/app/salon-stylists`, roster + today's Attendance), **Stock &
  Consumables** (`/app/salon-stock`), **Payroll & Commissions**
  (`/app/salon-payroll`, month-to-date commission per stylist), **GL
  Postings** (`/app/salon-gl`, narrated journal cards), and **P&L by
  Branch** (`/app/salon-pnl`, simplified Revenue/Expense from GL Entry
  — see the page itself for what it deliberately leaves out, with a
  link to the real Financial Statement report for anything audited).
  **POS & Invoicing is the one deliberate exception** — it routes to
  ERPNext's native Point of Sale register (`/app/point-of-sale`) for
  every role, by design, not a custom page and never the Sales Invoice
  list.
- **`Salon User` role** (`salon/setup.py`, run via `after_migrate` —
  not a hand-written fixture, since `Custom DocPerm` autonames via an
  unpredictable hash) — grants exactly the doctype access the 12 pages
  need (Customer, Item, Sales Invoice incl. submit, Stock Entry, Bin,
  GL Entry, Loyalty Program, Attendance, POS Profile/Opening/Closing
  Entry, Cost Center, Warehouse) and nothing else. Its own `home_page`
  field points at `/app/salon-dashboard`, so Salon User lands there on
  login — System Manager and any other role keep Frappe's normal
  default landing page, untouched.
- **Full-chrome mode** — Frappe's own navbar, breadcrumbs, and desk
  sidebar are hidden site-wide, but **only for the `Salon User` role
  specifically** (`salon/public/js/salon_common.js` + the
  `.salon-full-chrome` rules in `salon.css`) — not "everyone except
  System Manager." A general ERPNext user with no salon role at all
  keeps their normal experience too.
- **Client preferences** — `Customer` gained 6 Custom Fields (stylist
  preference, color formula, allergies, birthday — see
  `salon/fixtures/custom_field.json`) backing Client 360's Preferences
  panel.
- **Store-scoped permissions** (`salon/salon/permissions.py`) — System
  Managers see every branch; everyone else (cashiers, stylists) only
  ever sees their own branch's bookings, both in the custom
  Dashboard/Calendar and in the native Salon Booking list/reports. A
  user's branch is resolved from their assigned POS Profile, falling
  back to their Salon Stylist record.

## Requirements

- **Frappe / ERPNext v16** (bench branch `version-16`).
- **Frappe HR (`hrms`)** — required. Since ERPNext v14, HR/Payroll
  doctypes (`Employee`, `Salary Component`, `Additional Salary`) live in
  the separate [frappe/hrms](https://github.com/frappe/hrms) app, not in
  ERPNext core. This app declares `required_apps = ["erpnext", "hrms"]`
  in `hooks.py`, so both must be on the bench/site before installing.

## Deploying on Frappe Cloud

1. Push this repo to GitHub (already at
   `ERPION2025/ERPNext-Upgraded-UI-Salon`) with a branch matching your
   bench's Frappe version, e.g. `main` or `version-16`.
2. In the Frappe Cloud dashboard, open your bench group → **Apps** →
   **Add App** → **GitHub**, and point it at this repo/branch. Frappe
   Cloud will detect the `salon` app from `pyproject.toml` at the repo
   root and build it into the bench along with `erpnext` and `hrms`
   (add `hrms` to the bench group first if it isn't already there).
3. Deploy the bench, then on your site: **Install App** → `Salon`.
4. Run one-time master data setup (below), then visit
   `/app/salon-dashboard`.

### Local bench (alternative)

```bash
bench get-app salon https://github.com/ERPION2025/ERPNext-Upgraded-UI-Salon --branch main
bench --site your-site.com install-app hrms   # if not already installed
bench --site your-site.com install-app salon
bench --site your-site.com migrate
bench build --app salon
bench restart
```

## One-time master data (no code, just Desk records)

- A **Salary Component** named exactly `Service Commission`
  (Payroll > Salary Component) — the commission automation posts to this.
- A **Salary Structure** that includes `Service Commission`, with a
  **Salary Structure Assignment** for every stylist Employee — required
  by Frappe HR before any Additional Salary can be created for them.
- A **Salon Stylist** record per Employee, with `commission_rate` and
  `cost_center` set.
- A **Cost Center** per branch, and a **Warehouse** per branch if you
  want stock deduction working.
- A **POS Profile** per branch, with its `Cost Center` set to that
  branch's Cost Center and at least one payment method configured.
  This is what a completed booking's draft invoice is billed through,
  and what a non-admin user's branch access is resolved from (via
  *POS Profile → Applicable for Users*).
- Before any booking can be completed for a branch, that branch's POS
  Profile needs an **open POS Opening Entry** (POS > New, the normal
  daily "open the till" step a cashier does) — Frappe itself requires
  this before it will accept a POS-flagged invoice.
- Optional: a **Salon Service Recipe** per service Item, listing the raw
  materials it consumes — only services with a recipe generate a Stock
  Entry on completion.
- Assign the **Salon User** role to each front-desk/stylist account
  (User → Roles). The role itself, and what it can access, ships with
  the app (`salon/setup.py`) — this is the one remaining manual step,
  since deciding which humans get it isn't something a fixture can do.
  Don't also give these accounts "System Manager" — that overrides
  full-chrome mode and the salon-only landing page.
- Tag package Items with Item Group `Packages`, and mark each
  non-stock service Item's `Is Stock Item = 0` — both are how the
  Packages and Services pages tell package Items apart from bookable
  services.

## Branding

`salon/public/css/salon.css` uses placeholder hex values (`#e4002b` red,
white surfaces). Swap these for your actual theme tokens so the salon
suite matches the rest of your ERPNext instance.

## Extending

All 12 sidebar entries are custom pages except POS & Invoicing, which
deliberately stays on ERPNext's native Point of Sale register. Adding
another one follows the same pattern every page here uses — a Page
record + a JS file rendering into `page.body` + a whitelisted method in
`salon/api.py`, using `salon_common.render_sidebar_html(key)` for the
sidebar. If it touches a doctype `Salon User` doesn't already have a
grant for, add that doctype to the `GRANTS` list in `salon/setup.py` —
it'll pick it up on the next `bench migrate`, no manual Custom DocPerm
needed.

### Known simplifications, stated plainly
- **P&L by Branch** aggregates GL Entry directly by account — it does
  not replicate ERPNext's full Financial Statement engine (no budgets,
  no prior-year comparison, no multi-currency). Treat it as an at-a-
  glance view; the page itself links to the real report for anything
  that needs to be audited or shared externally.
- **Payroll & Commissions** shows accrued `Additional Salary` entries
  (the `Service Commission` component), not a full Salary Slip
  earnings breakdown. Run normal Payroll for the authoritative payslip.
- **Stylists & Employees**' attendance table reads the native
  `Attendance` doctype directly (status/in_time/out_time/working_hours)
  — there's no native "hours booked vs. worked" utilisation metric, so
  that's not shown; building it would mean defining what "booked
  hours" means yourselves first (e.g. against a shift/roster doctype
  that doesn't exist yet).
