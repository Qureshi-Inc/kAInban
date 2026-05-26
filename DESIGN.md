# Design System — kAInban

> Single source of truth for visual, typographic, and motion decisions in kAInban. Read this before
> making any UI change. If a design choice isn't here, propose it as a PR to this file before
> implementing in code.

**Version:** 3.1 (Workhorse Dark + AI-Native Shell) **Established:** 2026-05-26 via `/design-consultation`
**Supersedes:** `DESIGN_SYSTEM.md` v2.0 (Dec 2025 — archived to `docs/design-system-v2.archive.md`)
**Live preview:** `design-preview/index.html` (aesthetic primitives) ·
`design-preview/shell.html` (v3.1 shell + view switcher + inspector + palette)

v3.1 keeps every v3 aesthetic decision intact (colors, fonts, motion, density,
component baselines below). It ADDS the application architecture layer the
product needs to feel like an AI-native workspace OS rather than a kanban site:
the 3-pane shell, the inspector-replaces-modals pattern, the Kanban/Tasks
view switcher, the universal `<Cmd>K` palette, ambient AI surfaces, and the
workspace-OS terminology. New sections at the end of this document.

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

## v3.1 — AI-Native Workspace Shell

The v3 sections above govern visual primitives (color, type, motion, spacing,
component baselines). v3.1 governs the application architecture that hosts
those primitives. Same aesthetic, new shell.

The product thesis behind v3.1: **kAInban is not a kanban app, it's a
workspace OS where conversations become work.** The board is one view of the
work. The list is another. The AI is ambient infrastructure, not a chat
window. The user's terminology should reinforce all of that.

---

### v3.1.1 App shell (3 panes)

| Pane             | Width (desktop)   | Width (mobile)         | Role                                                                                 |
| ---------------- | ----------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| Sidebar          | `240px` expanded · `56px` rail | full-screen drawer behind hamburger | Workspace switcher + Inbox/Today/Activity + Projects tree + Meetings + user.         |
| Top command bar  | `100%`, `44px` tall                | same, `44px`                        | Breadcrumb (left) · `<Cmd>K` palette trigger (center-right) · AI menu + presence (right). |
| Main canvas      | `1fr` (fills)                      | `1fr`                               | Either Kanban or Tasks (toggled via View Switcher). Owns all scrolling.              |
| Inspector panel  | `384px`, toggleable                | full-screen drawer over canvas      | Task / meeting / project detail. Replaces TaskDetailModal entirely.                  |

```
┌────────┬───────────────────────────────────────┬────────────┐
│        │ Breadcrumb     [⌘K]      AI · 🔴      │ TASK-ID    │
│ Side   ├───────────────────────────────────────┤  Tabs      │
│  bar   │  [Kanban|Tasks]   Filter   Sort       │            │
│        ├───────────────────────────────────────┤  body      │
│        │                                       │            │
│        │       canvas (kanban or list)         │            │
│        │                                       │            │
│        ├───────────────────────────────────────┤  footer    │
└────────┴───────────────────────────────────────┴────────────┘
```

Rules:

- **Three panes never overlap.** Sidebar and inspector both push the canvas;
  neither is a floating overlay (mobile is the exception — both become
  full-screen drawers).
- **Inspector default is OPEN with a placeholder** ("Select a task") on
  desktop ≥ `1280px`. Below that, default closed. Below `960px`, full-screen
  drawer on demand.
- **Sidebar collapse to rail** preserves icon-only nav; tooltips on hover
  surface the label. The rail width is fixed (`56px`) so the canvas doesn't
  reflow on toggle.
- **Top command bar height is `44px`.** Never bigger. The bar is chrome, not
  content.
- The canvas and the inspector each own their own scroll. The sidebar does
  not scroll the page — its own footer (user card) sticks to its bottom.

Tokens (add to root):

```css
:root {
  --sidebar-w: 240px;
  --sidebar-rail-w: 56px;
  --inspector-w: 384px;
  --topbar-h: 44px;
}
```

---

### v3.1.2 Sidebar

**Composition (top to bottom):**

1. **Workspace switcher** (header, height = `var(--topbar-h)`) — workspace
   glyph + name + chevron. Opens a popover with workspace list +
   "Create workspace" + settings link.
2. **Primary nav group** — `Inbox`, `Today`, `Activity`. Always at the top.
3. **Projects group** — eyebrow label + project list with counts. Each
   project can expand to show its named saved views (e.g. "This week",
   "Follow-ups"). One project active at a time.
