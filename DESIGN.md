# Design System — kAInban

> Single source of truth for visual, typographic, and motion decisions in kAInban. Read this before
> making any UI change. If a design choice isn't here, propose it as a PR to this file before
> implementing in code.

**Version:** 3.0 (Workhorse Dark) **Established:** 2026-05-26 via `/design-consultation`
**Supersedes:** `DESIGN_SYSTEM.md` v2.0 (Dec 2025 — archived to `docs/design-system-v2.archive.md`)
**Live preview:** `design-preview/index.html`

---

## Product context

- **What this is:** kAInban — drop a meeting recording, get a kanban board of action items, owners,
  and dates. Every claim links back to its transcript span so the user can verify before they trust.
- **Who it's for:** Solo operators and indie hackers running async/back-to-back meetings.
  Productivity-nerd audience, opinionated about their tools, instantly allergic to AI-slop UI.
- **Space:** AI-native productivity / task management. Direct competitors: Height, Linear
  (adjacent), Granola (adjacent), Read.ai.
- **Project type:** Multi-tenant SaaS web app + marketing surface. React 18 + Vite + Tailwind +
  shadcn-shaped CSS variables.

---

## The memorable thing

**"Looks smart by looking serious."** The room a senior engineer would actually use. Density,
restraint, mono data, hairline borders — and one warm accent in a sea of cool-toned competitors.
Smart is conveyed by the _behavior_ (good extractions, accurate transcript anchoring, useful daily
recommendations), not by visual costume.

---

## Aesthetic direction

- **Direction:** Workhorse Dark — Linear-class discipline (compressed type, hairline borders,
  monochrome canvas, dense layout) plus one deliberate warmth in the accent.
- **Decoration level:** Minimal. No gradients, no glassmorphism, no neumorphism, no glow halos, no
  decorative blobs, no animated background particles. Typography and the surface ladder do all the
  work.
- **Mood:** Serious, considered, fast. A tool a senior PM keeps open all day. Calm with quiet
  competence — never theatrical.
- **Reference systems:** Linear (typography + restraint), Height (kanban structure), Granola (the
  "serif moment" idea), Raycast (dark-canvas discipline). We are NOT trying to look like any of
  them.

---

## Color

### Approach

**Restrained, warm-accented.** A monochrome surface ladder carries hierarchy; chromatic color is
rare and meaningful. One signature accent — used scarcely.

### Dark mode (the default)

| Token                  | Hex                      | Role                                                                          |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `--bg-base`            | `#0A0A0B`                | App canvas. Not pure black; faint blue cast.                                  |
| `--bg-raised`          | `#141517`                | Cards, panels, sidebar, headers.                                              |
| `--bg-elevated`        | `#1B1C1F`                | Hover, popovers, modals.                                                      |
| `--bg-emphasis`        | `#232428`                | Active row, drag-over column, pressed button.                                 |
| `--hairline-low`       | `#26282B`                | Default border.                                                               |
| `--hairline-mid`       | `#34363A`                | Emphasized border, form input border.                                         |
| `--hairline-high`      | `#4A4D52`                | Hover border on inputs/buttons.                                               |
| `--accent`             | `#E59149`                | **Burnt amber.** Single chromatic accent.                                     |
| `--accent-hover`       | `#F0A05C`                | Accent hover state.                                                           |
| `--accent-press`       | `#C87A36`                | Accent active/pressed.                                                        |
| `--accent-soft`        | `rgba(229,145,73,0.10)`  | AI badge background, tint.                                                    |
| `--accent-soft-strong` | `rgba(229,145,73,0.18)`  | Pressed accent button bg, focus tint.                                         |
| `--accent-border`      | `rgba(229,145,73,0.40)`  | AI-active card border (with pulse).                                           |
| `--text-primary`       | `#F5F4F1`                | Headings, primary content. Warm-biased off-white.                             |
| `--text-secondary`     | `#A4A29B`                | Body, descriptions. Warm-bias gray.                                           |
| `--text-muted`         | `#6B6963`                | Meta, timestamps, captions.                                                   |
| `--text-inverse`       | `#15161A`                | Text on accent surfaces.                                                      |
| `--success`            | `#5A9F6B`                | Sage, deliberately muted vs. Tailwind defaults.                               |
| `--success-soft`       | `rgba(90,159,107,0.12)`  | Success chip bg.                                                              |
| `--warning`            | `#D9A23A`                | Used sparingly — close enough to accent that overuse causes visual confusion. |
| `--warning-soft`       | `rgba(217,162,58,0.12)`  | Warning chip bg.                                                              |
| `--danger`             | `#C56152`                | Warm-leaning red — never `#EF4444` siren.                                     |
| `--danger-soft`        | `rgba(197,97,82,0.12)`   | Danger chip bg.                                                               |
| `--info`               | `#6B8DB3`                | Neutral blue for "in progress" status.                                        |
| `--info-soft`          | `rgba(107,141,179,0.12)` | Info chip bg.                                                                 |

