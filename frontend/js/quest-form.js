/* ── New Quest Form — multi-step wizard ───────────────────────────────────── */

import { quests as questsApi } from './api.js';
import { showToast, refreshCombo } from './app.js';
import { renderDashboard } from './dashboard.js';

const EMOJIS = [
  '🥗','🍎','💧','🏃','🏋️','🧘','😴','📚','✍️','🎸','🎨','🧹','🐕','🚴',
  '🤸','🏊','🧗','⚽','🏀','🎯','💊','🥦','🥤','☕','🚫','🍺','🚬','🍔',
  '💰','📱','🧠','❤️','🌿','🌟','⚔️','🛡️','🏆','🔥','💪','🎓','🌅','🗺️',
  '🎵','🎤','🖥️','🔧','🌙','☀️','⚡','🌊','🦁','🐉','🌸','💎','🎲','🃏',
];

let state = {
  step: 1,
  type: null,
  emoji: EMOJIS[0],
  failureMode: null,
  goalDirection: 'above',
};

// ── Open / close ───────────────────────────────────────────────────────────
export function openNewQuestForm() {
  state = { step: 1, type: null, emoji: EMOJIS[0], failureMode: null, goalDirection: 'above' };
  renderWizard();
  document.getElementById('new-quest-modal').classList.remove('hidden');
}

function closeForm() {
  document.getElementById('new-quest-modal').classList.add('hidden');
}

// ── Main render ────────────────────────────────────────────────────────────
function renderWizard() {
  updateStepIndicators();
  showPane(state.step);

  if (state.step === 1) renderTypeSelector();
  if (state.step === 2) renderBasicFields();
  if (state.step === 3) renderTypeConfig();
  if (state.step === 4) renderFailureModeConfig();
}

function updateStepIndicators() {
  document.querySelectorAll('#new-quest-modal .wizard-step').forEach((el, i) => {
    const n = i + 1;
    el.classList.toggle('active', n === state.step);
    el.classList.toggle('done', n < state.step);
  });
}

function showPane(n) {
  document.querySelectorAll('#new-quest-modal .wizard-pane').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
}

// ── Step 1: Quest type ─────────────────────────────────────────────────────
const TYPES = [
  { key: 'streak',       icon: '🔥', name: 'Streak',       desc: 'Daily yes/no. Build a streak.' },
  { key: 'counter',      icon: '📊', name: 'Counter',      desc: 'Hit a daily numeric target.' },
  { key: 'boss_battle',  icon: '⚔️', name: 'Boss Battle',  desc: 'Reach a goal by a deadline.' },
  { key: 'milestone',    icon: '🏆', name: 'Milestone',    desc: 'Open-ended numeric target.' },
  { key: 'weekly_quota', icon: '📅', name: 'Weekly Quota', desc: 'Hit a target X times per week.' },
];

function renderTypeSelector() {
  const el = document.getElementById('type-cards-container');
  el.innerHTML = TYPES.map(t => `
    <div class="type-card ${state.type === t.key ? 'selected' : ''}" data-type="${t.key}">
      <span class="type-icon">${t.icon}</span>
      <span class="type-name">${t.name}</span>
      <span class="type-desc">${t.desc}</span>
    </div>
  `).join('');

  el.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      state.type = card.dataset.type;
      el.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
}

// ── Step 2: Title, emoji, description ─────────────────────────────────────
function renderBasicFields() {
  renderEmojiPicker();
  document.getElementById('quest-emoji-preview').textContent = state.emoji;

  const titleInput = document.getElementById('quest-title');
  if (titleInput && !titleInput.value) titleInput.focus();
}

