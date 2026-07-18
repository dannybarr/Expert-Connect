# DBLABS Brand Kit

A drop-in design system for shipping DBLABS apps in **Lovable**, **Replit**, **Claude**, or any web stack.
The goal: every product that ships under the DBLABS roof feels like it came from the same studio,
without you having to redesign the basics each time.

> **DBLABS — AI that makes you laugh, not cry. Vibe Coded Entertainment.**

---

## What's inside

| File | What it is | Where to drop it |
|---|---|---|
| `brand.md` | Voice, personality, do/don't, sample copy | Paste into Claude or Lovable as a system prompt |
| `tokens.css` | All color / type / spacing / radius / shadow variables as plain CSS custom properties | Import once at the root of any project |
| `globals.css` | Opinionated base styles + component classes (buttons, cards, pills, inputs) built on top of `tokens.css` | Import after `tokens.css` |
| `tokens.json` | Same tokens, serialised for Style Dictionary / Figma Tokens / scripted pipelines | Source of truth for any token transform |
| `tailwind.config.js` | A Tailwind preset extending the default theme with DBLABS tokens | `presets: [require('./tailwind.config.js')]` |
| `components.md` | Spec for the core component vocabulary (button, card, chip, input, app pill) | Reference doc — paste into prompts when you need fidelity |
| `prompts/lovable.md` | Copy-paste system prompt for Lovable | New Lovable project → System Prompt |
| `prompts/replit.md` | Copy-paste prompt for Replit Agent | Replit AI sidebar |
| `prompts/claude.md` | Copy-paste prompt for Claude / claude.ai | Project Instructions or first message |

---

## The 60-second setup

### Lovable / Replit / Claude (no-code path)

1. Open `prompts/<tool>.md`. Copy the entire file.
2. Paste it into the System Prompt / Project Instructions / first message of your new app.
3. In the same message, attach `tokens.css`, `globals.css`, `brand.md`, and `components.md`.
4. Ask for what you want ("Build the onboarding screen for Villain") — the model now knows the brand.

### Hand-coded React / Next.js path

```bash
# Drop the four files into your project
cp tokens.css globals.css tokens.json tailwind.config.js  src/styles/

# Import once at the root (app/layout.tsx, _app.tsx, or main.tsx)
import './styles/tokens.css';
import './styles/globals.css';
```

If you use Tailwind, point at the preset:

```js
// tailwind.config.js
module.exports = {
  presets: [require('./src/styles/tailwind.config.js')],
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
};
```

Now `bg-db-lime`, `text-db-ink`, `border-db-line`, `shadow-hard`, `font-display`, `font-mono` etc. all work.

---

## House-of-brands rules

DBLABS is the studio; each app has its own primary color but **inherits everything else** from this kit.

| App | Primary | Vibe |
|---|---|---|
| **Villain** | `--app-villain` `#E8675F` | Competitive · rival-driven |
| **Scout** | `--app-scout` `#1F6B45` | Curiosity · documentary |
| **Debt** | `--app-debt` `#F2B829` | Stakes · promise-keeper |
| **Arena** | `--app-arena` `#2444FF` | Chaos · real-life Taskmaster |

To re-skin the system for an app, override **one** variable:

```css
:root { --db-lime: var(--app-villain); }
```

That single swap rolls through every button, badge, pill, and accent in the system.

---

## What "world-class" means here

- **No invented tokens.** Every value in this kit is used by a real component in the brand system.
- **Direct-edit friendly.** All copy and color choices live in plain CSS variables — no SCSS, no JS theme objects, no build step required.
- **Tool-portable.** Same tokens, three formats (CSS, JSON, Tailwind) so the kit follows you across stacks.
- **Brand voice baked in.** `brand.md` is written in the voice. The model reads it and writes the same way.
- **House of brands ready.** One swap re-skins everything; the rest of the system holds the family resemblance.

---

## License & ownership
DBLABS internal. Don't ship it as a public template without redaction.
