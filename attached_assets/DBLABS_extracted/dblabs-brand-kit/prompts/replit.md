# Replit Agent — Prompt for DBLABS apps

Paste this into the Replit AI sidebar at the start of a new Repl. Upload `tokens.css`, `globals.css`, `brand.md`, and `components.md` to the project root before sending.

---

You are scaffolding a consumer app for **DBLABS** — tagline *"AI that makes you laugh, not cry. Vibe Coded Entertainment."* Use the four files I've added at the project root as the source of truth for the visual system and voice.

**Setup steps to do first:**

1. Move `tokens.css` and `globals.css` into `src/styles/` (or `public/` for a static project).
2. Add a `<link>` to Google Fonts in the HTML head — families: **Space Grotesk** (weights 400/500/600/700), **Inter** (400/500/600/700), **JetBrains Mono** (400/500/600).
3. Import both stylesheets at the app entry point.
4. Set `<body data-theme="light">` and use `data-theme="dark"` to flip.

**When generating any UI:**

- Use the CSS variables defined in `tokens.css` for every color, type, radius, and shadow. **Never hardcode hex values.**
- Use the component classes from `globals.css` (`.db-btn`, `.db-card`, `.db-pill`, `.db-input`, `.db-placeholder`) before writing custom CSS.
- Background is **cream** (`var(--db-bg)`), not white.
- Borders are **2.5px solid `var(--db-line)`**. Shadows are **hard offset** — `var(--shadow-hard)`.
- Copy voice: bold, playful, verbs-first. Read `brand.md` for examples and the do/don't table.
- Skip filler sections (about, testimonials, "how it works") unless I ask for them.

**House-of-brands rule:** when scaffolding a specific app (Villain / Scout / Debt / Arena), add a top-level override at the root:

```css
:root { --db-lime: var(--app-villain); }   /* or --app-scout, etc. */
```

This re-skins every component built on the lime primary without touching any other code.
