/* ── App — router, auth state, view manager ───────────────────────────────── */

import { getToken, setToken, clearToken, auth, stats as statsApi } from './api.js';
import { renderDashboard } from './dashboard.js';
import { renderBadges } from './badges.js';
import { renderProfile } from './profile.js';

// ── State ──────────────────────────────────────────────────────────────────
let currentUser = null;

export function getUser() { return currentUser; }

// ── Toast notifications ────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── View router ────────────────────────────────────────────────────────────
const VIEWS = {
  login:     document.getElementById('login-view'),
  app:       document.getElementById('app-view'),
};

export function showView(name) {
  Object.values(VIEWS).forEach(v => { if (v) v.classList.add('hidden'); });
  if (VIEWS[name]) VIEWS[name].classList.remove('hidden');
}

// Tab system inside app-view
const TAB_VIEWS = {
  dashboard: document.getElementById('dashboard-view'),
  completed: document.getElementById('completed-view'),
  badges:    document.getElementById('badges-view'),
  profile:   document.getElementById('profile-view'),
};

export function switchTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.nav-tab[data-tab], .mobile-nav .nav-tab[data-tab]')
    .forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));

  // Update pane visibility
  Object.entries(TAB_VIEWS).forEach(([key, el]) => {
    if (el) el.classList.toggle('active', key === tab);
  });

  // Render content
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'badges')    renderBadges();
  if (tab === 'profile')   renderProfile();
  if (tab === 'completed') renderDashboard('completed');
}

// ── Header combo update ────────────────────────────────────────────────────
export async function refreshCombo() {
  try {
    const data = await statsApi.get();
    const el = document.getElementById('combo-display');
    if (!el) return;
    if (data.combo_count > 0) {
      el.innerHTML = `🔥 <strong>x${data.combo_count}</strong> Active`;
      el.classList.remove('combo-zero');
    } else {
      el.innerHTML = `<span class="combo-zero">No active combos</span>`;
    }
  } catch { /* silently fail */ }
}

// ── Auth ───────────────────────────────────────────────────────────────────
async function tryAutoLogin() {
  if (!getToken()) return false;
  try {
    currentUser = await auth.me();
    return true;
  } catch {
    clearToken();
    return false;
  }
}

function setupLoginForm() {
  const loginView = document.getElementById('login-view');
  const tabLogin  = document.getElementById('tab-login');
  const tabReg    = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formReg   = document.getElementById('form-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  });

  tabReg.addEventListener('click', () => {
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
    formReg.classList.remove('hidden');
    formLogin.classList.add('hidden');
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = formLogin.querySelector('[name=username]').value.trim();
    const password = formLogin.querySelector('[name=password]').value;
    const errEl    = document.getElementById('login-error');
    errEl.textContent = '';
    try {
      const res = await auth.login(username, password);
      setToken(res.access_token);
      currentUser = await auth.me();
      enterApp();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  formReg.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = formReg.querySelector('[name=username]').value.trim();
    const password = formReg.querySelector('[name=password]').value;
    const errEl    = document.getElementById('register-error');
    errEl.textContent = '';
    try {
      const res = await auth.register(username, password);
      setToken(res.access_token);
      currentUser = await auth.me();
      enterApp();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

function setupLogout() {
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearToken();
    currentUser = null;
    showView('login');
  });
}

function setupTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

async function enterApp() {
  document.getElementById('header-username').textContent = currentUser.username;
  showView('app');
  await refreshCombo();
  switchTab('dashboard');
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function init() {
  setupLoginForm();
  setupLogout();
  setupTabs();

  const loggedIn = await tryAutoLogin();
  if (loggedIn) {
    await enterApp();
  } else {
    showView('login');
  }
}

document.addEventListener('DOMContentLoaded', init);
