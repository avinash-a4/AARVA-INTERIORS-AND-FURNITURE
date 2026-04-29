/* =============================================
   DASHBOARD.JS – Panel switching + live data
   ============================================= */

// Guard: require login
document.addEventListener('DOMContentLoaded', async () => {
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

  // Load live project data
  await loadProjectData();
});

// ── LOAD PROJECT DATA ──────────────────────────────────────────
async function loadProjectData() {
  try {
    const project = await API.get('/client/project');
    renderOverview(project);
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      Auth.logout();
      return;
    }
    // 404 = no project assigned yet
    if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('no project'))) {
      showNoProjectMessage();
      return;
    }
    console.warn('Dashboard: could not load project —', err.message);
  }
}

// ── NO PROJECT MESSAGE ─────────────────────────────────────────
function showNoProjectMessage() {
  const overviewPanel = document.getElementById('panel-overview');
  if (!overviewPanel) return;
  const placeholder = overviewPanel.querySelector('.dash-card');
  if (placeholder) {
    placeholder.innerHTML = `
      <div class="dash-card-body" style="text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem;margin-bottom:1rem">🏗️</div>
        <div class="dash-card-title" style="margin-bottom:0.5rem">No project assigned yet</div>
        <p style="color:var(--text-muted);font-size:0.875rem">Your interior project will appear here once assigned by the AARAV team.</p>
      </div>`;
  }
}

function renderOverview(project) {
  if (!project) return;

  // ── Stat cards ──
  const progressVal = project.progress ?? 0;
  const totalCost   = project.totalCost ?? 0;

  // Progress card
  const progCard = document.querySelector('.stat-card:nth-child(1) .stat-card-val');
  if (progCard) progCard.textContent = progressVal + '%';

  // Amount paid card — derive from totalCost * (progress/100) as approximation
  const costCard = document.querySelector('.stat-card:nth-child(2) .stat-card-val');
  if (costCard && totalCost) {
    const paid = Math.round((progressVal / 100) * totalCost);
    costCard.textContent = '₹ ' + formatINR(paid);
  }

  // ── Project card header ──
  const titleEl = document.querySelector('#panel-overview .dash-card-title');
  if (titleEl) {
    const loc = project.location ?? '';
    titleEl.textContent = [project.title, loc].filter(Boolean).join(' – ');
  }

  // ── Status badge ──
  const badge = document.querySelector('#panel-overview .status-badge');
  if (badge) {
    const statusMap = {
      consultation: 'Consultation',
      design:       'Design Phase',
      material:     'Procurement',
      execution:    'In Progress',
      finishing:    'Finishing',
      completed:    'Completed',
    };
    badge.textContent = statusMap[project.status] || project.status;
    badge.className = 'status-badge ' +
      (project.status === 'completed' ? 'status-done' : 'status-active');
  }

  // ── Progress bar ──
  const barFill = document.querySelector('.progress-bar-fill');
  if (barFill) barFill.style.width = progressVal + '%';

  const barLabel = document.querySelector('.progress-labels .text-gold');
  if (barLabel) barLabel.textContent = progressVal + '%';

  // ── Timeline phases (if backend provides them) ──
  if (Array.isArray(project.timeline) && project.timeline.length > 0) {
    renderTimeline(project.timeline);
  }
}

function renderTimeline(timeline) {
  const list = document.querySelector('#panel-timeline .timeline-list');
  if (!list) return;
  list.innerHTML = '';
  timeline.forEach(entry => {
    const cls = entry.status === 'done' ? 'done-tl'
              : entry.status === 'in-progress' ? 'active-tl'
              : '';
    const dotCls = entry.status === 'done' ? 'done-dot'
                 : entry.status === 'in-progress' ? 'active-dot'
                 : '';
    const badgeCls = entry.status === 'done' ? 'status-done'
                   : entry.status === 'in-progress' ? 'status-active'
                   : '';
    const badgeTxt = entry.status === 'done' ? 'Completed'
                   : entry.status === 'in-progress' ? 'In Progress'
                   : 'Upcoming';
    const dateStr  = entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
    list.insertAdjacentHTML('beforeend', `
      <div class="tl-item ${cls}">
        <div class="tl-dot ${dotCls}"></div>
        <div class="tl-content">
          ${dateStr ? `<div class="tl-date">${dateStr}</div>` : ''}
          <div class="tl-title">${entry.phase}</div>
          ${entry.note ? `<div class="tl-desc">${entry.note}</div>` : ''}
          <span class="status-badge ${badgeCls}">${badgeTxt}</span>
        </div>
      </div>`);
  });
}

// ── PAYMENTS ───────────────────────────────────────────────────
async function loadPayments() {
  try {
    const payments = await API.get('/client/payments');
    if (!payments || !payments.length) return;

    const tbody = document.querySelector('#panel-payments .pay-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let paid = 0, pending = 0, total = 0;
    payments.forEach(p => {
      total += p.amount ?? 0;
      if (p.status === 'paid') paid += p.amount ?? 0;
      else pending += p.amount ?? 0;
      const dateStr = p.paidAt
        ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : (p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—');
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${dateStr}</td>
          <td>${p.description ?? '—'}</td>
          <td>₹ ${(p.amount ?? 0).toLocaleString('en-IN')}</td>
          <td>${p.mode ?? '—'}</td>
          <td><span class="status-badge ${p.status === 'paid' ? 'status-done' : 'status-active'}">${p.status === 'paid' ? 'Paid' : 'Pending'}</span></td>
        </tr>`);
    });

    // Update stat cards in payments panel
    const cards = document.querySelectorAll('#panel-payments .stat-card .stat-card-val');
    if (cards[0]) cards[0].textContent = '₹ ' + formatINR(total);
    if (cards[1]) cards[1].textContent = '₹ ' + formatINR(paid);
    if (cards[2]) cards[2].textContent = '₹ ' + formatINR(pending);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Payments load error:', err.message);
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function formatINR(n) {
  if (!n) return '0';
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (n >= 1000)   return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

// ── PANEL SWITCHING ────────────────────────────────────────────
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('nav-' + id)?.classList.add('active');
  const titles = { overview:'Overview', designs:'Designs', timeline:'Timeline', payments:'Payments', documents:'Documents', chat:'Message Chat' };
  document.getElementById('dashPageTitle').textContent = titles[id] || id;
  if (id === 'chat')     { const b = document.getElementById('chatBadge'); if (b) b.style.display = 'none'; }
  if (id === 'payments') loadPayments();
}

// Mobile sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// ── CHAT ───────────────────────────────────────────────────────
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

  // Post to backend (fire-and-forget, no UI break on failure)
  API.post('/client/messages', { text: msg }).catch(err => {
    if (err.message?.includes('401')) Auth.logout();
    console.warn('Chat send error:', err.message);
  });

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
