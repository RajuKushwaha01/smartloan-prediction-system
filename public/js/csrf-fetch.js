/* ============================================
   Auto-injects the CSRF token into every same-origin,
   non-GET fetch() call so existing AJAX code (drafts,
   simulator, notifications) doesn't need per-file edits.
   ============================================ */
(function () {
  const meta = document.querySelector('meta[name="csrf-token"]');
  const token = meta ? meta.getAttribute('content') : null;
  if (!token) return;

  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    const method = (init.method || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input.url;
    const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);

    if (method !== 'GET' && isSameOrigin) {
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set('X-CSRF-Token', token);
      } else {
        init.headers['X-CSRF-Token'] = token;
      }
    }
    return originalFetch(input, init);
  };
})();