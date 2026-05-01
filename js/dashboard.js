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

  const progressVal = project.progress ?? 0;
  const totalCost   = project.totalCost   ?? 0;
  const amountPaid  = project.amountPaid  ?? 0;
  const balance     = Math.max(0, totalCost - amountPaid);

  // ── Stat cards (Overview) ──
  const progCard = document.querySelector('.stat-card:nth-child(1) .stat-card-val');
  if (progCard) progCard.textContent = progressVal + '%';

  const costCard = document.querySelector('.stat-card:nth-child(2) .stat-card-val');
  if (costCard) costCard.textContent = '₹ ' + formatINR(amountPaid);

  // Days left from endDate
  const daysCard = document.querySelector('.stat-card:nth-child(3) .stat-card-val');
  if (daysCard && project.endDate) {
    const diff = Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24));
    daysCard.textContent = diff > 0 ? diff + ' days' : 'Completed';
    const label = document.querySelector('.stat-card:nth-child(3) .stat-card-label');
    if (label) label.textContent = diff > 0 ? 'Days Left' : 'Status';
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

  // ── Timeline phases ──
  if (Array.isArray(project.timeline) && project.timeline.length > 0) {
    renderTimeline(project.timeline);
  }

  // ── Designs ──
  renderDesigns(Array.isArray(project.designs) ? project.designs : []);

  // ── Recent Updates ──
  renderRecentUpdates(Array.isArray(project.recentUpdates) ? project.recentUpdates : []);

  // ── Payments panel stat cards (use project fields directly) ──
  const totalEl   = document.getElementById('client_total_cost');
  const paidEl    = document.getElementById('client_amount_paid');
  const balanceEl = document.getElementById('client_balance');
  if (totalEl)   totalEl.textContent   = '₹ ' + formatINR(totalCost);
  if (paidEl)    paidEl.textContent    = '₹ ' + formatINR(amountPaid);
  if (balanceEl) balanceEl.textContent = '₹ ' + formatINR(balance);
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

