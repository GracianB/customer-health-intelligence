# Validation & calibration plan (not yet executed)

This project is a **rules-based** Customer Health scoring automation. It has **not** been calibrated on real historical churn.

## What exists today

- Transparent weights and thresholds (configurable per profile).
- Sensitivity sweeps (`node scripts/sensitivity.js [profile]`) showing how tier counts move when weights ±20% or thresholds change.
- Synthetic / SAMPLE datasets only.

## How one would calibrate with real data (future, private)

1. **Label history:** for each account-month, join health features to an outcome (churned / contracted / expanded within 30–90 days).
2. **Score freeze:** run the rules engine as-of month T without leakage from T+1.
3. **Precision / recall of Red:** treat Red as a positive alert; measure precision (share of Red that churned) and recall (share of churners that were Red).
4. **Lift:** compare churn rate in Red vs overall baseline.
5. **Threshold search:** sweep `red` / `amber` cut-offs to maximise F1 or business utility (e.g. cost of false alarm vs missed churn).
6. **Weight search (still rules):** grid-search weight vectors under a sum constraint; keep the formula inspectable — do **not** silently replace with an opaque ML model unless explicitly productised as such.
7. **Governance:** document training window, exclusion rules, PII handling, and human review for Red actions.

## Explicit disclaimer

No precision, recall, lift, or € savings figures in this repository are real. Figures such as **simulated MRR at risk** are SAMPLE/FICTITIOUS only.
