/* ── Quest Detail modal ───────────────────────────────────────────────────── */

import { quests as questsApi } from './api.js';
import { showToast } from './app.js';
import { renderDashboard } from './dashboard.js';

// ── Open ───────────────────────────────────────────────────────────────────
export async function openQuestDetail(questId) {
  const overlay = document.getElementById('quest-detail-modal');
  overlay.classList.remove('hidden');
  overlay.querySelector('#detail-body').innerHTML = `<div class="text-center" style="padding:2rem"><div class="loader"></div></div>`;

  try {
    const quest = await questsApi.get(questId);
    renderDetail(quest);
  } catch (err) {
    overlay.querySelector('#detail-body').innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

function closeDetail() {
  document.getElementById('quest-detail-modal').classList.add('hidden');
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderDetail(quest) {
  const body = document.getElementById('detail-body');
  const typeLabelMap = {
    streak: 'Streak Quest',
    counter: 'Counter Quest',
    boss_battle: 'Boss Battle',
    milestone: 'Milestone Quest',
    weekly_quota: 'Weekly Quota Quest',
  };

  const statusColor = { active: 'green', completed: 'gold', failed: 'red', paused: 'teal' };

  body.innerHTML = `
    <div class="quest-detail-header">
      <span class="quest-detail-emoji">${quest.emoji}</span>
      <div class="quest-detail-info">
        <h2>${escHtml(quest.title)}</h2>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-top:0.25rem;flex-wrap:wrap">
          <span class="card-type-badge">${typeLabelMap[quest.type] || quest.type}</span>
          <span class="card-status-tag ${quest.status}" style="display:inline-block">
            ${statusTag(quest.status)}
          </span>
        </div>
        ${quest.description ? `<p style="font-size:0.85rem;color:var(--text-dim);margin-top:0.5rem">${escHtml(quest.description)}</p>` : ''}
      </div>
    </div>

    ${buildStats(quest)}
    ${buildHeatmap(quest)}
    ${buildActions(quest)}
    ${buildLog(quest)}
  `;

  // Wire up delete / edit quest
  body.querySelector('#btn-delete-quest')?.addEventListener('click', () => confirmDelete(quest));
  body.querySelector('#btn-edit-quest')?.addEventListener('click', () => openEditModal(quest));

  // Wire up retroactive check-in editing (heatmap cells + log row buttons)
  body.querySelectorAll('[data-edit-date]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditCheckinModal(quest, el.dataset.editDate);
    });
  });
}

function buildStats(q) {
  const parts = [];

  if (['streak', 'counter', 'weekly_quota'].includes(q.type)) {
    parts.push(statBox('🔥', 'Current Streak', streakLabel(q)));
    parts.push(statBox('⭐', 'Best Streak', bestStreakLabel(q)));
  }

  if (['boss_battle', 'milestone'].includes(q.type)) {
    const pct = q.numeric_target ? Math.min(100, Math.round(((q.numeric_current || 0) / q.numeric_target) * 100)) : 0;
    const unit = q.unit || '';
    parts.push(statBox('📈', 'Progress', `${q.numeric_current || 0} / ${q.numeric_target} ${unit}`));
    parts.push(statBox('🎯', 'Completion', `${pct}%`));
    if (q.deadline) parts.push(statBox('📅', 'Deadline', q.deadline));
  }

  if (q.type === 'weekly_quota') {
    parts.push(statBox('📅', 'This Week', `${q.current_week_count} / ${q.weekly_target}`));
  }

  if (q.failure_mode === 'freeze_lives' && q.lives_max) {
    const rem = q.lives_remaining ?? q.lives_max;
    const hearts = Array.from({ length: q.lives_max }, (_, i) =>
      `<span class="heart ${i < rem ? '' : 'empty'}">❤️</span>`
    ).join('');
    parts.push(`<div class="stat-card"><div class="lives-display" style="justify-content:center">${hearts}</div><div class="stat-label">Lives</div></div>`);
  }

  if (!parts.length) return '';
  return `<div class="profile-stats-grid" style="margin-bottom:1.25rem">${parts.join('')}</div>`;
}

function statBox(icon, label, value) {
  return `<div class="stat-card">
    <span class="stat-value">${icon} ${escHtml(String(value))}</span>
    <div class="stat-label">${escHtml(label)}</div>
  </div>`;
}

function streakLabel(q) {
  if (q.type === 'weekly_quota') return `${q.current_streak} weeks`;
  return `${q.current_streak} days`;
}