// ── RECENT UPDATES ──────────────────────────────────────────────
function renderRecentUpdates(updates) {
  const list = document.querySelector('#panel-overview .activity-list');
  if (!list) return;
  if (!updates.length) return;

  list.innerHTML = '';
  updates.slice(0, 6).forEach((upd, i) => {
    const dateStr = upd.date
      ? new Date(upd.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
      : '';
    list.insertAdjacentHTML('beforeend', `
      <div class="activity-item">
        <div class="activity-dot ${i < 2 ? 'gold' : ''}"></div>
        <div>
          <div class="activity-msg">${upd.message}</div>
          ${dateStr ? `<div class="activity-time">${dateStr}</div>` : ''}
        </div>
      </div>`);
  });
}

// ── DESIGNS ──────────────────────────────────────────────
function renderDesigns(designs) {
  const grid = document.querySelector('#panel-designs .design-grid');
  if (!grid) return;

  // Update pending-review badge in the panel header
  const pendingCount = designs.filter(d => !d.approved).length;
  const headerBadge = document.querySelector('#panel-designs .status-badge');
  if (headerBadge) {
    headerBadge.textContent = pendingCount > 0 ? `${pendingCount} Pending Review` : 'All Reviewed';
    headerBadge.className   = `status-badge ${pendingCount > 0 ? 'status-active' : 'status-done'}`;
  }

  if (!designs.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem;margin-bottom:1rem">🖨️</div>
        <div class="design-name" style="color:var(--text-muted)">No designs uploaded yet</div>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem">Your AARAV team will upload design files here for your review.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  designs.forEach(design => {
    const dateStr    = design.uploadedAt
      ? new Date(design.uploadedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
      : '';
    const isImage    = design.url && (design.url.includes('/image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(design.url));
    const isApproved = design.approved;

    const card = document.createElement('div');
    card.className = `design-card${isApproved ? ' design-card--done' : ''}`;
    card.dataset.designId = design._id;

    card.innerHTML = `
      <div class="design-thumb">
        ${isImage
          ? `<img src="${design.url}" alt="${design.name}" loading="lazy" />`
          : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2.5rem;background:rgba(255,255,255,0.04)">📄</div>`
        }
        <div class="design-type">${design.type || ''}</div>
      </div>
      <div class="design-info">
        <div class="design-name">${design.name}</div>
        ${dateStr ? `<div class="design-date">${dateStr}</div>` : ''}
        <div style="margin-top:0.6rem;display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-outline" style="padding:0.4rem 0.85rem;font-size:0.7rem" onclick="openDesign('${design.url}')">View File</button>
        </div>
        <div class="design-actions" style="margin-top:0.75rem">
          ${isApproved
            ? `<span class="status-badge status-done" style="margin-top:0.25rem;display:inline-block">✓ Approved</span>`
            : `
              <button class="btn btn-gold" style="padding:0.5rem 1rem;font-size:0.72rem"
                onclick="approveDesign('${design._id}', true, this)">Approve</button>
              <button class="btn btn-ghost" style="padding:0.5rem 1rem;font-size:0.72rem"
                onclick="approveDesign('${design._id}', false, this)">Reject</button>
            `
          }
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ── OPEN DESIGN IN NEW TAB ──────────────────────────────
function openDesign(url) {
  if (url.includes('drive.google.com')) {
    const match = url.match(/[-\w]{25,}/);
    if (match) {
      window.open(`https://drive.google.com/file/d/${match[0]}/preview`, '_blank');
      return;
    }
  }
  window.open(url, '_blank');
}

// ── APPROVE / REJECT DESIGN ──────────────────────────────
async function approveDesign(designId, approved, btn) {
  try {
    const card = btn.closest('.design-card');
    const btns = card?.querySelectorAll('button');
    btns?.forEach(b => b.disabled = true);

    await API.put(`/client/designs/${designId}/approve`, { approved });

    const actionsDiv = card?.querySelector('.design-actions');
    if (actionsDiv) {
      if (approved) {
        card.classList.add('design-card--done');
        actionsDiv.innerHTML = `<span class="status-badge status-done" style="margin-top:0.25rem;display:inline-block">✓ Approved</span>`;
        showToast('✓ Design approved!', 'success');
      } else {
        actionsDiv.innerHTML = `<span class="status-badge" style="border-color:rgba(255,255,255,0.15);color:var(--text-muted)">Rejected</span>`;
        showToast('Design rejected — admin notified.', 'gold');
      }
    }
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Could not update design'}`, 'error');
    btn.closest('.design-card')?.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

// ── PAYMENTS ───────────────────────────────────────────────────
async function loadPayments() {
  try {
    const payments = await API.get('/client/payments');
    const tbody = document.getElementById('clientPaymentsBody');
    if (!tbody) return;

    if (!payments || !payments.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No payments recorded yet</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    payments.forEach(p => {
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
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Payments load error:', err.message);
  }
}

// ── QUERY SYSTEM ───────────────────────────────────────────────
async function submitQuery(e) {
  e.preventDefault();
  const message = document.getElementById('queryMessage')?.value?.trim();
  if (!message) return;

  const btn = document.getElementById('querySubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    await API.post('/client/query', { message });
    document.getElementById('queryMessage').value = '';
    const successEl = document.getElementById('querySuccess');
    if (successEl) successEl.style.display = 'block';
    showToast('✓ Query submitted!', 'success');
    loadMyQueries();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to submit query'}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Query'; }
  }
}

async function loadMyQueries() {
  try {
    const queries = await API.get('/client/queries');
    const tbody = document.getElementById('myQueriesBody');
    if (!tbody) return;

    if (!queries || !queries.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:2rem">No queries yet</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    queries.forEach(q => {
      const dateStr = new Date(q.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${dateStr}</td>
          <td style="max-width:260px;white-space:normal">${q.message}</td>
          <td><span class="status-badge ${q.status === 'resolved' ? 'status-done' : 'status-active'}">${q.status === 'resolved' ? 'Resolved' : 'Open'}</span></td>
        </tr>`);
    });
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Queries load error:', err.message);
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
  const titles = { overview:'Overview', designs:'Designs', timeline:'Timeline', payments:'Payments', queries:'Raise a Query' };
  document.getElementById('dashPageTitle').textContent = titles[id] || id;
  if (id === 'payments') { loadPayments(); loadProjectData(); }
  if (id === 'designs')  loadProjectData();
  if (id === 'queries')  loadMyQueries();
}

// Mobile sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}
