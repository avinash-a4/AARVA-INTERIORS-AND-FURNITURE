/* =============================================
   PROJECT FINANCIAL DASHBOARD
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  const user = Auth.getUser();
  if (user?.role !== 'admin') { window.location.href = 'dashboard.html'; return; }
  loadProjectFinancialDashboard();
});

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('mobile-open');
}

function goAdminPanel(panelId) {
  window.location.href = `admin.html#${encodeURIComponent(panelId)}`;
}

async function loadProjectFinancialDashboard() {
  const projectId = new URLSearchParams(window.location.search).get('projectId');
  if (!projectId) {
    renderFinancialError('Project id missing');
    return;
  }

  try {
    const data = await API.get(`/admin/projects/${projectId}/financial-dashboard`);
    renderProjectFinancialDashboard(data);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    renderFinancialError(err.message || 'Failed to load project financials');
  }
}

function renderProjectFinancialDashboard(data) {
  const project = data.project || {};
  const summary = data.summary || {};
  const clientName = project.clientId?.name || 'Unknown Client';

  setText('projectFinancialTitle', project.title || 'Project Financial Dashboard');
  setText('projectFinancialName', project.title || 'Project Financial Dashboard');
  setText('projectFinancialClient', `Client: ${clientName}`);
  setText('pf_project_value', formatProjectFinancialCurrency(summary.projectValue));
  setText('pf_total_expenses', formatProjectFinancialCurrency(summary.totalExpenses));
  setText('pf_income_received', formatProjectFinancialCurrency(summary.clientPaymentsReceived));
  renderProfitLoss(summary.clientPaymentsReceived, summary.totalExpenses);
  renderFinancialHealth(summary.isOverBudget);
  renderProjectPayments(data.payments || []);
}

function renderProfitLoss(clientPaymentsReceived, totalExpenses) {
  const profitLoss = (Number(clientPaymentsReceived) || 0) - (Number(totalExpenses) || 0);
  const card = document.getElementById('pf_profit_loss_card');
  const value = document.getElementById('pf_profit_loss');
  if (!card || !value) return;

  card.classList.toggle('profit-loss--profit', profitLoss >= 0);
  card.classList.toggle('profit-loss--loss', profitLoss < 0);
  value.textContent = formatProjectFinancialCurrency(profitLoss);
}

function renderFinancialHealth(isOverBudget) {
  const card = document.getElementById('pf_health_card');
  if (!card) return;

  card.classList.toggle('financial-health--red', !!isOverBudget);
  card.classList.toggle('financial-health--green', !isOverBudget);

  if (isOverBudget) {
    setText('pf_health_status', '🔴 WARNING');
    setText('pf_health_title', 'OVER BUDGET');
    setText('pf_health_copy', 'Expenses are exceeding safe limits');
  } else {
    setText('pf_health_status', '🟢 HEALTHY');
    setText('pf_health_title', 'Project Financials Healthy');
    setText('pf_health_copy', '');
  }
}

function renderProjectPayments(payments) {
  const tbody = document.getElementById('projectFinancialPaymentsBody');
  if (!tbody) return;

  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No payments recorded for this project.</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map(payment => {
    const type = String(payment.type || 'income').trim().toLowerCase();
    const isExpense = type === 'expense';
    const date = payment.paidAt || payment.createdAt
      ? new Date(payment.paidAt || payment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';
    const typeBadge = isExpense
      ? '<span class="status-badge" style="background:rgba(255,107,107,0.15);color:#ff6b6b">Expense</span>'
      : '<span class="status-badge" style="background:rgba(76,175,80,0.15);color:#4CAF50">Income</span>';

    return `
      <tr>
        <td>${escapeProjectFinancialHtml(date)}</td>
        <td>${typeBadge}</td>
        <td><span class="status-badge" style="background:rgba(198,169,105,0.1);color:#C6A969">${escapeProjectFinancialHtml(payment.category || 'Other')}</span></td>
        <td>${escapeProjectFinancialHtml(payment.mode || '-')}</td>
        <td>${escapeProjectFinancialHtml(payment.description || '-')}</td>
        <td>${formatProjectFinancialCurrency(payment.amount)}</td>
      </tr>`;
  }).join('');
}

function renderFinancialError(message) {
  setText('projectFinancialName', message);
  setText('projectFinancialClient', '');
  const tbody = document.getElementById('projectFinancialPaymentsBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ff6b6b;padding:2rem">${escapeProjectFinancialHtml(message)}</td></tr>`;
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatProjectFinancialCurrency(value) {
  const amount = Number(value) || 0;
  return (amount < 0 ? '-₹' : '₹') + Math.abs(amount).toLocaleString('en-IN');
}

function escapeProjectFinancialHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