function bestStreakLabel(q) {
  if (q.type === 'weekly_quota') return `${q.best_streak} weeks`;
  return `${q.best_streak} days`;
}

function buildHeatmap(q) {
  if (!q.checkins?.length) return '';
  if (!['streak', 'counter'].includes(q.type)) return '';

  const byDate = {};
  for (const c of q.checkins) byDate[c.logged_at] = c;

  const today = new Date();
  const cells = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const c = byDate[key];
    let cls = '';
    let title = key;
    if (c) {
      if (c.life_used) { cls = 'life-used'; title += ' (life used)'; }
      else if (c.success) { cls = 'success'; title += ' ✓'; }
      else { cls = 'failure'; title += ' ✗'; }
    }
    const editable = i <= 6;
    if (editable) {
      cells.push(`<button class="heatmap-cell ${cls} heatmap-editable" title="${title} — click to edit" data-edit-date="${key}"></button>`);
    } else {
      cells.push(`<div class="heatmap-cell ${cls}" title="${title}"></div>`);
    }
  }

  return `
    <div style="margin-bottom:1.25rem">
      <div class="section-title">Last 90 Days</div>
      <div class="heatmap">${cells.join('')}</div>
      <div style="display:flex;gap:1rem;font-size:0.7rem;color:var(--text-dim);margin-top:0.5rem">
        <span><span style="color:var(--green)">■</span> Success</span>
        <span><span style="color:var(--red-dim)">■</span> Miss</span>
        <span><span style="color:var(--gold-dim)">■</span> Life used</span>
      </div>
    </div>`;
}

function buildActions(q) {
  const btns = [];
  if (q.status === 'active') {
    btns.push(`<button class="btn btn-danger btn-sm" id="btn-delete-quest">🗑 Delete</button>`);
    btns.push(`<button class="btn btn-secondary btn-sm" id="btn-edit-quest">✏️ Edit</button>`);
  } else {
    btns.push(`<button class="btn btn-danger btn-sm" id="btn-delete-quest">🗑 Delete</button>`);
  }
  return `<div style="display:flex;gap:0.5rem;margin-bottom:1.25rem;flex-wrap:wrap">${btns.join('')}</div>`;
}

