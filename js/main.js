/* =============================================
   AARAV INTERIORS – MAIN JS
   Shared across all pages: Nav, Scroll, WhatsApp
   ============================================= */

// ── NAV SCROLL BEHAVIOR ──
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

// ── HAMBURGER / MOBILE NAV ──
const hamburger = document.getElementById('hamburger');
const navMobile = document.getElementById('navMobile');
const navClose   = document.getElementById('navClose');

if (hamburger && navMobile) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navMobile.classList.toggle('open');
    document.body.style.overflow = navMobile.classList.contains('open') ? 'hidden' : '';
  });
  if (navClose) navClose.addEventListener('click', closeMobileNav);
}
function closeMobileNav() {
  if (hamburger) hamburger.classList.remove('open');
  if (navMobile) navMobile.classList.remove('open');
  document.body.style.overflow = '';
}

// ── SCROLL REVEAL ──
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  elements.forEach(el => observer.observe(el));
}
document.addEventListener('DOMContentLoaded', initScrollReveal);

// ── TOAST NOTIFICATION ──
function showToast(message, type = 'gold') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    document.body.appendChild(toast);
  }
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── SMOOTH ANCHOR SCROLL ──
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── AUTH HELPERS (JWT) ──
const Auth = {
  getToken: () => localStorage.getItem('aarav_token'),
  setToken: (t) => localStorage.setItem('aarav_token', t),
  clearToken: () => localStorage.removeItem('aarav_token'),
  getUser: () => {
    try {
      const t = localStorage.getItem('aarav_token');
      if (!t) return null;
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload;
    } catch { return null; }
  },
  isLoggedIn: function() { return !!this.getToken() && !!this.getUser(); },
  logout: function() {
    this.clearToken();
    window.location.href = 'login.html';
  }
};

// ── API HELPER ──
const API = {
  BASE: 'https://aarav-backend.onrender.com/api',
  async req(method, endpoint, body) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      const token = Auth.getToken();
      if (token) opts.headers['Authorization'] = 'Bearer ' + token;
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(this.BASE + endpoint, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      console.warn('API Error:', err.message);
      throw err;
    }
  },
  get: function(ep) { return this.req('GET', ep); },
  post: function(ep, body) { return this.req('POST', ep, body); },
  put: function(ep, body) { return this.req('PUT', ep, body); },
  delete: function(ep) { return this.req('DELETE', ep); },
};

// ── ACTIVE NAV LINK ──
(function() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === page) link.classList.add('active');
    else link.classList.remove('active');
  });
})();

// ── PARALLAX (subtle) ──
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const heroImg = document.querySelector('.hero-img');
  if (heroImg) heroImg.style.transform = `scale(1) translateY(${scrollY * 0.15}px)`;
});
