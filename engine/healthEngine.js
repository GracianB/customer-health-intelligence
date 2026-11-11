/**
 * Customer Health Intelligence — single rules-based engine (NOT ML).
 * Used by: tests, Command Center, build-injected n8n Code nodes.
 * @license MIT
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CHIHealthEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function getField(account, field, fallback) {
    if (account[field] === undefined || account[field] === null) return fallback;
    return account[field];
  }

  function scoreLoginRecency(days, bands) {
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      if (typeof b.maxDays === 'number' && days <= b.maxDays) {
        return { pts: b.pts, flag: b.flag || null };
      }
    }
    const last = bands[bands.length - 1];
    return { pts: last.elsePts != null ? last.elsePts : 0, flag: last.elseFlag || null };
  }

  function scoreTickets(open, bands) {
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      if (open <= b.max) return { pts: b.pts, flag: !!b.flag };
    }
    return { pts: 0, flag: true };
  }

  /**
   * Score one account snapshot with profile config.
   * New-customer protection: tenure_days < min_tenure_days → Onboarding status (not unfair Red).
   */
  function scoreAccount(account, config) {
    const cfg = config;
    const w = cfg.weights;
    const f = cfg.signalFields;
    const reasons = [];
    const drivers = [];

    const tenureDays = getField(account, cfg.tenure_field || 'tenure_days', cfg.default_tenure_days != null ? cfg.default_tenure_days : 365);
    const minTenure = cfg.min_tenure_days != null ? cfg.min_tenure_days : 0;

    // Insufficient history protection
    if (minTenure > 0 && tenureDays < minTenure) {
      return {
        ...account,
        health_score: null,
        risk_tier: 'Onboarding',
        risk_level: 'Onboarding',
        status: 'Onboarding – insufficient data',
        reason: 'Onboarding – insufficient data (tenure ' + tenureDays + 'd < ' + minTenure + 'd); score withheld',
        playbook: cfg.playbooks && cfg.playbooks.onboarding ? cfg.playbooks.onboarding : 'complete onboarding checklist; schedule activation review',
        recommended_action: cfg.playbooks && cfg.playbooks.onboarding ? cfg.playbooks.onboarding : 'complete onboarding checklist; schedule activation review',
        owner: account.csm || account.owner || 'Unassigned',
        due_date: null,
        top_drivers: [],
        profile_id: cfg.profile_id,
        data_label: account.data_label || cfg.data_label,
        scoring_model: 'rules-based (not ML)',
        insufficient_history: true,
      };
    }

    const loginDays = Number(getField(account, f.login_days, 999));
    const login = scoreLoginRecency(loginDays, cfg.bands.login);
    drivers.push({ signal: 'login', pts: login.pts, max: w.login, raw: loginDays });
    if (login.flag) reasons.push(login.flag);

    const adoptVal = Number(getField(account, f.adoption, 0));
    const adoptPts = Math.round(clamp(adoptVal, 0, 100) / 100 * w.adoption);
    drivers.push({ signal: 'adoption', pts: adoptPts, max: w.adoption, raw: adoptVal });
    if (adoptVal < cfg.flags.adoption_below) reasons.push(cfg.flagLabels.adoption || 'low adoption');

    const ticketsVal = Number(getField(account, f.tickets, 0));
    const tickets = scoreTickets(ticketsVal, cfg.bands.tickets);
    drivers.push({ signal: 'tickets', pts: tickets.pts, max: w.tickets, raw: ticketsVal });
    if (tickets.flag) reasons.push(cfg.flagLabels.tickets || 'many open tickets');

    const npsVal = Number(getField(account, f.nps, 0));
    const npsPts = Math.round(clamp(npsVal, 0, 100) / 100 * w.nps);
    drivers.push({ signal: 'nps', pts: npsPts, max: w.nps, raw: npsVal });
    if (npsVal < cfg.flags.nps_below) reasons.push(cfg.flagLabels.nps || 'low NPS');

    const onboardVal = !!getField(account, f.onboarding, false);
    const onboardingPts = onboardVal ? w.onboarding : 0;
    drivers.push({ signal: 'onboarding', pts: onboardingPts, max: w.onboarding, raw: onboardVal });
    if (!onboardVal) reasons.push(cfg.flagLabels.onboarding || 'onboarding incomplete');

    let score = clamp(login.pts + adoptPts + tickets.pts + npsPts + onboardingPts, 0, 100);
    const redMax = cfg.thresholds.red;
    const amberMax = cfg.thresholds.amber;

    let risk_tier, playbook;
    if (score < redMax) {
      risk_tier = 'Red';
      playbook = cfg.playbooks.red;
    } else if (score < amberMax) {
      risk_tier = 'Amber';
      playbook = cfg.playbooks.amber;
    } else {
      risk_tier = 'Green';
      playbook = cfg.playbooks.green;
    }

    if (reasons.length === 0) {
      if (score >= amberMax) {
        reasons.push('healthy signals');
      } else {
        const threshold = score < redMax ? redMax : amberMax;
        const sorted = drivers.slice().sort(function (a, b) {
          return a.pts - b.pts || b.max - b.pts - (a.max - a.pts);
        });
        const weakest = sorted.slice(0, 4).map(function (d) {
          if (d.signal === 'login') return 'login ' + loginDays + 'd→' + d.pts + '/' + d.max;
          if (d.signal === 'adoption') return 'adoption ' + adoptVal + '%→' + d.pts + '/' + d.max;
          if (d.signal === 'tickets') return 'tickets ' + ticketsVal + '→' + d.pts + '/' + d.max;
          if (d.signal === 'nps') return 'NPS ' + npsVal + '→' + d.pts + '/' + d.max;
          return 'onboarding ' + (onboardVal ? 'done' : 'incomplete') + '→' + d.pts + '/' + d.max;
        }).join(', ');
        reasons.push(
          'aggregate risk: score ' + score + ' below ' + risk_tier + ' threshold ' + threshold +
            '; several signals mid-range (' + weakest + ')'
        );
      }
    }

    const top_drivers = drivers
      .slice()
      .sort(function (a, b) {
        return a.pts / a.max - b.pts / b.max;
      })
      .slice(0, 3)
      .map(function (d) {
        return {
          signal: d.signal,
          pts: d.pts,
          max: d.max,
          utilization: Math.round((d.pts / d.max) * 100),
        };
      });

    const renewalDays = getField(account, cfg.renewal_field || 'days_to_renewal', null);
    let due_date = null;
    if (risk_tier === 'Red') due_date = 'T+1 business day';
    else if (risk_tier === 'Amber') due_date = 'T+3 business days';
    else due_date = 'T+7 business days';

    return {
      ...account,
      health_score: score,
      risk_tier: risk_tier,
      risk_level: risk_tier,
      status: risk_tier,
      reason: reasons.join('; '),
      playbook: playbook,
      recommended_action: playbook,
      owner: account.csm || account.owner || 'Unassigned',
      due_date: due_date,
      days_to_renewal: renewalDays,
      top_drivers: top_drivers,
      profile_id: cfg.profile_id,
      data_label: account.data_label || cfg.data_label,
      scoring_model: 'rules-based (not ML)',
      insufficient_history: false,
      segment: account.segment || account.plan_tier || account.client_type || 'unspecified',
    };
  }

  function summarize(scored, config) {
    const red = scored.filter(function (a) { return a.risk_tier === 'Red'; });
    const amber = scored.filter(function (a) { return a.risk_tier === 'Amber'; });
    const green = scored.filter(function (a) { return a.risk_tier === 'Green'; });
    const onboarding = scored.filter(function (a) { return a.risk_tier === 'Onboarding'; });
    const sumMrr = function (arr) {
      return arr.reduce(function (s, a) { return s + (a.mrr || 0); }, 0);
    };

    const renewalWindow = (config.renewal_alert_days != null) ? config.renewal_alert_days : 45;
    const upcomingRenewals = scored.filter(function (a) {
      return a.days_to_renewal != null && a.days_to_renewal <= renewalWindow;
    });

    const action_queue = scored
      .filter(function (a) { return a.risk_tier !== 'Onboarding'; })
      .map(function (a) {
        const riskWeight = a.risk_tier === 'Red' ? 3 : a.risk_tier === 'Amber' ? 2 : 1;
        const renewalBoost =
          a.days_to_renewal != null && a.days_to_renewal <= renewalWindow
            ? Math.max(1, Math.round((renewalWindow - a.days_to_renewal) / 10))
            : 1;
        const priority_score = (a.mrr || 0) * riskWeight * renewalBoost;
        return {
          account: a.account,
          risk_tier: a.risk_tier,
          mrr: a.mrr,
          health_score: a.health_score,
          owner: a.owner,
          next_action: a.recommended_action,
          due_date: a.due_date,
          sla_hours: a.risk_tier === 'Red' ? 24 : a.risk_tier === 'Amber' ? 72 : 168,
          priority_score: priority_score,
          top_drivers: a.top_drivers,
          reason: a.reason,
          days_to_renewal: a.days_to_renewal,
          segment: a.segment,
        };
      })
      .sort(function (a, b) { return b.priority_score - a.priority_score; });

    // Portfolio per CSM
    const byCsm = {};
    scored.forEach(function (a) {
      const k = a.owner || 'Unassigned';
      if (!byCsm[k]) byCsm[k] = { owner: k, accounts: 0, red: 0, amber: 0, green: 0, onboarding: 0, mrr: 0, mrr_at_risk: 0 };
      byCsm[k].accounts += 1;
      byCsm[k].mrr += a.mrr || 0;
      if (a.risk_tier === 'Red') { byCsm[k].red += 1; byCsm[k].mrr_at_risk += a.mrr || 0; }
      else if (a.risk_tier === 'Amber') byCsm[k].amber += 1;
      else if (a.risk_tier === 'Green') byCsm[k].green += 1;
      else if (a.risk_tier === 'Onboarding') byCsm[k].onboarding += 1;
    });

    return {
      report: 'Customer Health Summary',
      profile_id: config.profile_id,
      profile_name: config.profile_name,
      data_label: config.data_label,
      scoring_model: 'rules-based (not ML)',
      generated_at: new Date().toISOString(),
      total_accounts: scored.length,
      red_count: red.length,
      amber_count: amber.length,
      green_count: green.length,
      onboarding_count: onboarding.length,
      healthy_count: green.length,
      at_risk_count: red.length + amber.length,
      red_accounts: red.map(function (a) { return a.account; }),
      amber_accounts: amber.map(function (a) { return a.account; }),
      green_accounts: green.map(function (a) { return a.account; }),
      at_risk_mrr: sumMrr(red),
      revenue_lens: {
        by_tier: {
          Red: { accounts: red.length, mrr: sumMrr(red) },
          Amber: { accounts: amber.length, mrr: sumMrr(amber) },
          Green: { accounts: green.length, mrr: sumMrr(green) },
          Onboarding: { accounts: onboarding.length, mrr: sumMrr(onboarding) },
        },
        simulated_mrr_at_risk_sample_data: sumMrr(red),
        expansion_pipeline_green: {
          accounts: green.length,
          mrr: sumMrr(green),
          note: 'Green accounts flagged for upsell / referral (rules-based, SAMPLE/FICTITIOUS data)',
        },
        upcoming_renewals: {
          window_days: renewalWindow,
          accounts: upcomingRenewals.length,
          mrr: sumMrr(upcomingRenewals),
        },
      },
      action_queue: action_queue,
      portfolio_by_csm: Object.keys(byCsm).map(function (k) { return byCsm[k]; }),
      notes:
        config.summary_notes ||
        'SAMPLE/FICTITIOUS data — rules-based demo (not ML). Simulated MRR at risk; Slack NoOp pending configuration.',
    };
  }

  /** Week-over-week: detect deterioration when score drops >= threshold */
  function compareWeeks(prevScored, currScored, dropThreshold) {
    const thr = dropThreshold != null ? dropThreshold : 10;
    const prevMap = {};
    prevScored.forEach(function (a) { prevMap[a.account] = a; });
    const changes = [];
    currScored.forEach(function (curr) {
      const prev = prevMap[curr.account];
      if (!prev || prev.health_score == null || curr.health_score == null) return;
      const delta = curr.health_score - prev.health_score;
      changes.push({
        account: curr.account,
        prev_score: prev.health_score,
        curr_score: curr.health_score,
        delta: delta,
        deteriorated: delta <= -thr,
        prev_tier: prev.risk_tier,
        curr_tier: curr.risk_tier,
      });
    });
    return {
      drop_threshold: thr,
      deteriorated: changes.filter(function (c) { return c.deteriorated; }),
      all_changes: changes,
    };
  }

  function runPortfolio(accounts, config) {
    const scored = accounts.map(function (a) { return scoreAccount(a, config); });
    const summary = summarize(scored, config);
    return { scored: scored, summary: summary };
  }

  return {
    scoreAccount: scoreAccount,
    summarize: summarize,
    compareWeeks: compareWeeks,
    runPortfolio: runPortfolio,
    deepClone: deepClone,
    version: '1.2.0-rc1',
  };
});