function buildLog(q) {
  if (!q.checkins?.length) {
    return `<div class="section-title">Activity Log</div><p class="text-dim" style="font-size:0.85rem">No activity yet.</p>`;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const minEdit = new Date();
  minEdit.setDate(minEdit.getDate() - 7);
  const minEditStr = minEdit.toISOString().split('T')[0];
  const canEdit = ['streak', 'counter'].includes(q.type);

  const rows = q.checkins.slice(0, 30).map(c => {
    let icon, cls;
    if (c.life_used)    { icon = '🛡️'; cls = 'ci-life'; }
    else if (c.success) { icon = '✅'; cls = 'ci-success'; }
    else                { icon = '❌'; cls = 'ci-failure'; }

    const value = c.value != null ? `${c.value}` : '';
    const notes = c.notes ? ` — ${escHtml(c.notes)}` : '';
    const editable = canEdit && c.logged_at >= minEditStr && c.logged_at <= todayStr;

    return `<li class="checkin-item ${cls}">
      <span class="ci-date">${c.logged_at}</span>
      <span class="ci-icon"></span>
      <span style="font-size:0.8rem">${icon}${notes ? notes : ''}</span>
      ${value ? `<span class="ci-value">${value}</span>` : ''}
      ${editable ? `<button class="btn-edit-ci" data-edit-date="${c.logged_at}" title="Edit this check-in">✏️</button>` : ''}
    </li>`;
  }).join('');

  return `
    <div class="section-title">Activity Log</div>
    <ul class="checkin-log">${rows}</ul>`;
}

// ── Delete confirmation ────────────────────────────────────────────────────
function confirmDelete(quest) {
  const overlay = document.getElementById('confirm-modal');
  overlay.querySelector('#confirm-title').textContent = `Delete "${quest.title}"?`;
  overlay.querySelector('#confirm-msg').textContent = 'This will permanently delete the quest and all its history.';
  overlay.classList.remove('hidden');

  const btnConfirm = overlay.querySelector('#btn-confirm-yes');
  const btnCancel  = overlay.querySelector('#btn-confirm-no');

  const cleanup = () => { overlay.classList.add('hidden'); };

  btnCancel.onclick = cleanup;
  btnConfirm.onclick = async () => {
    try {
      await questsApi.delete(quest.id);
      cleanup();
      closeDetail();
      showToast('Quest deleted.', 'info');
      renderDashboard('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ── Edit modal ─────────────────────────────────────────────────────────────
function openEditModal(quest) {
  const overlay = document.getElementById('edit-quest-modal');
  overlay.querySelector('#edit-title').value  = quest.title;
  overlay.querySelector('#edit-emoji').value  = quest.emoji;
  overlay.querySelector('#edit-desc').value   = quest.description || '';

  overlay.classList.remove('hidden');

  overlay.querySelector('#edit-quest-form').onsubmit = async (e) => {
    e.preventDefault();
    const title = overlay.querySelector('#edit-title').value.trim();
    const emoji = overlay.querySelector('#edit-emoji').value.trim();
    const description = overlay.querySelector('#edit-desc').value.trim() || null;

    if (!title) return;
    try {
      await questsApi.update(quest.id, { title, emoji, description });
      showToast('Quest updated.', 'success');
      overlay.classList.add('hidden');
      openQuestDetail(quest.id);
      renderDashboard('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ── Edit Past Check-in Modal ───────────────────────────────────────────────
function openEditCheckinModal(quest, dateStr) {
  const overlay = document.getElementById('edit-checkin-modal');
  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  overlay.querySelector('#edit-checkin-date').textContent = `Edit — ${dateLabel}`;

  const streakFields  = overlay.querySelector('#edit-checkin-streak-fields');
  const counterFields = overlay.querySelector('#edit-checkin-counter-fields');

  if (quest.type === 'streak') {
    streakFields.classList.remove('hidden');
    counterFields.classList.add('hidden');
  } else {
    streakFields.classList.add('hidden');
    counterFields.classList.remove('hidden');
    const hint = quest.unit ? `Target: ${quest.daily_target} ${quest.unit}` : `Target: ${quest.daily_target}`;
    overlay.querySelector('#edit-checkin-unit').textContent = hint;
  }

  // Pre-populate from existing check-in data
  const existing = quest.checkins?.find(c => c.logged_at === dateStr);
  const successInput = overlay.querySelector('#edit-checkin-success');
  const doneBtn   = overlay.querySelector('#btn-checkin-done');
  const missedBtn = overlay.querySelector('#btn-checkin-missed');

  function setToggle(isSuccess) {
    successInput.value = isSuccess ? 'true' : 'false';
    doneBtn.className   = isSuccess ? 'btn btn-sm btn-success' : 'btn btn-sm btn-ghost';
    missedBtn.className = isSuccess ? 'btn btn-sm btn-ghost'   : 'btn btn-sm btn-danger';
  }

  if (quest.type === 'streak') {
    setToggle(existing ? existing.success : true);
    doneBtn.onclick   = () => setToggle(true);
    missedBtn.onclick = () => setToggle(false);
  } else {
    overlay.querySelector('#edit-checkin-value').value = existing?.value ?? '';
  }
  overlay.querySelector('#edit-checkin-notes').value = existing?.notes || '';

  overlay.classList.remove('hidden');

  overlay.querySelector('#edit-checkin-form').onsubmit = async (e) => {
    e.preventDefault();
    const body = { notes: overlay.querySelector('#edit-checkin-notes').value.trim() || null };
    if (quest.type === 'streak') {
      body.success = successInput.value === 'true';
    } else {
      body.value = parseFloat(overlay.querySelector('#edit-checkin-value').value);
    }
    try {
      await questsApi.editCheckin(quest.id, dateStr, body);
      showToast('Check-in updated!', 'success');
      overlay.classList.add('hidden');
      openQuestDetail(quest.id);
      renderDashboard('active');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function statusTag(s) {
  return { active: 'Active', completed: 'Victory!', failed: 'Defeated', paused: 'Paused' }[s] || s;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Wire up close ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-close-detail')?.addEventListener('click', closeDetail);
  document.getElementById('quest-detail-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetail();
  });

  document.getElementById('btn-close-edit')?.addEventListener('click', () => {
    document.getElementById('edit-quest-modal').classList.add('hidden');
  });

  const closeEditCheckin = () => document.getElementById('edit-checkin-modal').classList.add('hidden');
  document.getElementById('btn-close-edit-checkin')?.addEventListener('click', closeEditCheckin);
  document.getElementById('btn-cancel-edit-checkin')?.addEventListener('click', closeEditCheckin);
  document.getElementById('edit-checkin-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEditCheckin();
  });
});