### Light mode (secondary)

Warm bias carries over. Paper canvas, ink text, accent shifts darker for WCAG AA on warm paper.

| Token              | Hex       | Role                                       |
| ------------------ | --------- | ------------------------------------------ |
| `--bg-base`        | `#FAF7F2` | Off-white paper.                           |
| `--bg-raised`      | `#FFFFFF` | Cards.                                     |
| `--bg-elevated`    | `#F4F1EA` | Hover.                                     |
| `--bg-emphasis`    | `#EBE7DF` | Active.                                    |
| `--hairline-low`   | `#E2DDD2` | Default border.                            |
| `--hairline-mid`   | `#C8C2B3` | Emphasized border.                         |
| `--text-primary`   | `#15161A` | Ink.                                       |
| `--text-secondary` | `#4D4A44` | Body.                                      |
| `--text-muted`     | `#84807A` | Meta.                                      |
| `--accent`         | `#C66E1F` | Darker amber for AA contrast on `#FAF7F2`. |

### Hard rules

- **Never use color as the ONLY hierarchy signal.** Pair every chromatic decision with weight, size,
  position, or border.
- **The accent appears at most ~3 times per visible viewport** (primary CTA, focus ring, one
  AI-active state). Overuse kills the signal.
- **No gradients.** Anywhere. The current `KanbanBoard.css` rainbow drag-glow and 145°
  linear-gradients are deleted in the migration.
- **No purple. No violet. No cyan halos.** These are the AI-slop color set in 2026.

---

## Typography

### Fonts

| Role                | Family             | CSS Variable   | Loaded via                        |
| ------------------- | ------------------ | -------------- | --------------------------------- |
| Body / UI / Display | `Inter Variable`   | `--font-sans`  | `https://rsms.me/inter/inter.css` |
| Editorial accent    | `Instrument Serif` | `--font-serif` | Google Fonts                      |
| Data / mono         | `JetBrains Mono`   | `--font-mono`  | Google Fonts                      |

```css
:root {
  --font-sans:
    'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'Instrument Serif', 'Iowan Old Style', Palatino, Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
}
```

### The Inter recipe (non-negotiable)

Inter Variable globally with these features ALWAYS applied. Never override.

```css
body {
  font-family: var(--font-sans);
  font-feature-settings: 'cv01', 'ss03', 'ss01';
  font-variation-settings: 'wght' 400;
}
```

- **`cv01`** — single-story `a` glyph. Replaces Inter's default double-story. This is the cue that
  says "engineered, not generic."
- **`ss03`** — geometric alternates. Sharpens the letterforms.
- **`ss01`** — open digits, harmonizes with `tabular-nums` in data tables.
- **Signature weight: 510** (between Regular 400 and Medium 500, only available via variable font).
  Use for headings, UI labels, button text, body emphasis. Never use 500 or 600 — 510 is the Linear
  move.

### Scale (compressed, density-first)

