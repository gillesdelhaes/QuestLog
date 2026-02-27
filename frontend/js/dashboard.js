/* ── Dashboard — quest board rendering ────────────────────────────────────── */

import { quests as questsApi, APIError } from './api.js';
import { showToast, refreshCombo, switchTab } from './app.js';
import { openQuestDetail } from './quest-detail.js';
import { openNewQuestForm } from './quest-form.js';

let questCache = [];

// ── Entry point ────────────────────────────────────────────────────────────
export async function renderDashboard(filter = 'active') {
  const gridEl = filter === 'active'
    ? document.getElementById('active-quest-grid')
    : document.getElementById('completed-quest-grid');
  if (!gridEl) return;

  gridEl.innerHTML = `<div class="empty-state"><div class="loader"></div></div>`;

  try {
    const all = await questsApi.list();
    questCache = all;

    const filtered = filter === 'active'
      ? all.filter(q => q.status === 'active' || q.status === 'paused')
      : all.filter(q => q.status === 'completed' || q.status === 'failed');

    if (filtered.length === 0) {
      gridEl.innerHTML = emptyState(filter);
      return;
    }

    gridEl.innerHTML = '';
    filtered.forEach(q => {
      const card = buildQuestCard(q);
      gridEl.appendChild(card);
    });

    refreshCombo();
  } catch (err) {
    gridEl.innerHTML = `<p class="text-red">Failed to load quests: ${err.message}</p>`;
  }
}

// ── Card builder ───────────────────────────────────────────────────────────
function buildQuestCard(q) {
  const el = document.createElement('div');
  el.className = `quest-card status-${q.status}`;
  el.dataset.questId = q.id;

  const statusTag = `<span class="card-status-tag ${q.status}">${statusLabel(q.status)}</span>`;

  const typeBadge = `<span class="card-type-badge">${typeLabel(q.type)}</span>`;

  const body = buildCardBody(q);
  const actions = buildCardActions(q);

  el.innerHTML = `
    <div class="card-header">
      <span class="card-emoji">${q.emoji}</span>
      <div class="card-title-block">
        <div class="card-title" title="${escHtml(q.title)}">${escHtml(q.title)}</div>
        ${typeBadge}
      </div>
      ${statusTag}
    </div>
    ${body}
    ${actions}
  `;

  // Detail click on emoji/title
  el.querySelector('.card-emoji').addEventListener('click', () => openQuestDetail(q.id));
  el.querySelector('.card-title').addEventListener('click', () => openQuestDetail(q.id));

  return el;
}

function buildCardBody(q) {
  switch (q.type) {
    case 'streak':   return buildStreakBody(q);
    case 'counter':  return buildCounterBody(q);
    case 'boss_battle': return buildBossBody(q);
    case 'milestone':   return buildMilestoneBody(q);
    case 'weekly_quota': return buildWeeklyBody(q);
    default: return '';
  }
}

function buildStreakBody(q) {
  const flame = q.current_streak > 0 ? '🔥' : '❄️';
  const lives = buildLives(q);
  return `
    <div class="streak-display">
      <span class="streak-count">${flame} ${q.current_streak}</span>
      <span class="streak-unit">day streak</span>
      <span class="streak-best">Best: ${q.best_streak}</span>
    </div>
    ${lives}
  `;
}

function buildCounterBody(q) {
  const unit = q.unit || '';
  const lives = buildLives(q);
  return `
    <div class="streak-display">
      <span class="streak-count">🔥 ${q.current_streak}</span>
      <span class="streak-unit">day streak</span>
      <span class="streak-best">Best: ${q.best_streak}</span>
    </div>
    ${q.daily_target ? `<div class="text-dim" style="font-size:0.8rem">Target: ${q.daily_target} ${unit}</div>` : ''}
    ${lives}
  `;
}

function calcNumericPct(q) {
  if (!q.numeric_target) return 0;
  if (q.goal_direction === 'below') {
    const start = q.numeric_start ?? q.numeric_current;
    const range = start - q.numeric_target;
    if (range <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((start - (q.numeric_current || 0)) / range * 100)));
  }
  return Math.min(100, Math.round((q.numeric_current || 0) / q.numeric_target * 100));
}

function buildBossBody(q) {
  const pct  = calcNumericPct(q);
  const unit = q.unit || '';
  const dir  = q.goal_direction === 'below' ? '📉' : '📈';
  const deadline = q.deadline ? `⚔️ By ${q.deadline}` : '';
  return `
    <div style="margin-bottom:0.5rem">
      <div class="xp-bar-wrap"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-top:0.25rem">
        <span class="text-teal">${dir} ${q.numeric_current || 0} → ${q.numeric_target} ${unit}</span>
        <span class="text-dim">${pct}%</span>
      </div>
    </div>
    ${deadline ? `<div class="text-dim" style="font-size:0.75rem">${deadline}</div>` : ''}
  `;
}

