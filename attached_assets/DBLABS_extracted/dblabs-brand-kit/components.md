# DBLABS — Components Spec

Every component in DBLABS shares the same anatomy: a **2.5px ink border**, a **hard offset shadow** for tappable surfaces, and **display type for labels** with mono type for tickers/meta. Below are the canonical pieces. Match them.

> All examples assume `tokens.css` + `globals.css` are loaded.

---

## Button — `.db-btn`

Loud, confident, lime by default. Pressed state slams down — `translate(2px, 2px)` and a shrunken shadow.

```html
<button class="db-btn">Go do something</button>
<button class="db-btn ink">Skip</button>
<button class="db-btn coral">Pay up</button>
<button class="db-btn ghost">Maybe later</button>
<button class="db-btn pill sm">Filter</button>
```

| Modifier | Effect |
|---|---|
| `.ink` | Black background, cream text — secondary CTA |
| `.coral` / `.honey` | App-flavored CTA |
| `.ghost` | Transparent fill, ink border — tertiary |
| `.pill` | `border-radius: 999px` — used for tickers and filter chips |
| `.sm` | Compact size |

---

## Input — `.db-input`

Always paired with a **left-aligned, display-weight label** above it.

```html
<label class="mono">What should we call you?</label>
<input class="db-input" placeholder="danny" />
```

Focus state stacks a **lime shadow under the ink shadow** — the input feels selected without losing the hard edge.

---

## Card — `.db-card`

The default container for any standalone block. Borders + hard shadow are non-negotiable.

```html
<div class="db-card">
  <h3>Ping Pong Power Hour</h3>
  <p>5 active quests · Track</p>
</div>
```

---

## Pill / Chip — `.db-pill`

Used for tags, status, filter rows, and **anything that needs to read like a sticker**. Display font, ALL CAPS, mono-flavoured letter-spacing.

```html
<span class="db-pill lime">★ Side Quest</span>
<span class="db-pill coral">Active</span>
<span class="db-pill ink">5 active</span>
<span class="db-pill">London · 9mi</span>
```

---

## App badge (house-of-brands)

When a DBLABS app appears as a tile in marketing or a hub screen, use a pill colored by the app's primary, with the app name in display weight.

```html
<a class="db-pill" style="background: var(--app-villain);">Villain</a>
<a class="db-pill" style="background: var(--app-scout); color: var(--db-cream);">Scout</a>
<a class="db-pill" style="background: var(--app-debt);">Debt</a>
<a class="db-pill" style="background: var(--app-arena); color: var(--db-cream);">Arena</a>
```

---

## Image placeholder — `.db-placeholder`

Used **everywhere** a real photograph isn't in yet. Diagonal-stripe fill, mono caption explaining what should go there.

```html
<div class="db-placeholder" style="aspect-ratio: 4/5;">
  PRODUCT SHOT — VILLAIN HERO
</div>
```

**Rule:** never replace a placeholder with a generated illustration. Replace it with a real photo, or leave the placeholder. The placeholder is part of the aesthetic.

---

## Layout rules

- **Page background:** always `--db-bg` (cream). Never white.
- **Section padding:** vertical `--s-9` (96px) on desktop, `--s-7` (48px) on mobile.
- **Max content width:** ~1180px, centered.
- **Card spacing:** `--s-5` (24px) gap between cards in a row.
- **Border radius hierarchy:** pills (`--r-pill`) for status / nav, `--r-md` for cards/buttons, `--r-lg` only for hero blocks.

## Don'ts

- ❌ Don't use any radius `> --r-lg` — soft = childish.
- ❌ Don't use drop shadows with blur. The shadow is always **hard offset**, no blur, ink color.
- ❌ Don't use gradients except for image stripe-placeholders.
- ❌ Don't introduce new colors — pick from the token list or swap an app primary.
- ❌ Don't put two app primaries in the same screen. One screen = one app's color.