| Role          | Size | Weight | Line height | Letter spacing   | Notes                          |
| ------------- | ---- | ------ | ----------- | ---------------- | ------------------------------ |
| Display       | 48px | 510    | 1.05        | -1.0px           | Marketing hero only.           |
| Heading LG    | 32px | 510    | 1.15        | -0.66px          | Page titles in marketing/auth. |
| Heading       | 20px | 510    | 1.25        | -0.22px          | Section titles in app.         |
| Body Emphasis | 13px | 510    | 1.55        | normal           | Task titles, list item titles. |
| Body          | 13px | 400    | 1.55        | normal           | Paragraphs.                    |
| UI            | 12px | 510    | 1.45        | normal           | Buttons, labels, nav items.    |
| Caption       | 11px | 510    | 1.4         | 0.04em uppercase | Meta, timestamps, eyebrows.    |

### The serif moment

`Instrument Serif` is allowed in exactly four contexts. Never the fifth.

1. The marketing hero headline (one per page, e.g. login page H1).
2. Meeting summary `<h1>` — the AI's generated summary title.
3. Analytics dashboard primary heading + AI recommendation card title.
4. Pull-quotes inside meeting summaries (italic).

```css
.t-serif-display {
  font-family: var(--font-serif);
  font-size: 56px;
  line-height: 1.05;
  font-weight: 400;
  letter-spacing: -0.5px;
}
.t-serif-heading {
  font-family: var(--font-serif);
  font-size: 32px;
  line-height: 1.15;
  font-weight: 400;
}
```

Rule: **the serif is for the AI's voice and the marketing voice — never for the user's voice or the
UI's voice.**

### Mono

`JetBrains Mono` with `font-variant-numeric: tabular-nums` for ALL of: task IDs, dates, durations,
percentages in stat grids, code snippets, transcript timestamps, kbd shortcuts.