function buildMilestoneBody(q) {
  const pct  = calcNumericPct(q);
  const unit = q.unit || '';
  const dir  = q.goal_direction === 'below' ? '📉' : '📈';
  return `
    <div style="margin-bottom:0.5rem">
      <div class="xp-bar-wrap"><div class="xp-bar-fill gold" style="width:${pct}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-top:0.25rem">
        <span class="text-gold">${dir} ${q.numeric_current || 0} → ${q.numeric_target} ${unit}</span>
        <span class="text-dim">${pct}%</span>
      </div>
    </div>
  `;
}

function buildWeeklyBody(q) {
  const count   = q.current_week_count || 0;
  const target  = q.weekly_target || 1;
  const weeks   = q.current_streak || 0;
  const pills   = Array.from({ length: target }, (_, i) =>
    `<div class="week-pill ${i < count ? 'filled' : 'empty'}">${i < count ? '✓' : ''}</div>`
  ).join('');

  return `
    <div class="week-pills" style="margin-bottom:0.5rem">${pills}</div>
    <div style="font-size:0.75rem;color:var(--text-dim)">
      ${count}/${target} this week &nbsp;·&nbsp; 🔥 ${weeks} week streak
    </div>
  `;
}

function buildLives(q) {
  if (q.failure_mode !== 'freeze_lives' || q.lives_max == null) return '';
  const max = q.lives_max;
  const rem = q.lives_remaining ?? max;
  let html = '<div class="lives-display">';
  for (let i = 0; i < max; i++) {
    html += `<span class="heart ${i < rem ? '' : 'empty'}">❤️</span>`;
  }
  html += '</div>';
  return html;
}

function buildCardActions(q) {
  if (q.status === 'completed' || q.status === 'failed') {
    return `<div class="card-actions">
      <button class="btn btn-ghost btn-sm" onclick="window._qlViewDetail(${q.id})">View Details</button>
    </div>`;
  }

  let actions = [];

  if (q.status === 'paused') {
    actions.push(`<button class="btn btn-secondary btn-sm" onclick="window._qlResumeQuest(${q.id})">▶ Resume</button>`);
    actions.push(`<button class="btn btn-ghost btn-sm" onclick="window._qlViewDetail(${q.id})">Details</button>`);
    return `<div class="card-actions">${actions.join('')}</div>`;
  }

  // Active quests
  if (q.type === 'streak') {
    if (q.today_checked) {
      actions.push(`<button class="btn btn-ghost btn-sm checkin-done">✓ Done today</button>`);
    } else {
      actions.push(`<button class="btn btn-success btn-sm" onclick="window._qlCheckin(${q.id},'streak',true)">✅ Done</button>`);
      actions.push(`<button class="btn btn-danger btn-sm" onclick="window._qlCheckin(${q.id},'streak',false)">❌ Missed</button>`);
    }
  } else if (q.type === 'counter') {
    if (q.today_checked) {
      actions.push(`<button class="btn btn-ghost btn-sm checkin-done">✓ Logged today</button>`);
    } else {
      actions.push(`<button class="btn btn-success btn-sm" onclick="window._qlCounterLog(${q.id})"
        >📊 Log</button>`);
    }
  } else if (q.type === 'boss_battle' || q.type === 'milestone') {
    actions.push(`<button class="btn btn-primary btn-sm" onclick="window._qlNumericUpdate(${q.id})">📈 Update</button>`);
  } else if (q.type === 'weekly_quota') {
    actions.push(`<button class="btn btn-success btn-sm" onclick="window._qlCheckin(${q.id},'weekly_quota')">✚ Log it</button>`);
  }

  actions.push(`<button class="btn btn-ghost btn-sm" onclick="window._qlPauseQuest(${q.id})" title="Pause">⏸</button>`);
  actions.push(`<button class="btn btn-ghost btn-sm" onclick="window._qlCompleteQuest(${q.id})" title="Mark as complete">✔</button>`);
  actions.push(`<button class="btn btn-ghost btn-sm" onclick="window._qlViewDetail(${q.id})">📋</button>`);

  return `<div class="card-actions">${actions.join('')}</div>`;
}

// ── Global action handlers (attached to window for inline onclick) ─────────
window._qlViewDetail = (id) => openQuestDetail(id);

