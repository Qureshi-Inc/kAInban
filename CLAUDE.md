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
colors, spacing, motion, and aesthetic direction are defined there. Do not deviate without explicit
user approval.

Tokens live in `src/styles/design-tokens.css` as CSS custom properties — that file is the runtime
contract. The live preview at `design-preview/index.html` is the visual contract.

The previous design doc (`DESIGN_SYSTEM.md`, v2 glassmorphism/neumorphism manifesto) is archived to
`docs/design-system-v2.archive.md` and is NOT the source of truth.

In QA or design-review mode, flag any code that:

- Uses gradient backgrounds for CTAs, badges, or surfaces
- Uses `glass`, `magnetic`, `ripple`, `ai-glow`, `floating`, `shimmer`, or `gradient-text` utility
  classes
- Uses cyan/purple/violet accent colors instead of the burnt amber `--accent`
- Uses Inter without the `cv01` + `ss03` OpenType features
- Uses box-shadow glow halos on AI states (border-pulse only — see DESIGN.md → Motion)
