/* =============================================
   DASHBOARD.JS – Panel switching, chat, sidebar
   ============================================= */

// Guard: require login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  const user = Auth.getUser();
  if (user?.role === 'admin') { window.location.href = 'admin.html'; return; }
  // Set name in UI
  if (user?.name) {
    const initial = user.name.charAt(0).toUpperCase();
    document.querySelectorAll('#userName,#userAvatar,#dashAvatar').forEach(el => {
      if (el.id === 'userName') el.textContent = user.name;
      else el.textContent = initial;
    });
  }
});

// Panel switching
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('nav-' + id)?.classList.add('active');
  const titles = { overview:'Overview', designs:'Designs', timeline:'Timeline', payments:'Payments', documents:'Documents', chat:'Message Chat' };
  document.getElementById('dashPageTitle').textContent = titles[id] || id;
  // Hide chat badge when opening chat
  if (id === 'chat') { const b = document.getElementById('chatBadge'); if (b) b.style.display = 'none'; }
}

// Mobile sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// Chat
function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg self';
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `<div class="chat-bubble">${msg}</div><div class="chat-time">Just now · You</div>`;
  container.appendChild(div);
  input.value = '';
  container.scrollTop = container.scrollHeight;
  // Simulate reply
  setTimeout(() => {
    const reply = document.createElement('div');
    reply.className = 'chat-msg team';
    reply.innerHTML = `<div class="chat-bubble">Thanks for your message! Our team will respond shortly. 🙏</div><div class="chat-time">${now} · AARAV Team</div>`;
    container.appendChild(reply);
    container.scrollTop = container.scrollHeight;
  }, 1800);
}
// Enter = send
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});
