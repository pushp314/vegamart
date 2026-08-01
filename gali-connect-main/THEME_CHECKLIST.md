# Paper & Ink — Theme Regression Checklist

A quick pre-ship pass to catch theme drift. Visit `/theme-check` in the
running app for a live visual harness that renders every token, primitive,
and marketplace surface on one page.

## 1. Tokens (no literal colors)

- [ ] Grep for banned literal utilities returns nothing in `src/`:
      `text-white`, `bg-white`, `text-black`, `bg-black`,
      `emerald-`, `indigo-`, `purple-`, `violet-`, `rose-`, `pink-`,
      `amber-` (except intentional saffron/warning), `slate-`, `gray-`, `zinc-`, `neutral-`.
- [ ] No inline `style={{ color: "#..." }}` / `background: "#..."` except
      when reading a CSS variable via `var(--token)`.
- [ ] Every new component uses semantic tokens: `bg-background`,
      `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`,
      `border-border`, `ring-ring`.

## 2. Typography

- [ ] Headings (`h1`–`h6`, `.font-display`) render **Space Grotesk**.
- [ ] Body text renders **DM Sans**.
- [ ] Editorial italic accents use `font-serif italic` (fallback stack).
- [ ] Code / SKUs use `font-mono`.

## 3. Brand hierarchy

- [ ] Primary CTA = **ink on paper** (`bg-foreground text-background` or
      shadcn default `Button`), not emerald.
- [ ] Emerald (`--brand`) reserved for status dots, small accents, links.
- [ ] Saffron (`--saffron`) reserved for offers / promotional tags.

## 4. Surfaces & elevation

- [ ] Cards: `bg-card` + `border border-border`, optional `shadow-soft`.
- [ ] Overlays / sheets use `bg-background` or `bg-card`, never `bg-white`.
- [ ] Dividers use `border-border` or `divide-border`.

## 5. Mobile grid & density

- [ ] Vendor / product grids render **2 columns** on `<640px`, 3 at `md`,
      4 at `lg`.
- [ ] Cards fit at 360px viewport without horizontal scroll.
- [ ] Bottom nav clears content via `pb-safe` / bottom padding on pages
      that end near the fold.

## 6. Accessibility

- [ ] Focus rings use `ring-ring` (ink).
- [ ] Contrast ratio ≥ 4.5:1 for body text against `--background`.
- [ ] Interactive elements ≥ 40×40px hit area on mobile.

## 7. Auth routes — `/login`, `/signup`

- [ ] Page background is `--paper`, text is `--ink`.
- [ ] Desktop left panel is a solid `--ink` block with a paper-on-ink grid
      motif and Chapter kicker (`Chapter 01 — Welcome` / `Chapter 02 — Join`).
- [ ] Kicker uses Space Grotesk, `text-[10px] uppercase tracking-[0.24em]`.
- [ ] H1 pairs Space Grotesk bold with a `font-serif italic` accent word
      (`Welcome back`, `Create your account`).
- [ ] Mobile number field: bordered container, `+91` in a bordered span —
      NOT a rounded-xl gradient pill or `bg-brand` chip.
- [ ] Primary CTA is `background: --ink; color: --paper;` with sharp
      corners. Never `bg-brand`, `bg-gradient-brand`, or `rounded-xl`.
- [ ] Google / Apple buttons are bordered paper, `border-color: --ink/30`.
- [ ] `/login` cross-links to `/signup` and vice-versa (no self-link).
- [ ] Both routes list in `/theme-check` under §auth and pass the six
      route-specific flags rendered there.

## 8. Order flow — `/cart`, `/checkout`, `/orders`, `/order-success`

- [ ] Every page opens with an editorial masthead kicker
      (`Ledger · Issue 01`, `Receipt · Issue 01`) — rule + label in
      Space Grotesk `tracking-[0.24em]`.
- [ ] Numerics (order ID, totals, ETA, timestamps) use `tabular-nums`.
- [ ] `/orders` active-order chip is `bg: --ink; color: --paper;` — NOT
      `bg-secondary text-brand` or an emerald pill.
- [ ] Timeline dots: `--ink` when done, `--ink/12` for pending. No
      `bg-brand` ring.
- [ ] `/orders` past-orders renders as a numbered `<ol>` with hairline
      dividers (`--ink/10`), not shadow-soft cards.
- [ ] `/order-success` confirmation mark is `bg: --ink` with a `--paper`
      ring, NOT `bg-gradient-brand shadow-glow`.
- [ ] Track / Continue actions: exactly one solid-ink CTA and one
      bordered-paper CTA, sharp corners.
- [ ] Map placeholder in `/orders` uses the `--ink/8%` grid, pins are
      ink+paper — no emerald gradients.
- [ ] All four routes list in `/theme-check` under §orders and pass the
      six route-specific flags rendered there.

## 9. Search overlay (Navbar ⌘K)

- [ ] Panel renders on `--paper` with a `--ink/12` border, sharp corners
      on mobile (`border`, not `rounded-3xl`).
- [ ] Header carries the `Directory · Search` kicker and `Vol. 01`.
- [ ] Search icon square is `bg: --ink; color: --paper;` — never
      `bg-gradient-brand`.
- [ ] Trending / category chips are bordered paper with tabular numbered
      prefixes (`01`, `02`…), NOT `from-secondary to-saffron/10`.
- [ ] Product / vendor suggestions render as bordered `<ol>` rows with
      index numbers, not `rounded-xl` cards.
- [ ] Highlighted match uses `bg: --ink; color: --paper;` `<mark>` — not
      `bg-secondary text-brand`.

## 10. Route sweep (open each on mobile + desktop)

- `/`
- `/vendors`
- `/vendors/$vendorId`
- `/products/$productId`
- `/cart`
- `/checkout`
- `/order-success`
- `/orders`
- `/wishlist`
- `/login`
- `/signup`
- `/theme-check` (this harness)

For each: confirm Navbar, page body, cards, CTAs, and Footer all read as
Paper & Ink. Flag anything that looks generic / emerald-first / neon.

## 11. Quick shell sweep

```bash
rg -n '\b(text|bg|border|from|to|via)-(white|black|emerald|indigo|purple|violet|rose|pink|slate|gray|zinc|neutral)(-|\b)' src
rg -n '#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b' src/components src/routes
```

Both should return only intentional matches (e.g. `mock-data.ts` image URLs,
comments). Anything else is a regression.
