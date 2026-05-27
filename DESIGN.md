# TierBoard Design System

Extracted from the Claude Design prototype. Use this as the implementation reference
for all visual decisions.

---

## Philosophy

**Bloomberg / Stripe data tool.** Dense, precise, confident. Every element earns its
space. Numbers are the hero — lay them out so they're instantly scannable. No
decorative UI. No gradients on interactive elements. Motion is functional (it confirms
state), never decorative.

---

## Typography

Two fonts only. Using both is intentional and load-bearing — don't collapse them.

**Geist** — all prose, labels, names, UI copy.
**Geist Mono** — every number, every stat, every metadata label, all keyboard hints,
the status bar, rank numbers, ELO scores.

The rule: if it's data or it helps orient the user spatially (rank, timestamp, count),
it's mono. If it communicates meaning in words, it's sans.

```
Base size:    14px
Line height:  1.45
Smoothing:    antialiased
Features:     ss01, ss02, cv11 (Geist-specific ligatures/alternates)
```

Typographic scale in practice:
- 32px / weight 500 / tracking −0.02em → screen headlines ("Would you rather work at")
- 28px / weight 500 / tracking −0.02em → company name on voting card
- 22px / weight 500 / tracking −0.01em → large stat numbers in vote header
- 18px / weight 500 → card stat values (ELO, rank, votes)
- 15px / weight 600 → brand name
- 14px / weight 400 → body, taglines
- 13px / weight 500 → row names, tab labels, search input
- 12px / weight 400 → secondary UI (chips, skip button, toggle labels)
- 11px / weight 500 → monospace metadata (status bar, result line, trend values)
- 10px / weight 500–600 → uppercase labels ("COHORT", "ELO", "RANK", "PROMPT"),
  tab numbers, hotkey hints, tier badges
- 9px / weight 400 → card stat labels ("ELO", "24H" inside cards)

Letter spacing conventions:
- Uppercase mono labels: `0.06–0.1em`
- Tab numbers: `0.04em`
- Sector pills: `0.02em`
- Everything else: default or `−0.01 to −0.02em` for large headlines

---

## Color System

All colors use OKLCH. This is intentional — perceptual uniformity means hue shifts
stay consistent in weight as you move across the spectrum. Don't convert to hex/hsl
when implementing.

The entire palette is built from hue 290 (warm purple-gray). Even the "neutral" grays
carry a trace of this hue — it's what gives the UI its cohesion.

### Base Tokens

```
--bg:            oklch(0.99 0.002 290)   Page background. Off-white, not white.
--bg-elev:       #ffffff                 Cards, topbar, table rows. True white.
--bg-soft:       oklch(0.975 0.003 290)  Hover states, table header, tag containers.
--border:        oklch(0.92 0.005 290)   Default dividers.
--border-strong: oklch(0.85 0.008 290)   Inputs, dropdown buttons, emphasis borders.
--text:          oklch(0.18 0.008 290)   Primary text. Slightly warm near-black.
--text-muted:    oklch(0.45 0.008 290)   Secondary text, taglines, row descriptions.
--text-dim:      oklch(0.6 0.005 290)    Metadata, timestamps, placeholder text.
```

### Accent

Default is purple (hue 290). The four accent variables update together when the user
changes theme:

```
--accent:      oklch(0.5 0.18 290)     Interactive color, active states, focus rings.
--accent-bg:   oklch(0.97 0.03 290)    Tinted background behind accent elements.
--accent-text: oklch(0.4 0.15 290)     Text on accent-bg surfaces.
--accent-soft: oklch(0.85 0.07 290)    Hover border glow.
```

When the user switches to mono accent (`#1f1f1f`), the accent becomes a
near-black ramp instead:
```
--accent:      oklch(0.22 0.01 290)
--accent-bg:   oklch(0.96 0.005 290)
--accent-text: oklch(0.22 0.01 290)
--accent-soft: oklch(0.9 0.01 290)
```

Other accent hues just swap the hue integer in the four formulas:
Blue = 250, Green = 145, Red = 25.

### Semantic

```
--green:    oklch(0.55 0.16 145)    Positive delta, winner, rising trend.
--green-bg: oklch(0.96 0.04 145)
--red:      oklch(0.55 0.18 25)     Negative delta, falling trend.
--red-bg:   oklch(0.96 0.04 25)
--amber:    oklch(0.65 0.15 70)     UPSET badge only.
```

### Background Grid

The page has a faint grid that reads as "data tool" at first glance:
```css
background-image:
  linear-gradient(to right, oklch(0.96 0.003 290) 1px, transparent 1px),
  linear-gradient(to bottom, oklch(0.96 0.003 290) 1px, transparent 1px);
background-size: 80px 80px;
background-position: -1px -1px;
```

---

## Spacing & Sizing

No arbitrary values. These are the recurring units:

| Purpose | Value |
|---------|-------|
| Topbar height | 52px |
| Status bar height | 32px |
| Main content padding | 32px vertical, 24px horizontal |
| Max content width | 1280px (centered) |
| Card padding | 28px |
| Table cell padding (comfortable) | 10px 8px |
| Table cell padding (compact) | 7px 8px |
| Row height (comfortable) | 52px min |
| Row height (compact) | 38px min |
| Card border-radius | 12px |
| Table border-radius | 8px |
| Small control border-radius | 6–7px |
| Chip border-radius | 6px |
| Tab container border-radius | 7px, tabs inside: 5px |
| Pill / round element | 100px (makes it fully round) |