4. **Meetings group** — `Recent`, `Upcoming`. Optional; hidden if no
   meetings exist.
5. **Sidebar footer** — user avatar + name + email, opens user menu popover.

**Visual rules:**

- Background: `var(--bg-raised)`. Right border: `1px var(--hairline-low)`.
- Nav item: `padding: 6px 8px`, `border-radius: var(--radius-sm)`,
  `font-size: 12px`, weight `510`.
- Active item: `background: var(--bg-emphasis)`, icon in `var(--accent)`.
- Eyebrows (`Projects`, `Meetings`): `font-size: 10px`, `text-transform: uppercase`,
  `letter-spacing: 0.06em`, `color: var(--text-muted)`.
- Group dividers: `border-top: 1px var(--hairline-low)` on the next group.
- Counts: mono, `font-size: 10px`, right-aligned via `margin-left: auto`.
- No icons larger than `14×14`. The sidebar is dense, not decorative.

---

### v3.1.3 Top command bar

| Slot       | Content                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| Left       | Breadcrumb: `<Project name> / <View>`. Current view bold (weight 510). Optional mono task count. |
| Center-right | Palette trigger button — full-width up to `~360px`, placeholder text "Search tasks, projects, or ask AI…" + `<Cmd>K` kbd hint. Opens the command palette. |
| Right      | AI action menu (sparkle icon) · Notifications (bell) · Presence indicator (`6×6` dot in `--success`). |

**Visual rules:**

- Height: `44px`. Background: `var(--bg-raised)`. Bottom border: `1px var(--hairline-low)`.
- Palette trigger is the dominant visual element — it telegraphs that the
  product is keyboard-first.
- AI action menu opens a popover with the same actions categorized in the
  palette under "AI actions" (see v3.1.7). Same primitives, different entry
  point.
- No tab strip in the top bar. Views toggle below in the View Bar (v3.1.5),
  never up here.

---

### v3.1.4 Inspector panel (the new default for task detail)

**Why this exists:** modals demand full focus and hide the surrounding
context. For task detail, hiding the board/list is wrong — you usually want
to see "what other tasks am I about to compare this to?" while editing.
Inspectors keep context visible.

**When to use what:**

| Surface       | Use when                                                                          | Avoid for                                                       |
| ------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Inspector** | Task detail, meeting detail, project detail, transcript pane, AI conversation log | Irreversible actions, auth flows, multi-step wizards            |
| **Modal**     | Irreversible confirmation (delete), auth/login, multi-step wizards, settings dialog | Anything that has a "list of N like things" context behind it   |
| **Popover**   | Single-field picker (date, assignee, priority, status), small menus               | Anything requiring a body of text or multiple fields            |
| **Drawer (mobile)** | Mobile equivalent of inspector — full-screen with back button             | Bottom sheets — they kill long-form reading area                |

**Composition (top to bottom):**

1. **Header** (`44px` tall, matches topbar) — task ID (mono), action icons
   (copy link, more, close).
2. **Tabs** — `Detail` (default) · `Activity` · `Source` (the originating
   transcript span). Tabs use `border-bottom: 1px var(--accent)` on active,
   weight `510`.
