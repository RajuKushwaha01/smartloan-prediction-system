/* ============================================
   SMARTLOAN AI — THEME-AWARE ANIMATED BACKGROUND
   Adjusts orb/particle/grid opacity and color for
   both dark and light themes; listens for theme changes.
   ============================================ */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, dpr;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let mouseX = 0.5, mouseY = 0.5, targetMouseX = 0.5, targetMouseY = 0.5;
  window.addEventListener('mousemove', (e) => {
    targetMouseX = e.clientX / w;
    targetMouseY = e.clientY / h;
  });

  const orbs = [
    { x: 0.18, y: 0.28, r: 260, speed: 0.00025, phase: 0, hue: 'blue' },
    { x: 0.82, y: 0.22, r: 300, speed: 0.0003, phase: 2, hue: 'violet' },
    { x: 0.5, y: 0.85, r: 280, speed: 0.00022, phase: 4, hue: 'cyan' },
    { x: 0.85, y: 0.75, r: 220, speed: 0.0002, phase: 1, hue: 'emerald' }
  ];

  const ORB_COLORS = {
    dark:  { blue: 'rgba(37,99,235,0.22)', violet: 'rgba(124,58,237,0.20)', cyan: 'rgba(6,182,212,0.18)', emerald: 'rgba(16,185,129,0.10)' },
    light: { blue: 'rgba(37,99,235,0.10)', violet: 'rgba(124,58,237,0.09)', cyan: 'rgba(6,182,212,0.09)', emerald: 'rgba(16,185,129,0.07)' }
  };

  const particleCount = window.innerWidth < 768 ? 22 : 45;
  const particles = Array.from({ length: particleCount }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.6 + 0.4,
    speed: Math.random() * 0.00035 + 0.00008,
    drift: (Math.random() - 0.5) * 0.0002,
    opacity: Math.random() * 0.5 + 0.2
  }));

  const nodeCount = window.innerWidth < 768 ? 6 : 10;
  const nodes = Array.from({ length: nodeCount }, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00015,
    vy: (Math.random() - 0.5) * 0.00015,
    r: Math.random() * 2 + 2
  }));
  const NODE_LINK_DIST = window.innerWidth < 768 ? 0.16 : 0.2;

  const symbols = ['₹', '%', '✓', '↗', 'AI'];
  const floaters = window.innerWidth < 768 ? [] : Array.from({ length: 8 }, () => ({
    x: Math.random(), y: Math.random() + 1,
    speed: Math.random() * 0.00018 + 0.00006,
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    size: Math.random() * 8 + 12
  }));

  let sweepPos = -0.2;
  let t = 0;

  function drawOrbs(theme) {
    const colors = ORB_COLORS[theme];
    orbs.forEach((o) => {
      const ox = (o.x + Math.sin(t * o.speed + o.phase) * 0.06 + (mouseX - 0.5) * 0.015) * w;
      const oy = (o.y + Math.cos(t * o.speed + o.phase) * 0.06 + (mouseY - 0.5) * 0.015) * h;
      const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
      grad.addColorStop(0, colors[o.hue]);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGrid(theme) {
    const spacing = 44;
    ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    sweepPos += 0.0009;
    if (sweepPos > 1.3) sweepPos = -0.3;
    const sweepX = sweepPos * w * 1.4 - w * 0.2;
    const sweepGrad = ctx.createLinearGradient(sweepX - 120, 0, sweepX + 120, h);
    const sweepColor = theme === 'dark' ? 'rgba(6,182,212,0.035)' : 'rgba(37,99,235,0.03)';
    sweepGrad.addColorStop(0, 'transparent');
    sweepGrad.addColorStop(0.5, sweepColor);
    sweepGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawParticles(theme) {
    const baseAlpha = theme === 'dark' ? 1 : 0.5;
    const color = theme === 'dark' ? '255,255,255' : '15,23,42';
    particles.forEach(p => {
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -0.02) p.y = 1.02;
      if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
      ctx.fillStyle = `rgba(${color},${p.opacity * baseAlpha})`;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawAINetwork(theme) {
    const lineAlpha = theme === 'dark' ? 0.15 : 0.08;
    const nodeGlow = theme === 'dark' ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.25)';
    const nodeDot = theme === 'dark' ? 'rgba(200,220,255,0.7)' : 'rgba(37,99,235,0.5)';

    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > 1) n.vx *= -1;
      if (n.y < 0 || n.y > 1) n.vy *= -1;
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < NODE_LINK_DIST) {
          const alpha = (1 - dist / NODE_LINK_DIST) * lineAlpha;
          ctx.strokeStyle = theme === 'dark' ? `rgba(6,182,212,${alpha})` : `rgba(37,99,235,${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x * w, nodes[i].y * h);
          ctx.lineTo(nodes[j].x * w, nodes[j].y * h);
          ctx.stroke();
        }
      }
    }

    nodes.forEach(n => {
      const grad = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.r * 4);
      grad.addColorStop(0, nodeGlow);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r * 4, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = nodeDot;
      ctx.beginPath(); ctx.arc(n.x * w, n.y * h, n.r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawFloaters(theme) {
    const color = theme === 'dark' ? '148,163,184' : '100,116,139';
    const alpha = theme === 'dark' ? 0.12 : 0.18;
    floaters.forEach(f => {
      f.y -= f.speed;
      if (f.y < -0.05) f.y = 1.05;
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.font = `600 ${f.size}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.symbol, f.x * w, f.y * h);
    });
  }

  function animate() {
    const theme = currentTheme();
    ctx.clearRect(0, 0, w, h);

    mouseX += (targetMouseX - mouseX) * 0.04;
    mouseY += (targetMouseY - mouseY) * 0.04;

    drawGrid(theme);
    drawOrbs(theme);
    drawAINetwork(theme);
    drawFloaters(theme);
    drawParticles(theme);

    t += 1;
    if (!reducedMotion) requestAnimationFrame(animate);
  }

  if (reducedMotion) {
    const theme = currentTheme();
    drawGrid(theme);
    drawOrbs(theme);
    window.addEventListener('themechange', () => {
      ctx.clearRect(0, 0, w, h);
      drawGrid(currentTheme());
      drawOrbs(currentTheme());
    });
  } else {
    animate();
  }
})();