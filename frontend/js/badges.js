/* ── Badges page rendering ────────────────────────────────────────────────── */

import { badges as badgesApi } from './api.js';

export async function renderBadges() {
  const el = document.getElementById('badges-view');
  if (!el) return;

  el.innerHTML = `
    <h2 class="section-title">Achievements</h2>
    <div class="text-center" style="padding:2rem"><div class="loader"></div></div>`;

  try {
    const data = await badgesApi.get();
    el.innerHTML = buildBadgesHTML(data);
  } catch (err) {
    el.innerHTML = `<p class="text-red">Failed to load badges: ${err.message}</p>`;
  }
}

function buildBadgesHTML(data) {
  const { earned, locked } = data;

  let html = '';

  if (earned.length) {
    html += `<div class="section-title">Earned (${earned.length})</div>
    <div class="badges-grid" style="margin-bottom:2rem">
      ${earned.map(b => badgeCard(b, true)).join('')}
    </div>`;
  }

  if (locked.length) {
    html += `<div class="section-title">Locked (${locked.length})</div>
    <div class="badges-grid">
      ${locked.map(b => badgeCard(b, false)).join('')}
    </div>`;
  }

  if (!earned.length && !locked.length) {
    html = `<div class="empty-state">
      <div class="empty-icon">🏅</div>
      <h3>No Badges Yet</h3>
      <p>Complete quests and build streaks to earn badges.</p>
    </div>`;
  }

  return html;
}

function badgeCard(b, earned) {
  const dateStr = earned && b.earned_at
    ? `<div style="font-size:0.65rem;color:var(--text-dim);margin-top:0.35rem">${formatDate(b.earned_at)}</div>`
    : '';

  return `<div class="badge-card ${earned ? 'earned' : 'locked'}" title="${escHtml(b.description)}">
    <span class="badge-emoji">${b.emoji}</span>
    <span class="badge-label">${escHtml(b.label)}</span>
    <span class="badge-desc">${escHtml(b.description)}</span>
    ${dateStr}
  </div>`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
