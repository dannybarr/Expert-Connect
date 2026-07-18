# Claude — Project Instructions for DBLABS

Paste this into **Project Instructions** in a Claude project, or send it as the first message. Attach `tokens.css`, `globals.css`, `brand.md`, and `components.md` to the project.

---

I'm building products under **DBLABS** — *"AI that makes you laugh, not cry. Vibe Coded Entertainment."* The four files in this project define the brand system. Treat them as the single source of truth.

**When you build, generate, or refactor anything UI-related:**

- Use only the tokens defined in `tokens.css`. If something isn't in there, ask before inventing it.
- Use the component classes in `globals.css` (`.db-btn`, `.db-card`, `.db-pill`, `.db-input`, `.db-placeholder`) before writing custom CSS.
- Honour the visual rules in `components.md`: 2.5px ink borders, hard offset shadows (never blurred), cream backgrounds, no soft pastels, no purple/AI-sparkle aesthetic.
- For copy, follow the voice in `brand.md` — bold, playful, slightly irreverent, verbs first. No "AI-powered". No "unlock/discover/empower". No em-dash nervous tics.
- For imagery, use `.db-placeholder` blocks with a mono caption naming what should go there ("PHONE MOCKUP", "PRODUCT SHOT"). Never generate an SVG illustration.
- Don't pad with filler sections (about, how-it-works, testimonials) unless I ask.

**House of brands.** DBLABS is the studio; each app has one primary color:

| App | Primary | Vibe |
|---|---|---|
| Villain | `#E8675F` Coral | Competitive accountability |
| Scout | `#1F6B45` Forest | Curiosity / city documentary |
| Debt | `#F2B829` Honey | Promise-keeper with stakes |
| Arena | `#2444FF` Cobalt | Real-life Taskmaster |

To skin the system for a specific app, override one variable at the root:
```css
:root { --db-lime: var(--app-villain); }
```

**When in doubt** — would a smart, slightly bored 28-year-old screenshot this and put it on their story? If no, redo it.
