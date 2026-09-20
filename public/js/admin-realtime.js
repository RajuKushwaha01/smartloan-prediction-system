(function () {
  if (typeof io === 'undefined') return; // socket.io client script not loaded

  const socket = io();
  const badge = document.getElementById('realtime-badge');
  const list = document.getElementById('realtime-list');
  let count = 0;

  socket.on('new_application', (data) => {
    count++;
    if (badge) {
      badge.textContent = `🔔 ${count} New Application${count > 1 ? 's' : ''}`;
      badge.classList.remove('hidden');
    }
    if (list) {
      const item = document.createElement('div');
      item.className = 'text-xs bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 mb-2 animate-pulse-once';
      item.innerHTML = `<span class="text-cyan-300 font-semibold">${data.applicant}</span> submitted a new application (₹${data.loanAmount.toLocaleString('en-IN')}) — just now`;
      list.prepend(item);
    }
  });
})();