Density is a first-class concept. The entire leaderboard adapts when
`data-density="compact"` is set on the root element — row heights shrink,
taglines in rows hide, column widths tighten.

---

## Elevation & Shadow

Three levels only:

| Level | Usage | Shadow |
|-------|-------|--------|
| Flat | Table rows, status bar | None |
| Raised | Cards at rest, dropdowns | `0 12px 32px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)` |
| Lifted | Card on hover or when picked | `0 16px 40px rgba(0,0,0,.1)` |

The topbar uses `backdrop-filter: blur(12px)` with `rgba(255,255,255,0.85)` — it
floats over content as the user scrolls.

---

## Borders

- Default: 1px solid `var(--border)` — everything uses this unless noted
- Inputs / interactive controls at rest: `var(--border-strong)`
- Active / focused input: `var(--accent)` + `box-shadow: 0 0 0 3px var(--accent-bg)`
- Card hover: accent border via a pseudo-element (allows independent transition)

Border radii are never rounded to the point of softness. 6–12px, not 16+. This is a
data tool, not a consumer app.

---

## Component Patterns

### Monogram Logo

Every company has a generated monogram chip. No external images.

Hue is derived deterministically from the company's string ID via a simple hash
(`((h << 5) - h + charCode) | 0` accumulated). Hue = `hash % 360`.

From the hue, three values:
```
bg:     oklch(0.92 0.04 {hue})
fg:     oklch(0.35 0.08 {hue})
border: oklch(0.85 0.05 {hue})
```

Monogram text: 1–2 uppercase chars. Single-word names → first 2 letters. Multi-word → initials.
Font: Geist Mono, weight 600, tracking −0.02em.
Border-radius: `max(4, size × 0.16)`.

### Sector Pill

Compact label tag. Geist Mono, 10px, uppercase, weight 500, tracking 0.02em.
Each sector has its own OKLCH tint:

| Sector | Hue | Label |
|--------|-----|-------|
| AI Lab | 290 | AI Lab |
| Quant | 145 | Quant |
| Big Tech | 250 | Big Tech |
| Unicorn | 60 | Unicorn |
| Startup | 25 | Startup |
| Public | 0 | Public |
| Hardware | 200 | Hardware |
| Crypto | 80 | Crypto |

All use `oklch(0.95 0.03–0.04 {hue})` background and `oklch(0.4–0.45 0.12–0.15 {hue})` text.

### Tier Badge

20×20px square chip, Geist Mono 10px bold, border-radius 4px.
Five tiers based on ELO (S ≥ 1750, A ≥ 1600, B ≥ 1450, C ≥ 1300, D < 1300).
Each tier has its own hue: S=290 (purple), A=250 (blue), B=145 (green), C=70 (amber), D=neutral.

### Trend Arrow

```
▲ +12.4   green
▼ −5.1    red
— 0       dim
```

Threshold: more than ±0.5 to register as up/down. Symbol is 8px, value is 11px.
Both in Geist Mono, weight 500.

### Chips (filter buttons)

`padding: 4px 10px; border-radius: 6px; font-size: 12px`.
Inactive: white background, `var(--border)` border, `var(--text-muted)` color.
Hover: `var(--border-strong)` border.
Active: `var(--text)` background, `var(--bg)` text — inverted. No accent color used here.

### Tabs

Container: `background: var(--bg-soft)` with `var(--border)` border, 7px radius, 2px padding.
Tab item: 5px radius, 13px, weight 500. 
Inactive: transparent, `var(--text-muted)`.
Active: white background, subtle ring shadow. Number tints to `var(--accent)`.

### <kbd> elements

```css
font-family: var(--font-mono);
font-size: 10px;
padding: 1px 5px;
border: 1px solid var(--border-strong);
border-radius: 3px;
background: var(--bg-elev);
color: var(--text-muted);
box-shadow: 0 1px 0 var(--border-strong);
```

---

## Motion

**Functional only.** Transitions communicate state changes; nothing animates for
aesthetic reasons.

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Card hover lift | 150ms | `cubic-bezier(.3,.7,.4,1)` |
| Card picked state | 150ms | same |
| Tab active | 120ms | default |
| Button / chip hover | 120ms | default |
| Vote result fade-in | 250ms | `ease-out` (translate −2px → 0, opacity 0 → 1) |
| Card advance after pick | 380ms delay | — (intentional pause for animation to read) |
| Status dot pulse | 2s | `ease-in-out`, loops at 50% opacity |

The 380ms delay on advancing after a vote pick is deliberate — it gives the
picked/dimmed card animation time to be seen before the pair changes.

---

## Layout Conventions

**App shell:** 3-row grid — topbar / content / statusbar. Full viewport height.

**Content area:** `max-width: 1280px`, centered, `padding: 32px 24px`.

**Matchup grid (vote screen):**
`grid-template-columns: 1fr auto 1fr`. VS divider is `auto` — vertical line + pill.
Cards are equal width and stretch to match height.

**Leaderboard table:**
7-column grid. Columns: rank+tier | company | sector | ELO | trend | votes | movement.
Not a `<table>` element — CSS grid rows to enable full-row hover.

---

## Status Bar Conventions

The bottom statusbar is a persistent, low-density information strip. It reads like
a terminal status line — all Geist Mono, 11px, `var(--text-muted)`.

Left side: system status (live dot + aggregate stats).
Right side: last action taken.

The live dot is `var(--green)` with a matching color outer ring that pulses. It
represents real-time state, not decoration.

Separator between items: `·` (middle dot), color `var(--text-dim)`.
