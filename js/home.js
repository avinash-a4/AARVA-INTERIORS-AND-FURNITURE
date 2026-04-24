// home.js – page-specific JS for index.html
// Smooth counter animation for stats
document.addEventListener('DOMContentLoaded', () => {
  const stats = document.querySelectorAll('.stat-number');
  const countUp = (el) => {
    const target = el.textContent;
    const num = parseFloat(target);
    if (isNaN(num)) return;
    let start = 0;
    const duration = 1500;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = target.includes('%')
        ? Math.round(ease * num) + '%'
        : target.includes('+')
        ? Math.round(ease * num) + '+'
        : Math.round(ease * num);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUp(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(el => observer.observe(el));
});
