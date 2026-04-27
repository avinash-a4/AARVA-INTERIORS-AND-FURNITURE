/* =============================================
   AUTH.JS – Login/Logout logic (live backend)
   ============================================= */

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
  const email     = document.getElementById('loginEmail').value.trim();
  const password  = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmit');
  const errEl     = document.getElementById('loginError');

  errEl.classList.add('hidden');
  submitBtn.textContent = 'Signing In…';
  submitBtn.disabled = true;

  try {
    const res = await fetch('https://aarav-backend.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      // 401 or 400 from backend
      showLoginError(data.message || 'Invalid credentials. Please try again.');
      submitBtn.textContent = 'Sign In';
      submitBtn.disabled = false;
      return;
    }

    // Store real JWT using existing Auth system
    Auth.setToken(data.token);
    const user = Auth.getUser();
    redirectAfterLogin(user?.role);

  } catch (err) {
    showLoginError('Unable to connect to server. Please try again later.');
    submitBtn.textContent = 'Sign In';
    submitBtn.disabled = false;
  }
});

function redirectAfterLogin(role) {
  if (role === 'admin') window.location.href = 'admin.html';
  else window.location.href = 'dashboard.html';
}

// If already logged in, skip the login page
if (Auth.isLoggedIn() && window.location.pathname.includes('login')) {
  const user = Auth.getUser();
  redirectAfterLogin(user?.role);
}
