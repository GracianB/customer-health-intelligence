# Findings & fixes (v1.1.0)

## 1. Execution #1 incomplete summary — root cause analysis

### Evidence

| Run | Merge output items | Summary `total_accounts` | Red/Amber/Green in summary |
| --- | --- | --- | --- |
| **#1** (12:46:44Z) | **5** | **5** | 0 / 0 / **5** (Greens only) |
| **#2** (12:47:53Z) | **10** | **10** | **4 / 1 / 5** |

Yet in **#1**, builders still ran: Red=4, Amber=1, Green=5, Slack NoOp=4. So the bug was **not** scoring or the Switch — it was **what reached `Weekly Health Summary`**.

### What is proven

1. Summary used `$input.all()` from **Merge All Tiers** only.
2. Merge (v3, `mode: append`, `numberInputs: 3`) emitted **only the Green branch** in #1.
3. Workflow `updatedAt` equals #2’s start time → the graph was changed between runs.

### What is likely (not fully proven from remaining artifacts)

The most likely explanation: **in the #1 graph, Red and/or Amber were not yet wired into Merge inputs 0/1** (only Green → Merge), while Red still fed Slack. After the author reconnected all three builders into Merge, #2 produced 10 items. Alternative (less likely given counts): Merge waited incorrectly under parallel fan-out from Red → Slack + Merge in the same output array on that n8n build.

We **cannot** re-open the exact #1 node graph (only execution evidence + later export remain). Therefore this is stated as **likely wiring**, not a proven Merge engine bug.

### Package fix (v1.1.0) — what it guarantees

`Weekly Health Summary` now aggregates with:

```js
$('Build Red Risk Alert').all()
$('Build Amber Nurture Task').all()
$('Flag Green Expansion').all()
```

(with try/catch → `[]` if a branch never ran).

**Guarantee:** as long as the three builder nodes execute, the summary counts **all** their items (**10 / 4 / 1 / 5**, `at_risk_mrr = 38600` on SAMPLE DATA) **even if Merge is mis-wired or only receives one input**. Merge remains on the canvas for clarity but is no longer the sole source of truth for the report.

Validated with a temporary `(import test)` import on 2026-11-09 (Europe/Madrid).

## 2. TravelSync EMEA reason text (fixed in package)

**Before:** score 43 Red with vague `mixed mid-range signals` (no hard flags: adoption/NPS use strict `< 40`).

**After (scores/tiers unchanged):**  
`aggregate risk: score 43 below Red threshold 45; several signals mid-range (tickets 3→7/20, login 22d→8/25, NPS 40→8/20, adoption 40%→10/25)`.

## 3. `at_risk_mrr` scope (unchanged)

Sum of **Red** MRR only (= **38600** simulated SAMPLE DATA). Amber excluded. Labelled as **simulated MRR at risk (sample data)** in docs — never real protected revenue.

## 4. Positioning

Rules-based weighted scoring automation — **not** predictive ML.