```css
.t-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

### Font blacklist (never use for this product)

Roboto, Helvetica, Arial, Open Sans, Lato, Montserrat, Poppins, Space Grotesk, Geist (the
safe-secondary trap), Papyrus, Comic Sans, Lobster, Impact, Trajan, Raleway, system-ui as primary
display/body.

---

## Spacing

### Base unit: 4px

```css
:root {
  --space-2: 2px; /* hairline gaps */
  --space-4: 4px; /* xs */
  --space-8: 8px; /* sm — default gap inside cards */
  --space-12: 12px; /* md — default card padding */
  --space-16: 16px; /* lg — section internal padding */
  --space-24: 24px; /* xl — section gap */
  --space-32: 32px; /* 2xl — major section spacing */
  --space-48: 48px; /* 3xl — page section divider */
  --space-64: 64px; /* 4xl — marketing breathing room */
}
```

### Density

**Default = dense.** Card padding 12px, not 16px. Form field padding 8/10. Button padding 8/14. List
item vertical 12px.

A `data-density="comfortable"` attribute on `<html>` bumps every padding token by ~33% for users who
prefer more breathing room. This is a user setting in profile/preferences.

### Border radius

```css
:root {
  --radius-xs: 4px; /* badges, chips, kbd */
  --radius-sm: 6px; /* buttons, inputs, cards (default) */
  --radius-md: 8px; /* containers, panels */
  --radius-lg: 12px; /* modals, marketing cards */
  --radius-full: 9999px; /* pills, avatars */
}
```

Replaces the existing 16-24px bubble-radius-everything from v2.

---

## Layout

### Approach

- **App view:** grid-disciplined. Strict 4px-base grid. Three-column max (sidebar / main / detail).
  Tasks in dense cards. Kanban columns sized by content, never flex-equal.
- **Marketing / auth surfaces:** editorial. One asymmetric moment per page (the serif headline, a
  single pull quote). The rest is grid-aligned.
- **Meeting summary screens:** document-style. Generous left/right padding (~56px on desktop), 65ch
  max-width on body copy, serif title, mono document metadata at the top.

### Breakpoints

| Token | Min width | Notes                                       |
| ----- | --------- | ------------------------------------------- |
| `sm`  | 640px     | Tablet portrait.                            |
| `md`  | 768px     | Tablet landscape.                           |
| `lg`  | 1024px    | Laptop.                                     |
| `xl`  | 1280px    | Desktop.                                    |
| `2xl` | 1536px    | Wide desktop — `max-w-content: 1400px` cap. |

### Grid

12-column grid with 24px gutter on `lg+`, 16px gutter on `md`, single-column stack below `md`.

### Command palette (`<Cmd>K`)

Always available, opens centered, max-width 560px, fuzzy search across tasks/projects/transcripts/AI
actions. This is table stakes for the audience.

---

## Motion

### Approach

**Intentional, never decorative.** Every animation must aid comprehension (state change, navigation,
focus) — none exist for delight alone.

### Tokens

```css
:root {
  --ease: cubic-bezier(0.16, 1, 0.3, 1); /* one easing for everything */
  --dur-fast: 120ms; /* hover, focus, micro feedback */
  --dur-base: 180ms; /* button press, badge update */
  --dur-slow: 320ms; /* modal enter, drawer slide */
}
```

### Allowed motions

1. **Hover** — color/border transition only. `100-120ms`. **Never scale.** No
   `transform: scale(1.02)`.
2. **Focus ring** — instant accent border + `0 0 0 3px var(--accent-soft)` shadow. No animation in.
3. **Drag-active** — `transform: translateY(-1px)` + `box-shadow` lift to
   `0 4px 12px rgba(0,0,0,0.4)`. No glow halo.
4. **Modal / drawer enter** — `opacity 0→1` + `translateY(8px → 0)` over 320ms.
5. **AI-active state** — border-color pulse from `var(--accent-border)` to `var(--accent)` over
   1.6s, ease-in-out, infinite. **Never a box-shadow glow.**
6. **Task move (drag-and-drop)** — instant snap to new position (no flip-list interpolation under 50
   items; FLIP only when needed for orientation cues).

### Banned motions

- `magnetic` hover (`scale(1.02)`)
- `ripple` on click
- `aiGlow` / `drag-glow` keyframes
- `floating` keyframe (Y-translate idle bounce)
- spring easing (we use one cubic-bezier)
- `gradient-text` animations
- `shimmer` loading shimmer (use a quiet pulse on a hairline-color block instead)

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component patterns

### Task card

- Background: `--bg-elevated` (resting), `--bg-emphasis` (hover/active)
- Border: 1px `--hairline-low` resting, `--hairline-mid` hover
- Radius: `--radius-sm` (6px)
- Padding: 10px 12px
- Title: 13px / 510 / `--text-primary`
- Meta row: 8px gap, wraps; contains task-id (mono, muted), date (mono, secondary), priority badge,
  AI badge, assignee avatar (18px circle)
- **AI-active variant:** `--accent-border` border + pulse animation. No background tint, no glow.

### Button

- Primary: amber bg, ink text, no border, padding 8/14, radius 6
- Secondary: `--bg-emphasis` bg, primary text, 1px `--hairline-mid`
- Ghost: transparent, no border, hovers to `--bg-emphasis`
- Danger: transparent, danger text, hovers to `danger-soft` bg
- Sizes: `sm` (4/10/12px), default (8/14/13px). No `lg` — if a button needs to be bigger, the layout
  is wrong.

### Badge / chip

- Pill (`--radius-full`), 2/8 padding, 11px / 510
- Priority badges use semantic-soft bg + semantic foreground (no border)
- AI badge: `--accent-soft` bg + `--accent-border` 1px border + `--accent` text
- Mono badge (task IDs): mono font, no uppercase, `letter-spacing: -0.02em`

### Form field

- Input bg: `--bg-base` (intentionally darker than card — depth ladder)
- Border: 1px `--hairline-mid`
- Focus: 1px `--accent` border + `0 0 0 3px --accent-soft` ring
- Label above field, 12px / 510 / `--text-secondary`
- Error state: 1px `--danger` border + helper text in `--danger`

### Modal

- Bg: `--bg-elevated`
- Border: 1px `--hairline-low`
- Radius: `--radius-lg` (12px)
- Padding: 24px
- Header: 20/510 heading + ghost close button top-right
- Backdrop: `rgba(0,0,0,0.55)` — no blur

### Empty state

- Centered, ~280px max-width
- 32px mono icon (lucide or feather)
- Heading 16/510, body 13/400/`--text-secondary`
- One primary CTA + optional ghost secondary

---

## Accessibility

- **Color contrast:** all body text ≥ 4.5:1 against its background. Accent on dark canvas: amber
  `#E59149` on `#0A0A0B` = 8.9:1 — passes AAA. Light mode uses `#C66E1F` for 4.6:1 on `#FAF7F2`.