function renderEmojiPicker() {
  const grid = document.getElementById('emoji-picker-grid');
  grid.innerHTML = EMOJIS.map(e => `
    <button type="button" class="emoji-btn ${e === state.emoji ? 'selected' : ''}"
      data-emoji="${e}">${e}</button>
  `).join('');

  grid.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.emoji = btn.dataset.emoji;
      document.getElementById('quest-emoji-preview').textContent = state.emoji;
      grid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

// ── Direction toggle (shared by boss_battle & milestone) ───────────────────
function directionToggleHTML() {
  return `
    <div class="form-group">
      <label>Goal Direction</label>
      <div style="display:flex;gap:0.5rem">
        <button type="button" class="btn btn-sm ${state.goalDirection === 'above' ? 'btn-success' : 'btn-ghost'}" id="dir-above">📈 Reach above</button>
        <button type="button" class="btn btn-sm ${state.goalDirection === 'below' ? 'btn-primary' : 'btn-ghost'}" id="dir-below">📉 Get below</button>
      </div>
      <div class="form-hint" id="dir-hint">${state.goalDirection === 'above' ? 'e.g. run 100 km, read 10 books' : 'e.g. lose weight to 80 kg, reduce debt'}</div>
    </div>`;
}

function wireDirectionToggle(el) {
  el.querySelector('#dir-above')?.addEventListener('click', () => {
    state.goalDirection = 'above';
    renderTypeConfig();
  });
  el.querySelector('#dir-below')?.addEventListener('click', () => {
    state.goalDirection = 'below';
    renderTypeConfig();
  });
}

// ── Step 3: Type-specific config ───────────────────────────────────────────
function renderTypeConfig() {
  const el = document.getElementById('type-config-container');

  switch (state.type) {
    case 'streak':
      el.innerHTML = `<p class="text-dim" style="font-size:0.85rem">
        Streak quests are straightforward — just check in each day.<br><br>
        Configure the failure mode on the next step.
      </p>`;
      break;

    case 'counter':
      el.innerHTML = `
        <div class="form-group">
          <label>Daily Target</label>
          <div class="input-with-unit">
            <input type="number" id="counter-target-input" min="0" step="any" placeholder="e.g. 2" required>
            <input type="text" id="counter-unit-input" placeholder="unit (e.g. L)" style="max-width:90px;border-radius:0 4px 4px 0;border-left:none">
          </div>
        </div>`;
      break;

    case 'boss_battle':
      el.innerHTML = `
        ${directionToggleHTML()}
        <div class="form-row">
          <div class="form-group">
            <label>${state.goalDirection === 'below' ? 'Goal Value' : 'Target Value'}</label>
            <input type="text" id="boss-target-input" inputmode="decimal" placeholder="${state.goalDirection === 'below' ? 'e.g. 80' : 'e.g. 10'}" required>
          </div>
          <div class="form-group">
            <label>Unit</label>
            <input type="text" id="boss-unit-input" placeholder="e.g. kg">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>${state.goalDirection === 'below' ? 'Starting Value' : 'Current Value'}</label>
            <input type="text" id="boss-current-input" inputmode="decimal" placeholder="${state.goalDirection === 'below' ? 'e.g. 100' : '0'}" value="0">
          </div>
          <div class="form-group">
            <label>Deadline</label>
            <input type="date" id="boss-deadline-input" required>
          </div>
        </div>`;
      wireDirectionToggle(el);
      // Set min date to tomorrow
      setTimeout(() => {
        const d = document.getElementById('boss-deadline-input');
        if (d) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          d.min = tomorrow.toISOString().split('T')[0];
        }
      }, 0);
      break;

    case 'milestone':
      el.innerHTML = `
        ${directionToggleHTML()}
        <div class="form-row">
          <div class="form-group">
            <label>${state.goalDirection === 'below' ? 'Goal Value' : 'Target Value'}</label>
            <input type="text" id="milestone-target-input" inputmode="decimal" placeholder="${state.goalDirection === 'below' ? 'e.g. 80' : 'e.g. 500'}" required>
          </div>
          <div class="form-group">
            <label>Unit</label>
            <input type="text" id="milestone-unit-input" placeholder="e.g. kg">
          </div>
        </div>
        <div class="form-group">
          <label>${state.goalDirection === 'below' ? 'Starting Value' : 'Starting Value (optional)'}</label>
          <input type="text" id="milestone-current-input" inputmode="decimal" placeholder="0" value="0">
        </div>`;
      wireDirectionToggle(el);
      break;

    case 'weekly_quota':
      el.innerHTML = `
        <div class="form-group">
          <label>Times per week</label>
          <input type="number" id="weekly-target-input" min="1" max="7" step="1" placeholder="e.g. 3" required>
          <div class="form-hint">How many times per rolling 7-day window?</div>
        </div>`;
      break;
  }
}

// ── Step 4: Failure mode ───────────────────────────────────────────────────
const STREAK_TYPES = ['streak', 'counter', 'weekly_quota'];

