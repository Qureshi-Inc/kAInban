# CLAUDE.md

Agent guidance for this repo.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt,
invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

## Design System

Always read `DESIGN.md` (at repo root) before making ANY visual or UI decision. All font choices,
colors, spacing, motion, aesthetic direction, **AND the AI-native app shell architecture (v3.1)** are
defined there. Do not deviate without explicit user approval.

The doc is layered:

- **v3 sections** govern visual primitives (colors, fonts, motion, density, components).
- **v3.1 sections** govern application architecture (3-pane shell, view switcher, inspector,
  command palette, ambient AI patterns, workspace terminology).

Tokens live in `src/styles/design-tokens.css` as CSS custom properties — that file is the runtime
contract for v3 primitives. The v3.1 architectural tokens (`--sidebar-w`, `--inspector-w`,
`--topbar-h`) are defined in DESIGN.md v3.1.1 and should be added to the same file as the migration
happens.

Live previews:

- `design-preview/index.html` — v3 visual primitives (color, type, motion, components)
- `design-preview/shell.html` — v3.1 app shell, view switcher, inspector, command palette,
  ambient AI patterns

The previous design doc (`DESIGN_SYSTEM.md`, v2 glassmorphism/neumorphism manifesto) is archived to
`docs/design-system-v2.archive.md` and is NOT the source of truth.

In QA or design-review mode, flag any code that:

- Uses gradient backgrounds for CTAs, badges, or surfaces
- Uses `glass`, `magnetic`, `ripple`, `ai-glow`, `floating`, `shimmer`, or `gradient-text` utility
  classes
- Uses cyan/purple/violet accent colors instead of the burnt amber `--accent`
- Uses Inter without the `cv01` + `ss03` OpenType features
- Uses box-shadow glow halos on AI states (border-pulse only — see DESIGN.md → Motion)
- Opens a Modal for task / meeting / project detail instead of the Inspector (v3.1.4 says
  inspector for detail surfaces, modal only for irreversible actions or multi-step wizards)
- Uses banned terminology: `Issue`, `Ticket`, `Epic`, `Sprint`, `Backlog`, `Dashboard` as
  user-facing nouns (v3.1.9 — use Task / Project / Inbox / Activity / Workspace instead)
- Adds an AI chat-window overlay, animated typing-dot, or "AI is thinking…" spinner — v3.1.8
  bans them; use ambient AI patterns (badge, summary block, inline chip, border-pulse)
