/* =============================================
   AUTH.JS – Login/Logout logic with JWT + Demo mode
   ============================================= */

// Demo users (used when backend is offline)
const DEMO_USERS = {
  'client@aarav.in':  { password: 'client123', role: 'client',  name: 'Rahul Mehta' },
  'admin@aarav.in':   { password: 'admin123',  role: 'admin',   name: 'Admin User'  },
};

function createFakeJWT(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
  return `${header}.${body}.demoSignature`;
}

function fillDemo(email, pass) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = pass;
}

function togglePw() {
  const input = document.getElementById('loginPassword');
  const btn   = document.getElementById('pwToggle');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; }
  else { input.type = 'password'; btn.textContent = 'Show'; }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  document.getElementById('loginErrorMsg').textContent = msg;
  el.classList.remove('hidden');
}

document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmit');
  const errEl     = document.getElementById('loginError');

  errEl.classList.add('hidden');
  submitBtn.textContent = 'Signing In...';
  submitBtn.disabled = true;

  // Try real backend first
  let loggedIn = false;
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      Auth.setToken(data.token);
      const user = Auth.getUser();
      loggedIn = true;
      redirectAfterLogin(user?.role);
      return;
    }
  } catch (_) {
    // Backend offline — fall through to demo mode
  }

  // Demo mode
  await new Promise(r => setTimeout(r, 700));
  const demo = DEMO_USERS[email.toLowerCase()];
  if (demo && demo.password === password) {
    const token = createFakeJWT({ id: 'demo_001', email, role: demo.role, name: demo.name });
    Auth.setToken(token);
    redirectAfterLogin(demo.role);
  } else {
    showLoginError('Invalid email or password. Try the demo credentials below.');
    submitBtn.textContent = 'Sign In';
    submitBtn.disabled = false;
  }
});

function redirectAfterLogin(role) {
  if (role === 'admin') window.location.href = 'admin.html';
  else window.location.href = 'dashboard.html';
}

// If already logged in, redirect
if (Auth.isLoggedIn() && window.location.pathname.includes('login')) {
  const user = Auth.getUser();
  redirectAfterLogin(user?.role);
}