function renderFailureModeConfig() {
  const el = document.getElementById('failure-config-container');

  if (!STREAK_TYPES.includes(state.type)) {
    el.innerHTML = `<p class="text-dim" style="font-size:0.85rem">
      ${state.type === 'boss_battle' ? 'Boss Battle' : 'Milestone'} quests don't use streak failure modes.
      Your quest will be marked as Victory or Defeated at the end.
    </p>`;
    state.failureMode = null;
    return;
  }

  el.innerHTML = `
    <div class="failure-cards">
      <div class="failure-card ${state.failureMode === 'hard_reset' ? 'selected' : ''}" data-mode="hard_reset">
        <span class="fc-icon">💀</span>
        <span class="fc-name">Hard Reset</span>
        <span class="fc-desc">Miss a day = streak resets to 0. No mercy. For serious commitments.</span>
      </div>
      <div class="failure-card ${state.failureMode === 'freeze_lives' ? 'selected' : ''}" data-mode="freeze_lives">
        <span class="fc-icon">❤️</span>
        <span class="fc-name">Freeze Lives</span>
        <span class="fc-desc">Missed days consume a life. Lives regen on consecutive successes.</span>
      </div>
    </div>

    <div id="lives-config" class="${state.failureMode === 'freeze_lives' ? '' : 'hidden'}" style="margin-top:1rem">
      <div class="form-row">
        <div class="form-group">
          <label>Number of Lives</label>
          <input type="number" id="lives-max-input" min="1" max="5" step="1" value="3">
        </div>
        <div class="form-group">
          <label>Regen every N success days</label>
          <input type="number" id="lives-regen-input" min="1" step="1" value="7">
        </div>
      </div>
    </div>`;

  el.querySelectorAll('.failure-card').forEach(card => {
    card.addEventListener('click', () => {
      state.failureMode = card.dataset.mode;
      el.querySelectorAll('.failure-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('lives-config').classList.toggle('hidden', state.failureMode !== 'freeze_lives');
    });
  });
}

// ── Navigation ─────────────────────────────────────────────────────────────
function validateStep() {
  if (state.step === 1) {
    if (!state.type) { showToast('Please select a quest type', 'error'); return false; }
  }
  if (state.step === 2) {
    const title = document.getElementById('quest-title')?.value?.trim();
    if (!title) { showToast('Please enter a quest title', 'error'); return false; }
  }
  if (state.step === 4 && STREAK_TYPES.includes(state.type)) {
    if (!state.failureMode) { showToast('Please select a failure mode', 'error'); return false; }
  }
  return true;
}

function goPrev() {
  if (state.step > 1) { state.step--; renderWizard(); }
}

async function goNext() {
  if (!validateStep()) return;
  if (state.step < 4) {
    state.step++;
    renderWizard();
  } else {
    await submitQuest();
  }
}

// ── Submit ─────────────────────────────────────────────────────────────────
async function submitQuest() {
  const title = document.getElementById('quest-title')?.value?.trim();
  const description = document.getElementById('quest-description')?.value?.trim() || null;

  const data = {
    title,
    emoji: state.emoji,
    description,
    type: state.type,
    failure_mode: state.failureMode || null,
  };

  if (state.failureMode === 'freeze_lives') {
    data.lives_max = parseInt(document.getElementById('lives-max-input')?.value) || 3;
    data.lives_regen_days = parseInt(document.getElementById('lives-regen-input')?.value) || 7;
  }

  switch (state.type) {
    case 'counter':
      data.daily_target = parseFloat(document.getElementById('counter-target-input')?.value) || null;
      data.unit = document.getElementById('counter-unit-input')?.value?.trim() || null;
      if (!data.daily_target) { showToast('Enter a daily target', 'error'); return; }
      break;

    case 'boss_battle':
      data.numeric_target  = parseFloat((document.getElementById('boss-target-input')?.value || '').replace(',', '.')) || null;
      data.unit            = document.getElementById('boss-unit-input')?.value?.trim() || null;
      data.numeric_current = parseFloat((document.getElementById('boss-current-input')?.value || '').replace(',', '.')) || 0;
      data.deadline        = document.getElementById('boss-deadline-input')?.value || null;
      data.goal_direction  = state.goalDirection;
      if (!data.numeric_target) { showToast('Enter a target value', 'error'); return; }
      if (!data.deadline) { showToast('Enter a deadline', 'error'); return; }
      break;

    case 'milestone':
      data.numeric_target  = parseFloat((document.getElementById('milestone-target-input')?.value || '').replace(',', '.')) || null;
      data.unit            = document.getElementById('milestone-unit-input')?.value?.trim() || null;
      data.numeric_current = parseFloat((document.getElementById('milestone-current-input')?.value || '').replace(',', '.')) || 0;
      data.goal_direction  = state.goalDirection;
      if (!data.numeric_target) { showToast('Enter a target value', 'error'); return; }
      break;

    case 'weekly_quota':
      data.weekly_target = parseInt(document.getElementById('weekly-target-input')?.value) || null;
      if (!data.weekly_target) { showToast('Enter a weekly target', 'error'); return; }
      break;
  }

  const btn = document.getElementById('btn-wizard-next');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    await questsApi.create(data);
    showToast(`Quest created: ${data.emoji} ${data.title}`, 'success');
    closeForm();
    renderDashboard('active');
    refreshCombo();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Quest';
  }
}

// ── Wire up buttons on DOMContentLoaded ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-wizard-prev')?.addEventListener('click', goPrev);
  document.getElementById('btn-wizard-next')?.addEventListener('click', goNext);
  document.getElementById('btn-close-quest-form')?.addEventListener('click', closeForm);
  document.getElementById('new-quest-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeForm();
  });
});
