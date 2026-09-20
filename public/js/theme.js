/* ============================================
   SMARTLOAN AI — THEME SYSTEM
   Single source of truth for dark/light mode.
   Applied immediately on <html> to avoid flash,
   then synced to <body> once DOM is ready.
   ============================================ */
(function () {
  const STORAGE_KEY = 'smartloan-theme';
  const saved = localStorage.getItem(STORAGE_KEY) || 'dark';

  document.documentElement.setAttribute('data-theme', saved);

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme-body', theme);

    document.querySelectorAll('.theme-icon').forEach(el => {
      el.textContent = theme === 'dark' ? '🌙' : '☀️';
    });
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      const isActive = btn.getAttribute('data-theme-btn') === theme;
      btn.classList.toggle('theme-btn-active', isActive);
    });

    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  window.setSmartLoanTheme = applyTheme;
  window.getSmartLoanTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(saved);

    // Navbar toggle button
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        applyTheme(window.getSmartLoanTheme() === 'dark' ? 'light' : 'dark');
      });
    }

    // Any explicit "set to X" buttons (e.g. Settings page Light/Dark cards)
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyTheme(btn.getAttribute('data-theme-btn'));
      });
    });
  });
})();