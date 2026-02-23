/* ── Profile page rendering ───────────────────────────────────────────────── */

import { stats as statsApi, badges as badgesApi } from './api.js';
import { getUser } from './app.js';

export async function renderProfile() {
  const el = document.getElementById('profile-view');
  if (!el) return;

  el.innerHTML = `<div class="text-center" style="padding:2rem"><div class="loader"></div></div>`;

  try {
    const [statsData, badgesData] = await Promise.all([statsApi.get(), badgesApi.get()]);
    const user = getUser();
    el.innerHTML = buildProfileHTML(user, statsData, badgesData);
  } catch (err) {
    el.innerHTML = `<p class="text-red">Failed to load profile: ${err.message}</p>`;
  }
}

function buildProfileHTML(user, s, badgesData) {
  const username = user?.username || '—';
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const recentBadges = badgesData.earned.slice(0, 6);

  return `
    <div style="max-width:700px;margin:0 auto">
      <div class="panel" style="padding:1.5rem;margin-bottom:1.5rem">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="font-size:3rem">⚔️</div>
          <div>
            <h2 style="font-family:var(--font-pixel);font-size:0.9rem;color:var(--gold)">${escHtml(username)}</h2>
            <div class="text-dim" style="font-size:0.8rem;margin-top:0.25rem">Adventurer since ${joined}</div>
          </div>
        </div>
      </div>

      <div class="section-title">Stats</div>
      <div class="profile-stats-grid" style="margin-bottom:1.5rem">
        ${statCard('⚔️', s.total_quests, 'Total Quests')}
        ${statCard('🔥', s.active_quests, 'Active Quests')}
        ${statCard('🏆', s.completed_quests, 'Completed')}
        ${statCard('⭐', s.best_streak_ever, 'Best Streak')}
        ${statCard('💥', s.combo_count, 'Combo')}
        ${statCard('🏅', s.badges_earned, 'Badges Earned')}
      </div>

      ${recentBadges.length ? `
        <div class="section-title">Recent Badges</div>
        <div class="badges-grid" style="margin-bottom:1.5rem">
          ${recentBadges.map(b => `
            <div class="badge-card earned" title="${escHtml(b.description)}">
              <span class="badge-emoji">${b.emoji}</span>
              <span class="badge-label">${escHtml(b.label)}</span>
              <span class="badge-desc">${escHtml(b.description)}</span>
            </div>
          `).join('')}
        </div>` : ''}
    </div>`;
}

function statCard(icon, value, label) {
  return `<div class="stat-card">
    <span class="stat-value">${icon} ${value}</span>
    <div class="stat-label">${escHtml(label)}</div>
  </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
