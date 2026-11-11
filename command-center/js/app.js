/* Customer Health Intelligence Command Center v1.2.0 — vanilla JS, no CDN */
(function () {
  'use strict';
  const state = { catalog: null, profileId: 'healthcare', data: null, view: 'overview', filter: '', selectedAccount: null };

  const riskLabel = { Red: 'High risk', Amber: 'Medium risk', Green: 'Healthy', Onboarding: 'Onboarding' };

  function euro(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return '€' + Number(n).toLocaleString('en-US');
  }

  function pill(tier) {
    const t = tier || '—';
    const nice = riskLabel[t] || t;
    return `<span class="pill pill-${t}" title="${nice}"><span class="pill-ico" aria-hidden="true"></span><span class="visually-hidden">Risk: </span>${t}</span>`;
  }

  function sparkline(scores) {
    if (!scores || scores.length < 2) return '<span class="muted">—</span>';
    const w = 72, h = 20;
    const nums = scores.map((s) => (s == null ? null : s));
    const valid = nums.filter((n) => n != null);
    if (!valid.length) return '<span class="muted">n/a</span>';
    const min = Math.min.apply(null, valid);
    const max = Math.max.apply(null, valid);
    const pts = nums.map((v, i) => {
      if (v == null) return null;
      const x = (i / (nums.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).filter(Boolean);
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="#5b8def" stroke-width="1.5" points="${pts.join(' ')}"/></svg>`;
  }

  function priorityReason(q) {
    const parts = [];
    if (q.risk_tier === 'Red') parts.push('high risk');
    else if (q.risk_tier === 'Amber') parts.push('medium risk');
    else if (q.risk_tier === 'Green') parts.push('expansion');
    else if (q.risk_tier === 'Onboarding') parts.push('onboarding');
    if (q.days_to_renewal != null && q.days_to_renewal <= 45) parts.push('renewal in ' + q.days_to_renewal + 'd');
    if (q.mrr) parts.push(euro(q.mrr) + ' MRR');
    return parts.join(' · ') || 'rules priority';
  }

  function tierMrr(rl, tier) {
    return (rl.by_tier[tier] && rl.by_tier[tier].mrr) || 0;
  }

  function concentrationBlock(rl) {
    const red = tierMrr(rl, 'Red');
    const amber = tierMrr(rl, 'Amber');
    const green = tierMrr(rl, 'Green');
    const onb = tierMrr(rl, 'Onboarding');
    const total = red + amber + green + onb;
    const conc = total ? Math.round((red / total) * 100) : 0;
    return {
      html: `<div class="panel"><h2>MRR at risk concentration</h2>
        <p class="small">Share of <strong>total portfolio MRR</strong> in Red (simulated): <strong>${conc}%</strong></p>
        <p class="muted small">Denominator = Red + Amber + Green + Onboarding = ${euro(total)}</p>
        <div class="bar" aria-hidden="true"><span style="width:${conc}%"></span></div>
        <p class="muted small">${euro(red)} Red · ${euro(amber)} Amber · ${euro(green)} Green · ${euro(onb)} Onboarding</p>
      </div>`,
      conc, total, red, amber, green, onb,
    };
  }

  function historyFor(account) {
    if (!state.data.weeks || !state.data.weeks.weeks) return [];
    return state.data.weeks.weeks.map((w) => {
      const row = w.scored.find((s) => s.account === account);
      return row ? row.health_score : null;
    });
  }

  function weekSeries() {
    if (!state.data.weeks || !state.data.weeks.weeks) return null;
    return state.data.weeks.weeks.map((w) => ({
      label: w.week_label,
      red: w.summary.red_count,
      amber: w.summary.amber_count,
      green: w.summary.green_count,
      onboarding: w.summary.onboarding_count || 0,
      at_risk_mrr: w.summary.at_risk_mrr,
    }));
  }

  function requireEmbedded() {
    if (!window.CHI_DATA || !window.CHI_DATA.catalog || !window.CHI_DATA.profiles) {
      throw new Error('CHI_DATA missing — open via START-HERE.html / command-center/index.html (embedded bundle).');
    }
    return window.CHI_DATA;
  }

  function loadCatalog() {
    const emb = requireEmbedded();
    state.catalog = emb.catalog;
    const sel = document.getElementById('profileSelect');
    sel.innerHTML = '';
    state.catalog.profiles.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.label;
      if (p.id === state.profileId) o.selected = true;
      sel.appendChild(o);
    });
    document.getElementById('demoBadge').textContent = state.catalog.demo_badge || 'Demo data – fictitious';
  }

  function loadProfile(id) {
    const emb = requireEmbedded();
    if (!emb.profiles[id]) throw new Error('Unknown profile: ' + id);
    state.data = emb.profiles[id];
    state.profileId = id;
    const sel = document.getElementById('profileSelect');
    if (sel && [...sel.options].some((o) => o.value === id)) sel.value = id;
    document.getElementById('profileTitle').textContent = state.data.config.profile_name;
    document.getElementById('profileSub').textContent = state.data.config.subtitle || state.catalog.subtitle;
    const tl = document.getElementById('navTeamLead');
    const av = document.getElementById('navAdoption');
    const gl = document.getElementById('navGlossary');
    if (tl) tl.style.display = id === 'realestate' ? '' : 'none';
    if (av) av.style.display = id === 'pricing-saas' ? '' : 'none';
    if (gl) gl.style.display = '';
    if (state.view === 'teamlead' && id !== 'realestate') state.view = 'overview';
    if (state.view === 'adoption' && id !== 'pricing-saas') state.view = 'overview';
    render();
  }

  function card(label, value, hint) {
    return `<div class="card"><div class="label">${label}</div><div class="value">${value}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  }

  function bindAccountLinks(root) {
    root.querySelectorAll('[data-account]').forEach((b) =>
      b.addEventListener('click', () => {
        state.view = 'account';
        state.selectedAccount = b.getAttribute('data-account');
        syncNav();
        render();
      })
    );
  }

  function actionQueueTable(rows, limit) {
    const list = rows.slice(0, limit || rows.length);
    return `<div class="table-wrap"><table>
      <thead><tr>
        <th class="col-rank">#</th>
        <th class="col-acct">Account</th>
        <th class="col-risk">Risk</th>
        <th class="col-mrr">MRR</th>
        <th class="col-owner">Owner</th>
        <th class="col-action">Next action</th>
        <th class="col-due">Due</th>
      </tr></thead>
      <tbody>${list.map((q, i) =>
        `<tr>
          <td class="col-rank" title="Internal priority score: ${q.priority_score}">#${i + 1}</td>
          <td class="col-acct"><button type="button" class="linkish" data-account="${q.account}">${q.account}</button><span class="acct-why">${priorityReason(q)}</span></td>
          <td class="col-risk">${pill(q.risk_tier)}</td>
          <td class="col-mrr">${euro(q.mrr)}</td>
          <td class="col-owner">${q.owner}</td>
          <td class="col-action action-cell">${q.next_action}</td>
          <td class="col-due">${q.due_date}</td>
        </tr>`
      ).join('')}</tbody></table></div>`;
  }

  function renderOverview() {
    const s = state.data.summary;
    const rl = s.revenue_lens;
    const conc = concentrationBlock(rl);
    const root = document.getElementById('view');
    root.innerHTML =
      `<div class="cards">
        ${card('Accounts', s.total_accounts)}
        ${card('Healthy (Green)', s.green_count)}
        ${card('At risk (Red+Amber)', s.at_risk_count)}
        ${card('Onboarding', s.onboarding_count || 0)}
        ${card('Simulated MRR at risk', euro(rl.simulated_mrr_at_risk_sample_data), 'sample / fictitious')}
        ${card('Expansion MRR (Green)', euro(rl.expansion_pipeline_green.mrr), 'sample / fictitious')}
        ${card('Upcoming renewals', rl.upcoming_renewals ? rl.upcoming_renewals.accounts : '—', rl.upcoming_renewals ? euro(rl.upcoming_renewals.mrr) + ' simulated' : '')}
      </div>
      <p class="muted small">Demo as of <strong>${s.demo_as_of || state.data.config.demo_as_of}</strong> · due dates are business days from that fixed date.</p>
      <div class="grid-2">
        <div class="panel"><h2>Prioritised action queue</h2>${actionQueueTable(s.action_queue, 8)}</div>
        <div class="stack">
          ${conc.html}
          <div class="panel"><h2>Upcoming renewals (≤${(rl.upcoming_renewals && rl.upcoming_renewals.window_days) || 45}d)</h2>
            <div class="table-wrap"><table><thead><tr><th>Account</th><th>Days</th><th>MRR</th><th>Risk</th></tr></thead>
            <tbody>${
              state.data.accounts
                .filter((a) => a.days_to_renewal != null && a.days_to_renewal <= ((rl.upcoming_renewals && rl.upcoming_renewals.window_days) || 45))
                .sort((a, b) => a.days_to_renewal - b.days_to_renewal)
                .slice(0, 6)
                .map((a) => `<tr><td><button type="button" class="linkish" data-account="${a.account}">${a.account}</button></td><td>${a.days_to_renewal}d</td><td>${euro(a.mrr)}</td><td>${pill(a.risk_tier)}</td></tr>`)
                .join('') || '<tr><td colspan="4"><div class="empty">No renewals in window.</div></td></tr>'
            }</tbody></table></div>
          </div>
          <div class="panel"><h2>By CSM</h2>
            <div class="table-wrap"><table><thead><tr><th>CSM</th><th>Accts</th><th>Red</th><th>At-risk MRR</th></tr></thead>
            <tbody>${(s.portfolio_by_csm || []).map((c) =>
              `<tr><td>${c.owner}</td><td>${c.accounts}</td><td>${c.red}</td><td>${euro(c.mrr_at_risk)}</td></tr>`
            ).join('')}</tbody></table></div>
            <p class="muted small" style="margin-top:8px">${state.data.config.inspired_by_public_product ? 'Sector archetype: <strong>' + state.data.config.inspired_by_public_product.archetype + '</strong> — conceptual only, fictitious accounts.' : 'SAMPLE DATA profile.'}</p>
          </div>
        </div>
      </div>`;
    bindAccountLinks(root);
  }

  function renderPortfolio() {
    const q = state.filter.toLowerCase();
    let rows = state.data.accounts.slice();
    if (q) rows = rows.filter((a) => JSON.stringify(a).toLowerCase().includes(q));
    const root = document.getElementById('view');
    root.innerHTML = `<div class="panel"><div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <input type="search" id="tableFilter" placeholder="Filter accounts…" value="${state.filter.replace(/"/g, '&quot;')}" aria-label="Filter accounts"/>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Account</th><th>Segment</th><th>Score</th><th>Trend</th><th>Risk</th><th>MRR</th><th>Owner</th><th>Next action</th></tr></thead>
      <tbody>${rows.map((a) => `<tr>
        <td><button type="button" class="linkish" data-account="${a.account}">${a.account}</button></td>
        <td>${a.segment || a.client_type || '—'}</td>
        <td>${a.health_score == null ? '—' : a.health_score}</td>
        <td>${sparkline(historyFor(a.account))}</td>
        <td>${pill(a.risk_tier)}</td>
        <td>${euro(a.mrr)}</td>
        <td>${a.owner}</td>
        <td class="action-cell">${a.recommended_action}</td>
      </tr>`).join('') || '<tr><td colspan="8"><div class="empty">No accounts match this filter.</div></td></tr>'}
      </tbody></table></div>`;
    document.getElementById('tableFilter').addEventListener('input', (e) => {
      state.filter = e.target.value;
      renderPortfolio();
    });
    bindAccountLinks(root);
  }

  function renderRevenue() {
    const rl = state.data.summary.revenue_lens;
    const conc = concentrationBlock(rl);
    document.getElementById('view').innerHTML = `<div class="cards">
      ${card('Red MRR (simulated at risk)', euro(rl.by_tier.Red.mrr), 'sample / fictitious')}
      ${card('Amber MRR', euro(rl.by_tier.Amber.mrr), 'sample / fictitious')}
      ${card('Green expansion MRR', euro(rl.by_tier.Green.mrr), 'sample / fictitious')}
      ${card('Onboarding MRR', euro((rl.by_tier.Onboarding && rl.by_tier.Onboarding.mrr) || 0), 'sample / fictitious')}
      ${card('Renewals window MRR', rl.upcoming_renewals ? euro(rl.upcoming_renewals.mrr) : '—', rl.upcoming_renewals ? '≤' + rl.upcoming_renewals.window_days + 'd' : '')}
    </div>
    ${conc.html}
    <div class="panel"><p class="muted small">All figures are SAMPLE/FICTITIOUS — not real protected revenue. at_risk_mrr counts <strong>Red only</strong>.</p></div>`;
  }

  function renderActions() {
    const q = state.data.summary.action_queue;
    const interventions = (state.data.weeks && state.data.weeks.interventions_simulated) || [];
    const root = document.getElementById('view');
    root.innerHTML = `<div class="panel"><h2>CSM Action Center</h2>${actionQueueTable(q)}</div>
    <div class="panel"><h2>Simulated intervention history</h2>
      ${interventions.length ? `<div class="table-wrap"><table><thead><tr><th>Week</th><th>Account</th><th>Action</th><th>Owner</th><th>Outcome</th></tr></thead>
      <tbody>${interventions.map((i) => `<tr><td>${i.week}</td><td>${i.account}</td><td class="action-cell">${i.action}</td><td>${i.owner}</td><td>${i.outcome}<div class="muted small">${i.label}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No simulated interventions for this profile.</div>'}
    </div>`;
    bindAccountLinks(root);
  }

  function renderAccount() {
    const a = state.data.accounts.find((x) => x.account === state.selectedAccount) || state.data.accounts[0];
    if (!a) {
      document.getElementById('view').innerHTML = '<div class="empty">No account selected.</div>';
      return;
    }
    state.selectedAccount = a.account;
    const hist = historyFor(a.account);
    const isPL = state.profileId === 'pricing-saas';
    const productBlock = isPL ? `
      <div class="panel"><h2><span class="tag tag-product">Product metrics</span></h2>
        <div class="cards">
          ${card('Days since login', a.days_since_dashboard_login != null ? a.days_since_dashboard_login : '—')}
          ${card('Autopush coverage', a.listings_with_autopush_pct != null ? a.listings_with_autopush_pct + '%' : '—')}
          ${card('Rec. accept', a.recommendation_accept_pct != null ? a.recommendation_accept_pct + '%' : '—')}
          ${card('PMS healthy', a.pms_integration_healthy == null ? '—' : (a.pms_integration_healthy ? 'Yes' : 'No'))}
          ${card('Properties connected', a.properties_connected != null ? a.properties_connected : (a.listings || '—'))}
          ${card('Recs applied (7d)', a.pricing_recs_applied_7d != null ? a.pricing_recs_applied_7d : '—')}
          ${card('Feature adoption', a.feature_adoption_score != null ? a.feature_adoption_score : '—')}
          ${card('Friction flags', a.support_friction_flags != null ? a.support_friction_flags : '—')}
        </div>
      </div>
      <div class="panel"><h2><span class="tag tag-commercial">Commercial metrics</span></h2>
        <div class="cards">
          ${card('MRR', euro(a.mrr), 'simulated')}
          ${card('Risk', a.risk_tier)}
          ${card('Health score', a.health_score == null ? '—' : a.health_score)}
          ${card('Renewal', a.days_to_renewal != null ? a.days_to_renewal + 'd' : '—')}
          ${card('Segment', a.segment || '—')}
          ${card('Owner', a.owner)}
        </div>
      </div>` : '';
    document.getElementById('view').innerHTML = `<div class="panel">
      <h2>Account 360 — ${a.account}</h2>
      <div class="cards">
        ${card('Health score', a.health_score == null ? '—' : a.health_score)}
        ${card('Risk', a.risk_tier)}
        ${card('MRR', euro(a.mrr), 'simulated')}
        ${card('Owner', a.owner)}
        ${card('Segment', a.segment || a.client_type || '—')}
        ${card('Renewal', a.days_to_renewal != null ? a.days_to_renewal + 'd' : '—')}
        ${card('Due', a.due_date || '—')}
      </div>
      <p><strong>Reason:</strong> ${a.reason}</p>
      <p><strong>Recommended action:</strong> ${a.recommended_action}</p>
      <p><strong>Top drivers:</strong> ${(a.top_drivers || []).map((d) => d.signal + ' ' + d.pts + '/' + d.max).join(', ') || '—'}</p>
      <p>Trend (8 weeks): ${sparkline(hist)}</p>
      <p class="muted small">Rules-based explanation only — not ML. ${state.data.config.data_label}</p>
    </div>${productBlock}`;
  }

  function renderTeamLead() {
    const s = state.data.summary;
    const series = weekSeries();
    const interventions = (state.data.weeks && state.data.weeks.interventions_simulated) || [];
    const highRisk = state.data.accounts.filter((a) => a.risk_tier === 'Red' || a.risk_tier === 'Amber');
    const windowDays = (s.revenue_lens.upcoming_renewals && s.revenue_lens.upcoming_renewals.window_days) || 45;
    const renewals = state.data.accounts
      .filter((a) => a.days_to_renewal != null && a.days_to_renewal <= windowDays)
      .sort((a, b) => a.days_to_renewal - b.days_to_renewal);
    const pending = s.action_queue.slice(0, 10);
    const conc = concentrationBlock(s.revenue_lens);
    const root = document.getElementById('view');
    root.innerHTML = `
      <div class="panel"><h2>CS Team Lead — workload by CSM</h2>
        <p class="muted small">Real-estate brokerage · FICTITIOUS portfolio · conceptual case only</p>
        <div class="table-wrap"><table>
          <thead><tr><th>CSM</th><th>Accounts</th><th>Red</th><th>Amber</th><th>Green</th><th>Onboarding</th><th>Workload signal</th><th>Simulated MRR at risk</th><th>Total MRR</th></tr></thead>
          <tbody>${(s.portfolio_by_csm || []).map((c) => {
            const load = c.red * 3 + c.amber * 2 + c.onboarding;
            const label = load >= 6 ? 'Heavy' : load >= 3 ? 'Moderate' : 'Light';
            return `<tr><td><strong>${c.owner}</strong></td><td>${c.accounts}</td><td>${c.red}</td><td>${c.amber}</td><td>${c.green}</td><td>${c.onboarding}</td><td>${label} (${load})</td><td>${euro(c.mrr_at_risk)}</td><td>${euro(c.mrr)}</td></tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>
      ${conc.html}
      <div class="grid-2">
        <div class="panel"><h2>High-risk clients (Red + Amber)</h2>
          <div class="table-wrap"><table><thead><tr><th>Account</th><th>Risk</th><th>Score</th><th>Owner</th><th>MRR</th></tr></thead>
          <tbody>${highRisk.map((a) => `<tr><td><button type="button" class="linkish" data-account="${a.account}">${a.account}</button></td><td>${pill(a.risk_tier)}</td><td>${a.health_score == null ? '—' : a.health_score}</td><td>${a.owner}</td><td>${euro(a.mrr)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">None</div></td></tr>'}</tbody></table></div>
        </div>
        <div class="panel"><h2>Upcoming renewals</h2>
          <div class="table-wrap"><table><thead><tr><th>Account</th><th>Days</th><th>Owner</th><th>MRR</th></tr></thead>
          <tbody>${renewals.map((a) => `<tr><td><button type="button" class="linkish" data-account="${a.account}">${a.account}</button></td><td>${a.days_to_renewal}d</td><td>${a.owner}</td><td>${euro(a.mrr)}</td></tr>`).join('') || '<tr><td colspan="4"><div class="empty">None in window</div></td></tr>'}</tbody></table></div>
        </div>
      </div>
      <div class="panel"><h2>Pending actions (top of queue)</h2>${actionQueueTable(pending)}</div>
      <div class="panel"><h2>Weekly evolution (simulated)</h2>
        ${series ? `<div class="table-wrap"><table><thead><tr><th>Week</th><th>Red</th><th>Amber</th><th>Green</th><th>Onboarding</th><th>Simulated MRR at risk</th></tr></thead>
        <tbody>${series.map((w) => `<tr><td>${w.label}</td><td>${w.red}</td><td>${w.amber}</td><td>${w.green}</td><td>${w.onboarding}</td><td>${euro(w.at_risk_mrr)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No weekly series</div>'}
      </div>
      <div class="panel"><h2>Intervention results (SIMULATED)</h2>
        ${interventions.length ? `<div class="table-wrap"><table><thead><tr><th>Week</th><th>Account</th><th>Owner</th><th>Outcome</th></tr></thead>
        <tbody>${interventions.map((i) => `<tr><td>${i.week}</td><td>${i.account}</td><td>${i.owner}</td><td>${i.outcome}<div class="muted small">${i.label}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">None</div>'}
      </div>`;
    bindAccountLinks(root);
  }

  function renderAdoption() {
    // Pricing SaaS: Adoption → Value → Retention
    const accounts = state.data.accounts.filter((a) => a.risk_tier !== 'Onboarding');
    const onb = state.data.accounts.filter((a) => a.risk_tier === 'Onboarding');
    const avg = (arr, fn) => arr.length ? Math.round(arr.reduce((s, a) => s + (fn(a) || 0), 0) / arr.length) : 0;
    const adoptionPct = avg(accounts, (a) => a.listings_with_autopush_pct);
    const valueProxy = avg(accounts, (a) => a.recommendation_accept_pct);
    const loginFresh = accounts.filter((a) => (a.days_since_dashboard_login || 99) <= 7).length;
    const friction = accounts.filter((a) => (a.support_friction_flags || 0) >= 2 || (a.open_tickets || 0) >= 4).length;
    const retainedHealthy = accounts.filter((a) => a.risk_tier === 'Green').length;
    const atRisk = accounts.filter((a) => a.risk_tier === 'Red' || a.risk_tier === 'Amber').length;
    const root = document.getElementById('view');
    root.innerHTML = `
      <p class="muted small">Dynamic pricing SaaS · <strong>product metrics</strong> vs <strong>commercial metrics</strong> kept separate · FICTITIOUS data.</p>
      <div class="chain">
        <div class="card"><div class="label">1 · Adoption</div><div class="value">${adoptionPct}%</div><div class="hint">avg autopush coverage (product)</div></div>
        <div class="card step-2"><div class="label">2 · Value</div><div class="value">${valueProxy}%</div><div class="hint">avg recommendation accept (product)</div></div>
        <div class="card step-3"><div class="label">3 · Retention</div><div class="value">${retainedHealthy}/${accounts.length}</div><div class="hint">Green among scored · ${atRisk} at risk</div></div>
      </div>
      <div class="metric-split">
        <div class="panel"><h2><span class="tag tag-product">Product metrics</span></h2>
          <div class="cards">
            ${card('Fresh logins ≤7d', loginFresh + '/' + accounts.length)}
            ${card('Avg autopush %', adoptionPct + '%')}
            ${card('Avg rec. accept %', valueProxy + '%')}
            ${card('Friction accounts', friction)}
            ${card('Onboarding (tenure)', onb.length)}
          </div>
          <div class="table-wrap" style="margin-top:10px"><table>
            <thead><tr><th>Account</th><th>Login d</th><th>Autopush</th><th>Accept</th><th>PMS</th><th>Friction</th></tr></thead>
            <tbody>${state.data.accounts.map((a) => `<tr>
              <td><button type="button" class="linkish" data-account="${a.account}">${a.account}</button></td>
              <td>${a.days_since_dashboard_login != null ? a.days_since_dashboard_login : '—'}</td>
              <td>${a.listings_with_autopush_pct != null ? a.listings_with_autopush_pct + '%' : '—'}</td>
              <td>${a.recommendation_accept_pct != null ? a.recommendation_accept_pct + '%' : '—'}</td>
              <td>${a.pms_integration_healthy == null ? '—' : (a.pms_integration_healthy ? 'Yes' : 'No')}</td>
              <td>${a.support_friction_flags != null ? a.support_friction_flags : '—'}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="panel"><h2><span class="tag tag-commercial">Commercial metrics</span></h2>
          <div class="cards">
            ${card('Simulated MRR at risk', euro(state.data.summary.at_risk_mrr), 'Red only')}
            ${card('Expansion MRR', euro(state.data.summary.revenue_lens.expansion_pipeline_green.mrr))}
            ${card('Renewals window', state.data.summary.revenue_lens.upcoming_renewals ? state.data.summary.revenue_lens.upcoming_renewals.accounts : '—')}
          </div>
          ${concentrationBlock(state.data.summary.revenue_lens).html}
          <div class="table-wrap"><table>
            <thead><tr><th>Account</th><th>Risk</th><th>Score</th><th>MRR</th><th>Renewal</th><th>Owner</th></tr></thead>
            <tbody>${state.data.accounts.map((a) => `<tr>
              <td><button type="button" class="linkish" data-account="${a.account}">${a.account}</button></td>
              <td>${pill(a.risk_tier)}</td>
              <td>${a.health_score == null ? '—' : a.health_score}</td>
              <td>${euro(a.mrr)}</td>
              <td>${a.days_to_renewal != null ? a.days_to_renewal + 'd' : '—'}</td>
              <td>${a.owner}</td>
            </tr>`).join('')}</tbody>
          </table></div>
        </div>
      </div>`;
    bindAccountLinks(root);
  }

  function renderGlossary() {
    const cfg = state.data.config;
    const gloss = cfg.metric_glossary || {};
    const explain = cfg.scoring_explanation || {};
    const weights = (explain.weights || cfg.weights || {});
    const thr = explain.thresholds || cfg.thresholds || {};
    const root = document.getElementById('view');
    root.innerHTML = `
      <div class="panel">
        <h2>How the Health Score is calculated</h2>
        <p class="small">Model: <strong>${explain.model || 'rules-based (not ML)'}</strong>. Scores are explainable and reproducible — not machine learning.</p>
        <div class="cards">
          ${Object.keys(weights).map((k) => card('Weight · ' + k, weights[k])).join('') || card('Weights', 'n/a')}
          ${card('Red threshold', '&lt;' + (thr.red != null ? thr.red : 45))}
          ${card('Amber threshold', '&lt;' + (thr.amber != null ? thr.amber : 70))}
          ${card('Onboarding grace', (explain.onboarding_grace_days != null ? explain.onboarding_grace_days : (cfg.min_tenure_days || 0)) + 'd tenure')}
        </div>
        <p class="small"><strong>at_risk_mrr:</strong> ${explain.at_risk_definition || 'Red MRR only'} (simulated SAMPLE/FICTITIOUS figures).</p>
        <p class="small"><strong>Each account shows:</strong> Health Score + Risk Level + Reason + Recommended Action (+ top drivers).</p>
        <h3 style="font-size:0.9rem;margin:14px 0 6px">Limitations</h3>
        <ul class="small muted">${(explain.limitations || ['Uncalibrated','Fictitious data','Slack NoOp']).map((l) => '<li>' + l + '</li>').join('')}</ul>
      </div>
      <div class="panel">
        <h2>Metric glossary — ${cfg.profile_name || state.profileId}</h2>
        <p class="muted small">All demo figures are labelled fictitious. Sector profiles are generic archetypes, not real companies.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Metric</th><th>Meaning in this demo</th></tr></thead>
          <tbody>${Object.keys(gloss).map((k) => `<tr><td><code>${k}</code></td><td>${gloss[k]}</td></tr>`).join('') || '<tr><td colspan="2"><div class="empty">No glossary</div></td></tr>'}
          </tbody>
        </table></div>
      </div>`;
  }

  function syncNav() {
    document.querySelectorAll('nav .navbtn').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.view === state.view ? 'page' : 'false');
    });
  }

  function render() {
    syncNav();
    if (state.view === 'overview') renderOverview();
    else if (state.view === 'portfolio') renderPortfolio();
    else if (state.view === 'revenue') renderRevenue();
    else if (state.view === 'actions') renderActions();
    else if (state.view === 'account') renderAccount();
    else if (state.view === 'teamlead') renderTeamLead();
    else if (state.view === 'adoption') renderAdoption();
    else if (state.view === 'glossary') renderGlossary();
  }

  function init() {
    try {
      loadCatalog();
    } catch (err) {
      document.getElementById('view').innerHTML = '<div class="empty"><strong>Demo bundle missing.</strong><br/>Open <code>START-HERE.html</code> from the unzipped folder (double-click). Error: ' + String(err.message || err) + '</div>';
      return;
    }
    const requested = (() => {
      try {
        const q = new URLSearchParams(location.search || '').get('profile');
        if (q) return String(q).toLowerCase();
        const h = String(location.hash || '');
        const m = h.match(/profile=([a-z0-9_-]+)/i);
        return m ? m[1].toLowerCase() : '';
      } catch (e) {
        return '';
      }
    })();
    if (requested && state.catalog.profiles.some((p) => p.id === requested)) state.profileId = requested;
    else if (state.catalog.profiles.some((p) => p.id === 'healthcare')) state.profileId = 'healthcare';
    document.getElementById('profileSelect').addEventListener('change', (e) => loadProfile(e.target.value));
    document.querySelectorAll('nav .navbtn').forEach((b) =>
      b.addEventListener('click', () => {
        state.view = b.dataset.view;
        render();
      })
    );
    loadProfile(state.profileId);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