window._qlCheckin = async (id, type, success) => {
  try {
    const body = type === 'streak' ? { success } : {};
    const res = await questsApi.checkin(id, body);
    showToast(success !== false ? 'Check-in logged! 🔥' : 'Missed day recorded.', success !== false ? 'success' : 'error');
    showBadgeToasts(res.new_badges);
    renderDashboard('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window._qlCounterLog = (id) => {
  const quest = questCache.find(q => q.id === id);
  const unit = quest?.unit || '';
  const target = quest?.daily_target || '';
  openCounterModal(id, unit, target);
};

window._qlNumericUpdate = (id) => {
  const quest = questCache.find(q => q.id === id);
  const unit = quest?.unit || '';
  const current = quest?.numeric_current || 0;
  openNumericModal(id, unit, current);
};

window._qlPauseQuest = async (id) => {
  try {
    await questsApi.pause(id);
    showToast('Quest paused.', 'info');
    renderDashboard('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window._qlResumeQuest = async (id) => {
  try {
    await questsApi.resume(id);
    showToast('Quest resumed! ⚔️', 'success');
    renderDashboard('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window._qlCompleteQuest = async (id) => {
  const quest = questCache.find(q => q.id === id);
  const name = quest ? `"${quest.emoji} ${quest.title}"` : 'this quest';
  if (!confirm(`Mark ${name} as complete?`)) return;
  try {
    const res = await questsApi.complete(id);
    showToast('Quest completed! 🏆', 'success');
    showBadgeToasts(res.new_badges);
    renderDashboard('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ── Badge toast notifications ──────────────────────────────────────────────
function showBadgeToasts(badgeKeys) {
  if (!badgeKeys?.length) return;
  // Import badge meta inline to avoid circular deps
  const BADGE_META = {
    seedling:       { emoji: '🌱', label: 'Seedling' },
    first_flame:    { emoji: '🔥', label: 'First Flame' },
    ironclad:       { emoji: '💀', label: 'Ironclad' },
    chain_lightning:{ emoji: '⚡', label: 'Chain Lightning' },
    boss_slayer:    { emoji: '🏆', label: 'Boss Slayer' },
    hydrated_hero:  { emoji: '💧', label: 'Hydrated Hero' },
    veteran:        { emoji: '🗡️', label: 'Veteran' },
    legendary:      { emoji: '👑', label: 'Legendary' },
    weekly_warrior: { emoji: '📅', label: 'Weekly Warrior' },
    untouchable:    { emoji: '🛡️', label: 'Untouchable' },
  };
  badgeKeys.forEach(key => {
    const meta = BADGE_META[key] || { emoji: '🏅', label: key };
    showToast(`Badge unlocked: ${meta.emoji} ${meta.label}`, 'success');
  });
}

// ── Counter log modal ──────────────────────────────────────────────────────
function openCounterModal(questId, unit, target) {
  const overlay = document.getElementById('counter-modal');
  const title   = overlay.querySelector('.modal-header h2');
  const input   = overlay.querySelector('#counter-value');
  const form    = overlay.querySelector('#counter-form');

  title.textContent = `Log Today's Value ${unit ? `(${unit})` : ''}`;
  if (target) overlay.querySelector('#counter-target-hint').textContent = `Target: ${target} ${unit}`;
  input.value = '';
  overlay.classList.remove('hidden');
  input.focus();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const value = parseFloat(input.value);
    if (isNaN(value)) return;
    try {
      await questsApi.checkin(questId, { value });
      showToast('Logged! 📊', 'success');
      overlay.classList.add('hidden');
      renderDashboard('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ── Numeric update modal ───────────────────────────────────────────────────
function openNumericModal(questId, unit, current) {
  const overlay = document.getElementById('numeric-modal');
  const input   = overlay.querySelector('#numeric-value');
  const form    = overlay.querySelector('#numeric-form');

  overlay.querySelector('#numeric-unit-hint').textContent = unit ? `Unit: ${unit}` : '';
  input.value = current;
  overlay.classList.remove('hidden');
  input.focus();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const value = parseFloat(input.value);
    if (isNaN(value)) return;
    try {
      await questsApi.updateNumeric(questId, value);
      showToast('Progress updated! 📈', 'success');
      overlay.classList.add('hidden');
      renderDashboard('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function statusLabel(s) {
  return { active: 'Active', completed: 'Victory!', failed: 'Defeated', paused: 'Paused' }[s] || s;
}

function typeLabel(t) {
  return {
    streak: 'Streak',
    counter: 'Counter',
    boss_battle: 'Boss Battle',
    milestone: 'Milestone',
    weekly_quota: 'Weekly Quota',
  }[t] || t;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emptyState(filter) {
  if (filter === 'active') {
    return `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">⚔️</div>
      <h3>No Active Quests</h3>
      <p>Your quest log is empty. Create your first quest to begin your adventure.</p>
      <button class="btn btn-primary" onclick="window._qlOpenNewQuest()">+ New Quest</button>
    </div>`;
  }
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-icon">🏆</div>
    <h3>No Completed Quests Yet</h3>
    <p>Completed and failed quests will appear here.</p>
  </div>`;
}

// Hook up the New Quest button
window._qlOpenNewQuest = () => openNewQuestForm();
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-quest')?.addEventListener('click', () => openNewQuestForm());

  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById(btn.dataset.closeModal);
      if (modal) modal.classList.add('hidden');
    });
  });
});
