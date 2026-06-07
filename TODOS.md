# TODOS

## Ranking

### BT solver: set-based recompute at scale

**What:** Refactor the Bradley-Terry MM loop in `recompute_rankings()` from
per-element correlated subqueries to a set-based `UPDATE ... FROM (join)` over a
materialized pair-counts table.

**Why:** Current shape is O(iters × companies × avg_degree). Fine at 163 companies
(sub-second hourly batch), but degrades at scale.

**Context:** Introduced with the Prestige Index / Bradley-Terry rework (see design
doc `~/.gstack/projects/zyrephus-tierboard/wilson-main-design-20260531-203323.md`).
Solver iterates to convergence (`max|Δ ln p| < 1e-4`, ~150-300 iters). The plpgsql
array + correlated subquery per company per iteration is the slow part. Trigger to
act: roughly 5-10x growth (~1,000 companies or ~100k+ deduped pairs) would make the
hourly job noticeably slow. Fix: build `pair_counts(i,j,n)` once, then each iteration
is one set-based UPDATE joining the previous strengths.

**Effort:** M
**Priority:** P4
**Depends on:** Prestige Index BT solver shipped