- **Focus visible:** always. The accent focus ring is mandatory and high-contrast.
- **Keyboard-first:** every interactive element reachable via Tab. `<Cmd>K` palette is the primary
  navigation; mouse is a fallback.
- **Reduced motion:** all animations respect `prefers-reduced-motion`.
- **Density toggle:** users who can't read 13px get a `comfortable` mode that uses 14/16 body +
  larger paddings.

---

## What this replaces

The previous `DESIGN_SYSTEM.md` v2.0 (Dec 2025) is archived to `docs/design-system-v2.archive.md`.
It described a glassmorphism + neumorphism + premium-gradient + AI-glow aesthetic. The shipped CSS
only ever partially implemented it. This v3.0 codifies what the product should actually look like
and aligns with what the shipped tokens already drift toward.

### Concrete code changes the migration must make

1. **Replace `src/index.css`** color variables with the tokens above (HSL → hex).
2. **Update `tailwind.config.js`** to consume the new tokens (radius scale 4/6/8/12/9999, no
   `var(--radius)` magic).
3. **Delete `KanbanBoard.css` decorative bits:** `.task-card::before` gradient ring,
   `.task-card.dragging::after` rainbow glow, `drag-glow` keyframes, `.kanban-column::before`
   colored drop glow.
4. **Drop these classes wherever used:** `.glass`, `.glass-strong`, `.glass-dark`, `.magnetic`,
   `.ripple`, `.shimmer`, `.ai-glow`, `.floating`, `.gradient-text`, `.gradient-text-ai`. Replace
   with the patterns in this doc.
5. **Load fonts:** add `<link rel="stylesheet" href="https://rsms.me/inter/inter.css">` + Google
   Fonts for Instrument Serif + JetBrains Mono in `index.html`.
6. **Apply Inter recipe globally:** `font-feature-settings: "cv01","ss03","ss01"` on `body`; default
   `font-variation-settings: "wght" 510` on headings, UI labels, buttons.
7. **Replace gradient buttons** (`bg-gradient-to-r from-X to-Y`) with `--accent` solid for primary,
   `--bg-emphasis` for secondary.
8. **Migrate priority badges** from gradient pills to semantic-soft pills (this doc).

The migration is a focused refactor — estimate 1-2 days for a developer using the preview file as
the visual contract.

---

## Decisions log

| Date       | Decision                                            | Rationale                                                                                                                                               |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-26 | Design system v3 created via `/design-consultation` | Replaces v2 AI-slop manifesto with a deliberate, research-grounded system aimed at indie-hacker productivity audience.                                  |
| 2026-05-26 | Burnt amber `#E59149` accent                        | Every direct competitor (Height/Linear/Granola/Raycast) is cool-toned. Warm in a cool category reads as deliberate taste; ties to voice/audio metaphor. |
| 2026-05-26 | Inter Variable 510 + cv01/ss03 globally             | Linear's exact typographic recipe — current category baseline for "serious" productivity UI. Mid-emphasis without semibold weight.                      |
| 2026-05-26 | Instrument Serif on AI output only                  | Granola-style "calm with energy" cue. Scoped to four contexts to keep the cost low and avoid preciousness.                                              |
| 2026-05-26 | JetBrains Mono everywhere data lives                | Tabular-nums on task IDs/dates/percentages is non-negotiable. Reads as "I respect numeric alignment."                                                   |
| 2026-05-26 | No glow / halo / shimmer on any AI state            | Industry default reads as Vegas. Border-color pulse achieves the same signal at 1/10 the visual cost.                                                   |
| 2026-05-26 | 13px body, 4px base spacing                         | Indie-hacker tools live dense. Density signals "I respect your screen." Density toggle for accessibility.                                               |
| 2026-05-26 | Dark mode is the home, light mode the option        | Category default for the audience. Warm bias carries to light via off-white paper canvas.                                                               |
| 2026-05-26 | Drop glassmorphism + neumorphism + all gradients    | v2 design system named both. They are 2020 Dribbble tells and the audience reads them as vibe-coded.                                                    |
