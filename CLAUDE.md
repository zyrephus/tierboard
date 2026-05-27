# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is TierBoard

Community-driven prestige ranking for ~150 tech companies (FAANG, quant, AI labs, unicorns). Users vote in anonymous head-to-head matchups ("Would you rather work at X or Y?") — an ELO system produces live rankings with trend arrows. The voting UI is the core mechanic.

**MVP approach:** Static JSON seed data + client-side ELO this weekend; live backend the following week after early feedback.

**10x vision:** Cohort breakdowns — rankings split by role (SWE vs PM vs quant), seniority, or location.

## Design System

See `DESIGN.md` for the full implementation reference (colors, typography, spacing, component patterns, motion rules). Bloomberg/Stripe aesthetic — dense, data-forward, no decoration.

Key invariants:
- Two fonts: Geist (prose/labels) and Geist Mono (all numbers, stats, metadata). Never collapse them.
- All colors in OKLCH — never convert to hex/hsl.
- No gradients on interactive elements. Motion is functional only.
