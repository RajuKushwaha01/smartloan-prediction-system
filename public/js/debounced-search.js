(function () {
  document.querySelectorAll('[data-debounced-search]').forEach(input => {
    let timer;
    const form = input.closest('form');
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (form) form.submit(); }, 600);
    });
  });
})();