3. **Body** (`flex: 1`, scrollable, `padding: 14px 16px`, `gap: 14px`):
   - **Title** as `<h3>`, `font-size: 16px`, weight `510`. Editable inline.
   - **Field grid** — `Status / Priority / Assignee / Due / Project`. Each is
     a row: 90px label column + value column. Values use the same chips,
     avatars, and pickers as the list view (consistency).
   - **AI block** (if AI-generated) — accent-bordered, accent-soft background,
     serif body (this is the AI's voice — see v3 typography rules),
     mono source citation.
   - **Subtasks** — inline checklist, AI-suggest chip below ("Generate
     subtasks from the transcript").
   - **Recent activity** — last 3-5 events from this task's change log.
4. **Footer** (`border-top: 1px var(--hairline-low)`, `padding: 10px 12px`) —
   secondary "Comment" + primary "Mark Done" button. Footer is a fixed
   pinned bar; never scrolls.

**Width / responsive:**

- Desktop ≥ `1280px`: `384px` wide, opens beside canvas, canvas reflows.
- Tablet `960-1279px`: `384px` wide, opens as a slide-in overlay (canvas
  doesn't reflow).
- Mobile `< 960px`: full-screen drawer with back chevron in the header,
  covering the canvas entirely.

**Open / close:**

- Selecting a task opens its inspector. URL updates to include the task ID
  (`?task=AUTH-12`) so the inspector state survives reload and is shareable.
- Closing returns to canvas with no selected row.
- `<Esc>` closes the inspector. `j`/`k` navigate to next/previous task and
  keep the inspector open.

**Migration note:** `src/components/TaskDetailModal.jsx` is the v3.0 entry
point for task detail. The v3.1 migration replaces it with
`TaskInspector.jsx` (composition above) and removes the modal portal. The
"are you sure" delete confirm remains a modal (it's the irreversible-action
case above).

---

### v3.1.5 View Switcher (Kanban / Tasks)

A two-tab segmented control directly above the canvas, in the **View Bar**
(below the top command bar). Switches between the same dataset rendered in
two presentations.

**Visual:**

- Wrapper: `background: var(--bg-emphasis)`, `border: 1px var(--hairline-mid)`,
  `border-radius: var(--radius-sm)`, `padding: 2px`.
- Each tab: `padding: 3px 10px`, `font-size: 11px`, weight `510`, icon `12px`.
- Active tab: `background: var(--bg-raised)`, `color: var(--text-primary)`,
  subtle `box-shadow: 0 1px 2px rgba(0,0,0,0.2)` for press depth.
- Sit on the left of the View Bar; Filter / Sort pills sit to its right;
  "Group by" indicator on the far right.

**Persistence:**

- Last-used view persists per user per workspace in localStorage under
  `kainban:viewMode:<workspaceId>` (`'kanban' | 'list'`).
- **New users default to `list`** — it's the AI-native default; kanban is
  there for users who want it.
- Server-backed when MULTITENANCY_ENABLED is on (so it follows the user
  across devices).

**Keyboard:**

- `V then B` → Kanban view
- `V then L` → Tasks view
- Same chord exposed in the command palette under "Switch view".

**Mental model:**

- **Kanban view** is the spatial mode — board of columns, drag to change
  status, good for triage and standup demos.
- **Tasks view** is the operational mode — compact rows, keyboard-first,
  good for getting through 50+ items.

Both views render from the same store, both observe the same filters/sort/
group settings (filters carry across when switching).

---

### v3.1.6 Task List Row primitive

The atomic unit of the Tasks view. One row = one task.

**Visual grid:**

```
[status] [id] [title......] [chips...] [date] [avatar]
  20px   56px    1fr           auto      auto    auto
```

Total row height: `32px` (resting). `padding: 6px 8px`, `gap: 10px`.

**Components left to right:**

1. **Status dot** (`12px` circle) — Todo (hairline border, hollow), In
   progress (3/4 conic fill in `--info`), Done (solid `--success`), Blocked
   (solid `--danger`). Click to cycle status — popover for explicit pick.
2. **Task ID** — mono, `font-size: 11px`, `--text-muted`.
3. **Title** — `font-size: 13px`, weight `510`, `--text-primary`. Overflows
   with ellipsis on narrow screens.
4. **AI badge** (if present) — `chip ai` from v3.
5. **Priority chip** — semantic-soft variants from v3.
6. **Due date** — mono, `font-size: 11px`, `--text-muted`, never weight 510.
   `"Today"`/`"Tue"`/`"May 27"` — never full ISO.
7. **Assignee avatar** — `18px` circle, semantic-tinted gradient.

**States:**

- **Hover** — `background: var(--bg-elevated)`.
- **Selected** — `background: var(--bg-emphasis)`. Inspector opens to this
  task; row stays selected when inspector is open.
- **Focused (keyboard)** — `1px solid var(--accent)` inset shadow on the
  left edge (`box-shadow: inset 3px 0 0 var(--accent)`).

**Grouping:**

- Rows live inside a `list-group`. Group header is a `border-bottom: 1px
  var(--hairline-low)` row with: status dot + label (uppercase 11px) + count
  (mono) + right-aligned "Add task" trigger.
- Default group-by = `Status` (Inbox / In progress / Blocked / Done).
- Other group-by options: `Assignee`, `Project`, `Priority`, `Due date`.
- Group state (collapsed/expanded) persists per user per workspace.

**Keyboard navigation rules:**

| Key      | Action                                              |
| -------- | --------------------------------------------------- |
| `j` / `k` | Next / previous task                                |
| `o` / `Enter` | Open in inspector                              |
| `x`      | Toggle selection (for multi-select)                 |
| `e`      | Inline edit title                                   |
| `1-5`    | Set priority Low/Med/High (1/2/3); 4=None; 5=Urgent |
| `s`      | Set status (opens popover)                          |
| `a`      | Assign to me (or open assignee popover with `Shift`)|
| `d`      | Set due date popover                                |
| `Esc`    | Close inspector / clear selection                   |
| `/`      | Focus search (same as `<Cmd>K` filter)              |

---

### v3.1.7 Command Palette

Universal entry point. `<Cmd>K` / `<Ctrl>K` from anywhere. Single dialog that
covers navigation, creation, AI actions, view switching, and search.

**Library:** `cmdk` (headless, ~3kb gzipped, shadcn-compatible). NOT `kbar`
(too opinionated about animations).

**Visual:**

- Overlay: `position: fixed`, `inset: 0`, `background: rgba(0,0,0,0.55)`,
  no blur, `z-index: 100`.
- Palette: `width: 560px`, `max-width: calc(100vw - 32px)`, top padded
  `14vh`, `background: var(--bg-elevated)`, `border: 1px var(--hairline-mid)`,
  `border-radius: var(--radius-lg)`, `box-shadow: 0 12px 32px rgba(0,0,0,0.5)`.
- Search input: `padding: 12px 14px`, `font-size: 14px`, search icon left
  (`14×14`, `--text-muted`), `<Esc>` chip right.
- Body: `overflow: auto`, `max-height: 60vh`, grouped sections.
- Group label: `font-size: 10px`, uppercase, `letter-spacing: 0.06em`,
  `--text-muted`, `padding: 6px 10px 4px`, weight `510`.
- Item: `padding: 7px 10px`, `border-radius: var(--radius-sm)`, `font-size:
  13px`. Active item: `background: var(--bg-emphasis)`.
- AI actions: icon and label in `--accent`. Other items: icon in
  `--text-secondary`, label in `--text-primary`.
- Shortcut hint right-aligned, using `kbd-sm` chips.

**Group order (top to bottom):**

1. **Suggested** — context-aware (e.g. "Open Inbox", "New task in <current
   project>", "Reopen last meeting"). 2-3 items max.
2. **AI actions** — the verbs. Always present. See list below.
3. **Navigate** — projects, views, meetings.
4. **Switch view** — Kanban / Tasks.
5. **Search results** — when the user starts typing, top-level groups
   collapse to a single "Results" group with hit type prefix
   (`Task · AUTH-12 · …`, `Meeting · …`, `Project · …`).

**AI actions (canonical set, MUST appear in every install):**

- Generate subtasks from transcript
- Summarize meeting
- Convert transcript → sprint plan
- Find blockers across this project
- Extract tasks from pasted text
- Re-run AI analysis on this task

**Keyboard:**

- `<Cmd>K` / `<Ctrl>K` — toggle open
- `<Esc>` — close
- `↑ / ↓` — move within results
- `Enter` — execute selected
- `<Cmd>↵` — execute selected and stay open (for chained actions)

**Mobile:** same overlay, repositioned to fill more of the viewport (top
padded `4vh`, palette `width: calc(100vw - 24px)`).

---

### v3.1.8 Ambient AI patterns

AI is infrastructure, not a personality. It shows up in exactly four places
across the product — never as a floating chat window, never as an animated
"assistant" character, never with a glowing typing-indicator dot.

| Surface              | Where                                                                              | What it looks like                                                              |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **AI badge**         | On task row meta (list view) or task card meta (kanban). Marks AI-created tasks.   | `chip ai` from v3 — accent-soft bg, accent-border, accent text, sparkle icon.   |
| **AI summary block** | Inspector body, meeting summary pages. The AI's "voice."                           | Accent-soft background, accent border, serif body text, mono source citation.   |
| **Inline action chip** | Bottom of relevant sections in the inspector ("Generate subtasks"), in the AI menu of the command bar. | Accent text on transparent bg, sparkle icon, `font-size: 11px`, weight `510`.   |
| **AI-active pulse**  | Card or row currently being edited by AI (live extraction in progress).            | Border-color pulse from `--accent-border` to `--accent` over 1.6s, infinite.    |

**Banned AI patterns:**

- Chat window overlays (right-side panel or bottom-right floating bubble)
- Animated typing-dots indicator
- "AI is thinking..." centered spinner that blocks the UI
- Glowing halos behind AI elements (no `box-shadow` glow, ever — see v3 motion rules)
- Gradient text on AI labels (no `gradient-text-ai` class — banned in v3)
- Personifying the AI ("Sage from kAInban suggests…") — the AI is the product, not a character
- Auto-opening modals announcing AI completed something — use Activity feed instead

**The AI voice (when written content):**

- Use Instrument Serif body (already a v3 rule for AI output).
- Be terse. The AI never says "I noticed that…" — it says "ACH webhook
  idempotency needs a 24h key TTL."
- Always cite source. Every AI-generated piece of content links back to its
  transcript span (mono citation: `standup-2026-05-26.m4a · 14:32`).
- Never use emoji. Never use exclamation points. The AI is a senior staff
  engineer, not a customer service rep.

---

### v3.1.9 Terminology

The product's verbs reinforce the workspace-OS posture. Match this
vocabulary in UI strings, error messages, and docs.

**Use:**

| Term         | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| Task         | Atomic unit of work.                                                          |
| Project      | A group of tasks with a shared goal.                                          |
| Inbox        | The AI's loading dock — extracted-but-unreviewed tasks land here first.       |
| Today        | Tasks due today across all projects.                                          |
| Activity     | Recent events across workspace (mutations, AI actions, comments).             |
| Action       | A thing the AI can do for you (verbs in the palette).                         |
| Workspace    | Top-level tenant boundary; one workspace = one Zitadel org.                   |
| Meeting      | An audio source — recording, upload, or paste — that produced tasks.          |

**Avoid:**

| Banned term            | Why                                                                 | Use instead         |
| ---------------------- | ------------------------------------------------------------------- | ------------------- |
| Issue                  | Bug-tracker language; implies defect, not work.                     | Task                |
| Ticket                 | Helpdesk language.                                                  | Task                |
| Epic, Story            | Agile-ceremony noise; we are not Jira.                              | Project, Task       |
| Sprint                 | Implies fixed-cadence ceremony.                                     | (omit) or `Cycle` if a cycle UX ships |
| Backlog                | Implies dead work pile.                                             | Inbox (if AI) or `All tasks` filter |
| Dashboard              | Implies admin-panel surface; doesn't fit a workspace OS.            | (replace with the actual surface name: Inbox, Today, Project) |
| Card                   | OK internally for kanban cards. NEVER user-facing — say `task`.     | Task                |
| Notification           | Use sparingly. Prefer "Activity" for the feed; only use "notification" for push/email/Slack out-bound. | Activity            |

**Microcopy patterns:**

- Empty state: `"No tasks in <View>. Press C to add one."` Never `"You have
  no items"` or `"It's lonely here"`.
- AI extraction running: `"Extracting tasks from <meeting>…"` Never `"Sage
  is thinking…"`.
- Error: `"Couldn't <verb>. <one-sentence cause>. <one-sentence fix>."` No
  "Oops" / "Uh oh" / exclamation points.

---

### v3.1 component additions

The following components are added to the library (alongside the v3 primitives).
All consume v3 tokens, all live in `src/components/ui/` once implemented.

| Component             | Purpose                                                | Notes                                                  |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| `AppShell`            | The 3-pane grid (sidebar / main / inspector).          | Handles responsive collapse to drawer on mobile.       |
| `Sidebar`             | Composition wrapper.                                   | Hosts `SidebarSection`, `WorkspaceSwitcher`, `UserCard`. |
| `SidebarSection`      | Nav group with eyebrow + items + tree.                 | Reusable for Projects, Meetings, custom groups.        |
| `TopBar`              | Top command bar (breadcrumb + palette trigger + menu). | Fixed `var(--topbar-h)`.                               |
| `ViewSwitcher`        | Two-tab segmented control (Kanban / Tasks).            | Persists last-used per user per workspace.             |
| `ViewBar`             | View Switcher + Filter + Sort + Group-by row.          | Sits below TopBar, above canvas.                       |
| `TaskRow`             | Compact list-view row primitive (above).               | Keyboard-navigable. Replaces SimpleListView rendering. |
| `TaskListGroup`       | Group header + collapsing rows.                        | Used by Tasks view.                                    |
| `TaskInspector`       | Right-side inspector for tasks.                        | Replaces `TaskDetailModal.jsx` entirely.               |
| `MeetingInspector`    | Right-side inspector for meetings.                     | Same composition as TaskInspector; different body.     |
| `CommandPalette`      | `<Cmd>K` palette built on `cmdk`.                      | Wraps Radix Dialog for accessibility.                  |
| `AIActionMenu`        | Popover hosting the AI verbs (same as palette group).  | Trigger lives in TopBar.                               |
| `AIBlock`             | Accent-bordered serif body block.                      | Used in inspectors for AI-generated content.           |
| `InlineAISuggest`     | Accent chip with sparkle icon, inline action trigger.  | Used at bottom of relevant sections.                   |
| `ActivityItem`        | Single row in the Activity feed.                       | Variants: user-action, AI-action.                      |

**Out of scope for v3.1 (deferred):**

- Marketing site re-skin.
- Mobile native app (React Native / Tauri shell) — DESIGN.md doesn't bind
  native; that's a future spec.
- Multi-workspace switcher animations.
- Cmd-K result fuzzy-rank tuning (defer until real usage data exists).

---

### v3.1 migration plan (frontend only — no backend changes)

This document is the contract. The migration is a follow-up PR. Estimated
shape (in order):

1. **Install `cmdk`** (`npm i cmdk`) and create the empty `CommandPalette`
   primitive. Wire `<Cmd>K` globally.
2. **Build `AppShell`** as a top-level layout component. Replace the current
   `Header` + page-level layout with `AppShell` containing `Sidebar` +
   `TopBar` + `Outlet` + `TaskInspector` slot.
3. **Refactor `LeftSidebar.jsx` → `Sidebar` + `SidebarSection`** per the
   composition above. Pull workspace switcher out of `Header.jsx`.
4. **Build `TaskRow` and `TaskListGroup`.** Migrate `SimpleListView.jsx` to
   use them. (`VirtualizedListView.jsx` keeps virtualization wrapper,
   replaces row renderer.)
5. **Add `ViewSwitcher` + `ViewBar`.** Persist preference under
   `kainban:viewMode:<workspaceId>`. Make List the default for new users.
6. **Build `TaskInspector`.** Move every read pattern out of
   `TaskDetailModal.jsx`. Delete the modal portal. Move "Are you sure
   delete?" into a small confirmation `Modal` primitive.
7. **Populate the command palette** with the canonical AI actions, project
   nav, view switches, and a fuzzy-search results group.
8. **Replace any `Notifications` UI naming with `Activity`** (one-shot sweep
   of strings).
9. **Add new components to Storybook (if it exists) or design-preview/.**
10. **Update CLAUDE.md** to flag the new contract: "Before any new component,
    read DESIGN.md v3.1.8/9; prefer Inspector over Modal; respect
    terminology."

Estimated effort: 5-8 dev days for a single engineer, longer if also doing
the full responsive matrix. None of the backend is touched; all changes are
in `src/components/` and `src/styles/`.

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
| 2026-05-26 | v3.1 — App shell architecture added                 | v3 covered visual primitives but not application architecture. Without a contract for sidebar/topbar/inspector, the next 5 PRs would each reinvent layout differently. |
| 2026-05-26 | Inspector replaces TaskDetailModal as default       | Modals demand full focus and hide the surrounding context. For task detail, you usually want to see the surrounding board/list to compare. Inspectors keep context visible — Linear and Height both made this move. |
| 2026-05-26 | View Switcher added; Tasks (list) default for new users | "AI converts conversations into work" reads better as an inbox of rows than a board of cards. Existing users keep last-used per `localStorage` so the change is invisible to them. |
| 2026-05-26 | `cmdk` chosen over `kbar` for command palette       | Headless (~3kb vs ~12kb), zero default styling means no risk of clashing with v3 Workhorse restraint, shadcn-compatible. |
| 2026-05-26 | Ambient AI patterns, no chat overlay anywhere       | A chat window is the AI-slop default 2026. Ambient AI (badge / summary block / inline action / pulse) communicates "AI is infrastructure" rather than "AI is a character." |
| 2026-05-26 | Workspace-OS terminology, ban ticketing nouns       | "Tasks / Projects / Inbox / Activity / Workspaces" reinforces the workspace-OS posture; "Issues / Tickets / Sprints / Backlogs" drag the product back into bug-tracker mental model. |
