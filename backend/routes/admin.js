const express     = require('express');
const router      = express.Router();
const nodemailer  = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');
const User        = require('../models/User');
const Project     = require('../models/Project');
const Payment     = require('../models/Payment');
const Message     = require('../models/Message');
const Query       = require('../models/Query');
const { protect, adminOnly } = require('../middleware/auth');
const upload      = require('../middleware/upload');
const cloudinary  = require('../config/cloudinary'); // still used for design uploads

const INVOICE_DIR = path.join(__dirname, '../uploads/invoices');

if (!fs.existsSync(INVOICE_DIR)) {
  fs.mkdirSync(INVOICE_DIR, { recursive: true });
}

// ── PDF Invoice helpers ──────────────────────────────────────────────────────

async function _getInvoiceNumber(paidAt) {
  const d = paidAt ? new Date(paidAt) : new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const prefix  = `INV-${dateStr}-PAY-`;
  const count   = await Payment.countDocuments({ invoiceNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(4,'0')}`;
}

async function _getLedgerInvoiceNumber() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const prefix  = `LEDGER-${dateStr}-CLIENT-`;
  const count   = await Payment.countDocuments({ ledgerInvoiceNumber: { $regex: `^${prefix}` } });
  return `${prefix}${String(count + 1).padStart(4,'0')}`;
}

function _buildInvoicePDF(payment, invoiceNumber) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const buffers = [];
    doc.on('data', c => buffers.push(c));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89, M = 50;
    const NAVY = '#0B1628', GOLD = '#C6A969', WHITE = '#FFFFFF';
    const LGRAY = '#F4F4F8', MGRAY = '#888899', DTEXT = '#1A1A2E';

    // ── Header band
    doc.rect(0, 0, W, 145).fill(NAVY);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(20)
       .text('AARAV INTERIORS & FURNITURE', M, 32, { width: W - M*2 });
    doc.fillColor(GOLD).font('Helvetica').fontSize(10)
       .text('Luxury Interior Designers', M, 57, { width: W - M*2 });
    doc.rect(M, 80, W - M*2, 1).fill(GOLD);
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(13)
       .text('INVOICE', W - M - 130, 32, { width: 130, align: 'right' });
    doc.fillColor(GOLD).font('Helvetica').fontSize(9)
       .text(invoiceNumber, W - M - 200, 52, { width: 200, align: 'right' });

    // Generated date under invoice number
    const genDate = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    doc.fillColor(WHITE).font('Helvetica').fontSize(8)
       .text(`Generated: ${genDate}`, W - M - 200, 67, { width: 200, align: 'right' });

    // ── Client + Details boxes
    const bY = 165, bH = 85, halfW = (W - M*2) / 2 - 8;
    doc.rect(M, bY, halfW, bH).fill(LGRAY);
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7).text('BILLED TO', M+14, bY+12);
    doc.fillColor(DTEXT).font('Helvetica-Bold').fontSize(11)
       .text(payment.clientNameSnapshot || 'Client', M+14, bY+24, { width: halfW - 20 });
    doc.fillColor(DTEXT).font('Helvetica').fontSize(9)
       .text(payment.projectTitleSnapshot || 'Archived Project', M+14, bY+42, { width: halfW - 20 });

    const rX = M + halfW + 16;
    doc.rect(rX, bY, halfW, bH).fill(LGRAY);
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7).text('PAYMENT DATE', rX+14, bY+12);
    const pDate = payment.paidAt
      ? new Date(payment.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
      : '—';
    doc.fillColor(DTEXT).font('Helvetica-Bold').fontSize(11).text(pDate, rX+14, bY+24);

    // ── Payment details section
    let y = bY + bH + 30;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('PAYMENT DETAILS', M, y);
    y += 16; doc.rect(M, y, W - M*2, 1.5).fill(GOLD); y += 12;

    // Determine type label
    const isCollection = payment.invoiceType === 'collection' ||
      (payment.description || '').startsWith('[Collection]');
    const isExpense = payment.invoiceType === 'expense' || payment.type === 'expense';
    const typeLabel = isCollection ? 'Collection Payment' : isExpense ? 'Expense Entry' : 'Income Payment';

    const rows = [
      ['Payment Type', typeLabel],
      ['Category',     payment.category || 'Other'],
      ['Payment Mode', payment.mode    || 'Other'],
    ];
    rows.forEach(([lbl, val], i) => {
      if (i % 2 === 0) doc.rect(M, y-4, W - M*2, 22).fill(LGRAY);
      doc.fillColor(MGRAY).font('Helvetica').fontSize(8).text(lbl, M+12, y, { width: 160 });
      doc.fillColor(DTEXT).font('Helvetica').fontSize(9).text(val, M+180, y, { width: W - M*2 - 190 });
      y += 22;
    });

    // Description row
    if (payment.description) {
      doc.rect(M, y-4, W - M*2, 22).fill(LGRAY);
      doc.fillColor(MGRAY).font('Helvetica').fontSize(8).text('Description', M+12, y, { width: 160 });
      doc.fillColor(DTEXT).font('Helvetica').fontSize(9)
         .text(payment.description, M+180, y, { width: W - M*2 - 190 });
      y += 22;
    }

    // ── Amount highlight box
    y += 18;
    doc.rect(M, y, W - M*2, 72).fill(NAVY);
    // Use explicit x,y coordinates with lineBreak:false to prevent any stray continuation output
    doc.fillColor(MGRAY).font('Helvetica').fontSize(9)
       .text('TOTAL AMOUNT', M+20, y+14, { lineBreak: false });
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(26)
       .text(`${(payment.amount || 0).toLocaleString('en-IN')}`, M+20, y+30, { lineBreak: false });

    // ── Footer
    const fY = H - 75;
    doc.rect(0, fY, W, 75).fill(NAVY);
    doc.rect(M, fY + 1, W - M*2, 1).fill(GOLD);
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7.5)
       .text('Generated by AARAV Interior Management System', M, fY+18, { width: W - M*2, align: 'center' });
    doc.fillColor(MGRAY).font('Helvetica-Oblique').fontSize(7)
       .text('This is a system generated invoice. No signature required.', M, fY+32, { width: W - M*2, align: 'center' });
    doc.fillColor(GOLD).font('Helvetica').fontSize(8)
       .text(`Invoice: ${invoiceNumber}`, M, fY+48, { width: W - M*2, align: 'center' });

    doc.end();
  });
}

// ── Full Client Ledger PDF Builder ──────────────────────────────────────────
function _buildLedgerPDF(payments, clientName, projectTitle, ledgerNumber, outstanding) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const buffers = [];
    doc.on('data', c => buffers.push(c));
    doc.on('end',  () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = 595.28, H = 841.89, M = 50;
    const NAVY = '#0B1628', GOLD = '#C6A969', WHITE = '#FFFFFF';
    const LGRAY = '#F4F4F8', MGRAY = '#888899', DTEXT = '#1A1A2E';
    const ROW_H = 22;

    // ── Header band ────────────────────────────────────────────────────────
    const drawHeader = () => {
      doc.rect(0, 0, W, 145).fill(NAVY);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(20)
         .text('AARAV INTERIORS & FURNITURE', M, 32, { width: W - M*2, lineBreak: false });
      doc.fillColor(GOLD).font('Helvetica').fontSize(10)
         .text('Luxury Interior Designers', M, 57, { width: W - M*2, lineBreak: false });
      doc.rect(M, 80, W - M*2, 1).fill(GOLD);
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(13)
         .text('LEDGER', W - M - 130, 32, { width: 130, align: 'right', lineBreak: false });
      doc.fillColor(GOLD).font('Helvetica').fontSize(9)
         .text(ledgerNumber, W - M - 200, 52, { width: 200, align: 'right', lineBreak: false });
      const genDate = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      doc.fillColor(WHITE).font('Helvetica').fontSize(8)
         .text(`Generated: ${genDate}`, W - M - 200, 67, { width: 200, align: 'right', lineBreak: false });
    };
    drawHeader();

    // ── Client info boxes ───────────────────────────────────────────────────
    const bY = 165, bH = 85, halfW = (W - M*2) / 2 - 8;
    doc.rect(M, bY, halfW, bH).fill(LGRAY);
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7)
       .text('BILLED TO', M+14, bY+10, { lineBreak: false });
    doc.fillColor(DTEXT).font('Helvetica-Bold').fontSize(11)
       .text(clientName || 'Client', M+14, bY+22, { width: halfW - 20, lineBreak: false });
    doc.fillColor(DTEXT).font('Helvetica').fontSize(9)
       .text(projectTitle || 'All Projects', M+14, bY+40, { width: halfW - 20, lineBreak: false });
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7)
       .text('INVOICE TYPE', M+14, bY+58, { lineBreak: false });
    doc.fillColor(DTEXT).font('Helvetica').fontSize(8)
       .text('Client Ledger Invoice', M+14, bY+68, { lineBreak: false });

    const rX = M + halfW + 16;
    doc.rect(rX, bY, halfW, bH).fill(LGRAY);
    const sortedPmts = [...payments].sort((a,b) => new Date(a.paidAt||a.createdAt) - new Date(b.paidAt||b.createdAt));
    const firstDate = sortedPmts.length
      ? new Date(sortedPmts[0].paidAt || sortedPmts[0].createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
      : '—';
    const today = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7)
       .text('INVOICE DATE', rX+14, bY+10, { lineBreak: false });
    doc.fillColor(DTEXT).font('Helvetica-Bold').fontSize(11)
       .text(today, rX+14, bY+22, { lineBreak: false });
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7)
       .text('PERIOD', rX+14, bY+40, { lineBreak: false });
    doc.fillColor(DTEXT).font('Helvetica').fontSize(8)
       .text(`${firstDate}  →  ${today}`, rX+14, bY+52, { width: halfW - 20, lineBreak: false });

    // ── Payment History section header ──────────────────────────────────────
    let y = bY + bH + 30;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
       .text('PAYMENT HISTORY', M, y, { lineBreak: false });
    y += 16; doc.rect(M, y, W - M*2, 1.5).fill(GOLD); y += 10;

    // Column widths: Date | Type | Category | Mode | Description | Amount
    const cols = [
      { label: 'Date',        w: 78  },
      { label: 'Type',        w: 60  },
      { label: 'Category',    w: 70  },
      { label: 'Mode',        w: 60  },
      { label: 'Description', w: 130 },
      { label: 'Amount',      w: 82  },
    ];
    const tableW = cols.reduce((s,c) => s+c.w, 0); // 480
    const tX = M;

    // Draw table header row
    const drawTableHeader = (yPos) => {
      doc.rect(tX, yPos, tableW, ROW_H).fill(NAVY);
      let cx = tX + 6;
      cols.forEach(col => {
        doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(7.5)
           .text(col.label, cx, yPos + 7, { width: col.w - 6, lineBreak: false });
        cx += col.w;
      });
      return yPos + ROW_H;
    };
    y = drawTableHeader(y);

    // Draw payment rows with auto-pagination
    sortedPmts.forEach((p, idx) => {
      // Page break check — leave room for footer summary (120px)
      if (y + ROW_H > H - 140) {
        // Draw continuation footer on current page
        const fY = H - 55;
        doc.rect(0, fY, W, 55).fill(NAVY);
        doc.rect(M, fY+1, W-M*2, 1).fill(GOLD);
        doc.fillColor(MGRAY).font('Helvetica').fontSize(7)
           .text(`Ledger: ${ledgerNumber}  •  Page continued…`, M, fY+20, { width: W-M*2, align: 'center', lineBreak: false });
        doc.addPage();
        // Reprint header on new page
        drawHeader();
        y = 155;
        y = drawTableHeader(y);
      }

      const isEven = idx % 2 === 0;
      if (isEven) doc.rect(tX, y, tableW, ROW_H).fill(LGRAY);

      const dateStr = (p.paidAt || p.createdAt)
        ? new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : '—';

      // Determine type label
      const isCol = p.invoiceType === 'collection' || (p.description||'').startsWith('[Collection]');
      const isExp = p.invoiceType === 'expense' || p.type === 'expense';
      const typeLabel = isCol ? 'Collection' : isExp ? 'Expense' : 'Income';
      const typeColor = isCol ? '#64B4FF' : isExp ? '#ff6b6b' : '#4CAF50';

      const cat  = p.category    || 'Other';
      const mode = p.mode        || 'Other';
      const desc = p.description || '—';
      const amt  = `${(p.amount || 0).toLocaleString('en-IN')}`;

      const rowData = [dateStr, typeLabel, cat, mode, desc, amt];
      let cx = tX + 6;
      rowData.forEach((val, ci) => {
        const col = cols[ci];
        // Amount column: right-align and gold for income, red for expense
        const isAmtCol = ci === rowData.length - 1;
        const textColor = isAmtCol ? (isExp ? '#ff6b6b' : '#1A1A2E') : DTEXT;
        const align = isAmtCol ? 'right' : 'left';
        const textX = isAmtCol ? cx : cx;
        if (ci === 1) {
          // Type column — coloured badge text
          doc.fillColor(typeColor).font('Helvetica-Bold').fontSize(7.5)
             .text(val, textX, y + 7, { width: col.w - 8, lineBreak: false });
        } else {
          doc.fillColor(textColor).font(isAmtCol ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5)
             .text(val, textX, y + 7, { width: col.w - (isAmtCol ? 10 : 6), align, lineBreak: false });
        }
        cx += col.w;
      });
      y += ROW_H;
    });

    // ── Summary Footer ─────────────────────────────────────────────────────
    y += 20;
    // Check if summary fits; if not, add a new page
    if (y + 130 > H - 80) {
      doc.addPage();
      drawHeader();
      y = 165;
    }

    // Calculate totals
    let totalIncome = 0, totalExpense = 0;
    sortedPmts.forEach(p => {
      const isExp = p.invoiceType === 'expense' || p.type === 'expense';
      if (isExp) totalExpense += (p.amount || 0);
      else       totalIncome  += (p.amount || 0);
    });
    const netCollected = totalIncome - totalExpense;
    const totalTx      = sortedPmts.length;

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
       .text('LEDGER SUMMARY', M, y, { lineBreak: false });
    y += 16; doc.rect(M, y, W - M*2, 1.5).fill(GOLD); y += 14;

    const summaryRows = [
      ['Total Income',       `${totalIncome.toLocaleString('en-IN')}`],
      ['Total Expense',      `${totalExpense.toLocaleString('en-IN')}`],
      ['Net Collected',      `${netCollected.toLocaleString('en-IN')}`],
      ['Total Transactions', `${totalTx}`],
    ];
    if (outstanding !== null && outstanding !== undefined) {
      summaryRows.push(['Current Outstanding', `${outstanding.toLocaleString('en-IN')}`]);
    }

    summaryRows.forEach(([label, val], si) => {
      if (si % 2 === 0) doc.rect(M, y-4, W-M*2, 26).fill(LGRAY);
      doc.fillColor(MGRAY).font('Helvetica').fontSize(8.5)
         .text(label, M+14, y, { width: 200, lineBreak: false });
      const isNeg = label === 'Net Collected' && netCollected < 0;
      doc.fillColor(isNeg ? '#ff6b6b' : DTEXT).font('Helvetica-Bold').fontSize(9)
         .text(val, M+220, y, { width: W-M*2-230, align: 'right', lineBreak: false });
      y += 26;
    });

    // ── Page footer ────────────────────────────────────────────────────────
    const fY = H - 75;
    doc.rect(0, fY, W, 75).fill(NAVY);
    doc.rect(M, fY+1, W-M*2, 1).fill(GOLD);
    doc.fillColor(MGRAY).font('Helvetica').fontSize(7.5)
       .text('Generated by AARAV Interior Management System', M, fY+18, { width: W-M*2, align: 'center', lineBreak: false });
    doc.fillColor(MGRAY).font('Helvetica-Oblique').fontSize(7)
       .text('This is a system generated ledger invoice. No signature required.', M, fY+32, { width: W-M*2, align: 'center', lineBreak: false });
    doc.fillColor(GOLD).font('Helvetica').fontSize(8)
       .text(`Ledger: ${ledgerNumber}`, M, fY+48, { width: W-M*2, align: 'center', lineBreak: false });

    doc.end();
  });
}

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// GET /api/admin/clients
router.get('/clients', async (req, res) => {
  const clients = await User.find({ role: 'client' }).select('-password').populate('projectId');
  res.json(clients);
});

// POST /api/admin/clients  — handled in auth/register

// GET /api/admin/projects
router.get('/projects', async (req, res) => {
  const projects = await Project.find().populate('clientId', 'name email phone');
  res.json(projects);
});

// POST /api/admin/projects
router.post('/projects', async (req, res) => {
  try {
    const { title, clientId, package: pkg, location, startDate, endDate, totalCost } = req.body;
    const project = await Project.create({
      title,
      clientId,
      package:       pkg      || 'Standard',
      location:      location || '',
      startDate:     startDate || null,
      endDate:       endDate   || null,
      totalCost:     Number(totalCost) || 0,
      // Strict zero-state defaults — never inherit demo data
      progress:      0,
      amountPaid:    0,
      designs:       [],
      timeline:      [],
      recentUpdates: [],
    });
    // Link to client
    await User.findByIdAndUpdate(clientId, { projectId: project._id });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/projects/:id
router.put('/projects/:id', async (req, res) => {
  try {
    const { timeline, ...rest } = req.body;
    const update = { ...rest };

    // If timeline is being updated, also push recentUpdates entries
    if (Array.isArray(timeline)) {
      update.timeline = timeline;
      const updates = timeline
        .filter(t => t.status === 'done' || t.status === 'in-progress')
        .map(t => ({
          message: `${t.phase} marked as ${t.status === 'done' ? 'Completed' : 'In Progress'}${t.note ? ': ' + t.note : ''}`,
          date: new Date(),
        }));
      if (updates.length) {
        update.$push = { recentUpdates: { $each: updates } };
      }
    }

    const project = await Project.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/clients/:id  (cascade-deletes linked project + its queries)
router.delete('/clients/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Client not found' });

    if (user.projectId) {
      // Delete queries tied to this project before deleting the project
      await Query.deleteMany({ projectId: user.projectId });
      await Project.findByIdAndDelete(user.projectId);
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/projects/:id  (clears projectId on linked client, deletes related queries)
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // 1. Delete all queries tied to this project (hard delete — orphan queries serve no purpose)
    await Query.deleteMany({ projectId: req.params.id });

    // 2. Unlink the project from the client (DO NOT delete payments — financial record must be preserved)
    await User.findByIdAndUpdate(project.clientId, { $unset: { projectId: '' } });

    // 3. Delete the project
    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/projects/:id/timeline
router.post('/projects/:id/timeline', async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  project.timeline.push(req.body);
  await project.save();
  res.json(project.timeline);
});

// POST /api/admin/projects/:id/workflow — replace full workflowCalendar array
router.post('/projects/:id/workflow', async (req, res) => {
  try {
    const { workflowCalendar } = req.body;
    if (!Array.isArray(workflowCalendar)) {
      return res.status(400).json({ message: 'workflowCalendar must be an array' });
    }
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { workflowCalendar },
      { new: true }
    );
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Workflow saved', workflowCalendar: project.workflowCalendar });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/projects/:id/workflow/:itemId — edit a single workflow item
router.put('/projects/:id/workflow/:itemId', async (req, res) => {
  try {
    const { workName, startDate, endDate } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const item = project.workflowCalendar.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Workflow item not found' });
    if (workName)  item.workName  = workName;
    if (startDate) item.startDate = startDate;
    if (endDate)   item.endDate   = endDate;
    await project.save();
    res.json({ message: 'Workflow item updated', workflowCalendar: project.workflowCalendar });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// POST /api/admin/projects/:id/designs  (save Google Drive URL + notify client)
router.post('/projects/:id/designs', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('clientId', 'name email');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const { name, type, url } = req.body;
    if (!url) return res.status(400).json({ message: 'Design URL is required' });

    project.designs.push({ name, type, url, approved: false, uploadedAt: new Date() });
    await project.save();

    res.status(201).json({ message: 'Design saved', designs: project.designs });

    // ── Send email notification (silent — never crashes the API) ──
    try {
      const client = project.clientId;  // already populated above
      if (client?.email) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        transporter.sendMail({
          from:    `"AARAV Interiors" <${process.env.EMAIL_USER}>`,
          to:      client.email,
          subject: `New Design Added — ${project.title}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
              <h2 style="color:#C6A969">AARAV Interiors</h2>
              <p>Hi <strong>${client.name}</strong>,</p>
              <p>A new design has been added to your project <strong>${project.title}</strong>.</p>
              <table style="border-collapse:collapse;margin:1rem 0">
                <tr><td style="padding:6px 12px 6px 0;color:#666">Design</td><td><strong>${name || 'Untitled'}</strong></td></tr>
                <tr><td style="padding:6px 12px 6px 0;color:#666">Type</td><td>${type || '—'}</td></tr>
              </table>
              <a href="${url}" target="_blank"
                style="display:inline-block;padding:12px 24px;background:#C6A969;color:#fff;
                       text-decoration:none;border-radius:6px;font-weight:bold;margin:0.5rem 0">
                View Design
              </a>
              <p style="margin-top:1.5rem;color:#555">Please log in to your client dashboard to review and approve the design.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0" />
              <p style="color:#999;font-size:0.85rem">— AARAV Interiors &nbsp;&bull;&nbsp; Luxury Interior Designers</p>
            </div>`,
        }).catch(err => console.warn(err));
      }
    } catch (mailErr) {
      console.warn('Email notification failed (non-fatal):', mailErr.message);
    }
  } catch (err) {
    console.error('Save design error:', err);
    res.status(500).json({ message: err.message || 'Failed to save design' });
  }
});

// POST /api/admin/projects/:id/designs/upload  (real file upload via multer + Cloudinary)
router.post('/projects/:id/designs/upload', upload.single('file'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    // Explicitly set resource_type per file:
    // PDFs → 'raw'   so Cloudinary stores under /raw/upload/ with correct Content-Type
    // Images → 'image' for normal image processing and delivery
    const isPDF = req.file.mimetype === 'application/pdf';

    const cloudinaryUrl = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder:        'aarav-interiors/designs',
          resource_type: isPDF ? 'raw' : 'image',
          public_id:     `project_${req.params.id}_${Date.now()}`,
          format:        isPDF ? 'pdf' : undefined,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.end(req.file.buffer);
    });

    // Save design entry into project
    const designEntry = {
      name:       req.body.name  || req.file.originalname,
      type:       req.body.type  || '3D Render',
      url:        cloudinaryUrl,
      approved:   false,
      uploadedAt: new Date(),
    };
    project.designs.push(designEntry);
    await project.save();

    res.status(201).json({ message: 'Design uploaded successfully', design: designEntry, designs: project.designs });
  } catch (err) {
    console.error('Design upload error:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

// GET /api/admin/payments
// Audit table — ALL payments are always returned regardless of project/client existence.
// $lookup is LEFT JOIN by nature; missing project/client produces empty array → $arrayElemAt
// returns null → frontend shows "Project Deleted" / "Client Deleted" gracefully.
router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.aggregate([
      // ── Step 1: left-join projects (empty array when project deleted) ────────
      {
        $lookup: {
          from: 'projects',
          let: { pid: '$projectId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { _id: 1, title: 1 } }
          ],
          as: 'project'
        },
      },
      // ── Step 2: left-join users (empty array when client deleted) ────────────
      {
        $lookup: {
          from: 'users',
          let: { cid: '$clientId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$cid'] } } },
            { $project: { _id: 1, name: 1 } }
          ],
          as: 'client'
        },
      },
      // ── Step 3: promote first element (null when lookup found nothing) ───────
      {
        $addFields: {
          projectId: { $arrayElemAt: ['$project', 0] },
          clientId:  { $arrayElemAt: ['$client',  0] },
        },
      },
      // ── Step 4: drop raw lookup arrays only — keep ALL payment fields ────────
      // Exclusion-only $project avoids the mixed include+exclude pitfall.
      // Every field on the Payment document (amount, mode, category, TYPE, etc.)
      // passes through automatically — no field is accidentally omitted.
      {
        $project: { project: 0, client: 0 },
      },
      // ── Step 5: newest first ─────────────────────────────────────────────────
      { $sort: { createdAt: -1 } },
    ]);

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// POST /api/admin/payments  — records payment + conditionally increments project.amountPaid
router.post('/payments', async (req, res) => {
  try {
    const { projectId, clientId, amount, mode, category, type, description } = req.body;
    if (!projectId || !clientId || !amount) {
      return res.status(400).json({ message: 'projectId, clientId and amount are required' });
    }

    const paymentType = (type === 'expense') ? 'expense' : 'income'; // safe fallback

    // Snapshot client name + project title at creation time — survives deletion permanently
    const [clientDoc, projectDoc] = await Promise.all([
      User.findById(clientId).select('name').lean(),
      Project.findById(projectId).select('title').lean(),
    ]);

    const payment = await Payment.create({
      projectId, clientId,
      amount:      Number(amount),
      mode:        mode || 'Other',
      category:    category || 'Other',
      type:        paymentType,
      description: description || '',
      status:      'paid',
      paidAt:      new Date(),
      // Permanent audit snapshots
      clientNameSnapshot:   clientDoc?.name  || '',
      projectTitleSnapshot: projectDoc?.title || '',
      // Set invoiceType explicitly — never inferred later
      invoiceType: paymentType === 'expense' ? 'expense' : 'income',
    });

    // Only increment amountPaid for INCOME — expenses must never affect client balance
    let project = null;
    if (paymentType === 'income') {
      project = await Project.findByIdAndUpdate(
        projectId,
        { $inc: { amountPaid: Number(amount) } },
        { new: true }
      );
    } else {
      project = projectDoc || null;
    }

    res.status(201).json({ payment, project });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/payments/:id/mark-paid
router.put('/payments/:id/mark-paid', async (req, res) => {
  const payment = await Payment.findByIdAndUpdate(
    req.params.id,
    { status: 'paid', paidAt: new Date() },
    { new: true }
  );
  res.json(payment);
});

// POST /api/admin/payments/:id/invoice
// Generates luxury PDF, saves locally, persists relative URL in Payment doc.
// Idempotent: returns existing URL if invoice already generated.
router.post('/payments/:id/invoice', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).lean();
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // ── Idempotent guard — return existing invoice without regenerating
    if (payment.invoiceUrl && payment.invoiceNumber) {
      return res.json({ invoiceUrl: payment.invoiceUrl, invoiceNumber: payment.invoiceNumber, alreadyExists: true });
    }

    // ── 1. Backfill missing snapshots ———————————————————————————
    let clientNameSnapshot   = payment.clientNameSnapshot;
    let projectTitleSnapshot = payment.projectTitleSnapshot;

    if (!clientNameSnapshot) {
      const c = await User.findById(payment.clientId).select('name').lean();
      clientNameSnapshot = c?.name || 'Deleted Client';
      await Payment.findByIdAndUpdate(payment._id, { clientNameSnapshot });
    }
    if (!projectTitleSnapshot) {
      const p = await Project.findById(payment.projectId).select('title').lean();
      projectTitleSnapshot = p?.title || 'Archived Project';
      await Payment.findByIdAndUpdate(payment._id, { projectTitleSnapshot });
    }
    payment.clientNameSnapshot   = clientNameSnapshot;
    payment.projectTitleSnapshot = projectTitleSnapshot;

    // ── 2. Generate invoice number (INV-YYYYMMDD-PAY-XXXX) ————————
    const invoiceNumber = await _getInvoiceNumber(payment.paidAt);

    // ── 3. Build PDF buffer ————————————————————————————————————
    const pdfBuffer = await _buildInvoicePDF(payment, invoiceNumber);

    // ── 4. Save PDF to local disk ————————————————————————————
    const filename   = `invoice_${invoiceNumber}.pdf`;
    const filePath   = path.join(INVOICE_DIR, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    // Relative URL served by express.static — no auth, no expiry
    const invoiceUrl = `/uploads/invoices/${filename}`;

    // ── 5. Persist invoice fields (financial fields untouched) ———
    const effectiveInvoiceType = payment.invoiceType ||
      (payment.type === 'expense' ? 'expense' : 'income');

    await Payment.findByIdAndUpdate(payment._id, {
      invoiceUrl,
      invoiceNumber,
      invoiceGeneratedAt: new Date(),
      ...(payment.invoiceType ? {} : { invoiceType: effectiveInvoiceType }),
    });

    res.json({ invoiceUrl, invoiceNumber });
  } catch (err) {
    console.error('Invoice generation error:', err);
    res.status(500).json({ message: err.message || 'Failed to generate invoice' });
  }
});

// ── POST /api/admin/clients/:clientId/ledger-invoice ───────────────────────
// Generates a full consolidated ledger PDF for ALL payments of a client.
// Always regenerates fresh (reflects current state). Stores ledger fields only.
router.post('/clients/:clientId/ledger-invoice', async (req, res) => {
  try {
    const { clientId } = req.params;

    // 1. Fetch all payments for this client, oldest first
    const payments = await Payment.find({ clientId })
      .sort({ paidAt: 1, createdAt: 1 })
      .lean();

    if (!payments.length) {
      return res.status(404).json({ message: 'No payments found for this client' });
    }

    // 2. Resolve client name and project title from snapshots / live data
    let clientName   = payments[0].clientNameSnapshot   || '';
    let projectTitle = payments[0].projectTitleSnapshot || '';
    if (!clientName) {
      const c = await User.findById(clientId).select('name').lean();
      clientName = c?.name || 'Client';
    }
    if (!projectTitle) {
      const p = await Project.findOne({ clientId }).select('title').lean();
      projectTitle = p?.title || 'Project';
    }

    // 3. Try to get outstanding balance from live project
    let outstanding = null;
    try {
      const proj = await Project.findOne({ clientId }).select('totalCost amountPaid').lean();
      if (proj && proj.totalCost) {
        outstanding = Math.max(0, proj.totalCost - (proj.amountPaid || 0));
      }
    } catch (_) { /* non-fatal */ }

    // 4. Generate ledger invoice number
    const ledgerInvoiceNumber = await _getLedgerInvoiceNumber();

    // 5. Build PDF
    const pdfBuffer = await _buildLedgerPDF(payments, clientName, projectTitle, ledgerInvoiceNumber, outstanding);

    // 6. Save to disk
    const filename = `ledger_${ledgerInvoiceNumber}.pdf`;
    const filePath = path.join(INVOICE_DIR, filename);
    fs.writeFileSync(filePath, pdfBuffer);
    const ledgerInvoiceUrl = `/uploads/invoices/${filename}`;

    // 7. Store ledger fields on most-recent payment only (does NOT touch invoiceUrl/invoiceNumber)
    const mostRecent = await Payment.findOne({ clientId }).sort({ paidAt: -1, createdAt: -1 });
    if (mostRecent) {
      await Payment.findByIdAndUpdate(mostRecent._id, {
        ledgerInvoiceUrl,
        ledgerInvoiceNumber,
        ledgerGeneratedAt: new Date(),
      });
    }

    res.json({ ledgerInvoiceUrl, ledgerInvoiceNumber });
  } catch (err) {
    console.error('Ledger invoice generation error:', err);
    res.status(500).json({ message: err.message || 'Failed to generate ledger invoice' });
  }
});

// GET /api/admin/invoices/:file  — direct download (auth-protected)
router.get('/invoices/:file', (req, res) => {
  // Sanitise filename — strip any path traversal attempts
  const filename = path.basename(req.params.file);
  const filePath = path.join(INVOICE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Invoice file not found' });
  }
  res.download(filePath, filename);
});

// GET /api/admin/queries
// Queries are hard-deleted on project delete; this filter is a safety net for any legacy orphans.
router.get('/queries', async (req, res) => {
  const queries = await Query.find()
    .populate('clientId', 'name email')
    .populate('projectId', 'title')  // resolves to null if project was deleted
    .sort('-createdAt');

  // Strip any orphaned queries whose project no longer exists
  const filtered = queries.filter(q => q.projectId !== null);
  res.json(filtered);
});

// PATCH /api/admin/queries/:id/resolve
router.patch('/queries/:id/resolve', async (req, res) => {
  const query = await Query.findByIdAndUpdate(
    req.params.id,
    { status: 'resolved' },
    { new: true }
  );
  if (!query) return res.status(404).json({ message: 'Query not found' });
  res.json(query);
});

// GET /api/admin/messages/:projectId
router.get('/messages/:projectId', async (req, res) => {
  const msgs = await Message.find({ projectId: req.params.projectId }).populate('senderId', 'name role').sort('createdAt');
  res.json(msgs);
});

// POST /api/admin/messages
router.post('/messages', async (req, res) => {
  const msg = await Message.create({ ...req.body, senderId: req.user._id, senderRole: 'admin' });
  res.status(201).json(msg);
});

// GET /api/admin/payments/client/:clientId
router.get('/payments/client/:clientId', async (req, res) => {
  try {
    const payments = await Payment.find({ clientId: req.params.clientId }).sort('-createdAt');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/projects/:id/financials
// Returns live income, expense, profit, and balance derived from the Payment collection (SSOT).
router.get('/projects/:id/financials', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const result = await Payment.aggregate([
      { $match: { projectId: new (require('mongoose').Types.ObjectId)(req.params.id) } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const totalIncome   = result.find(r => r._id === 'income')?.total  || 0;
    const totalExpenses = result.find(r => r._id === 'expense')?.total || 0;
    const profit        = totalIncome - totalExpenses;
    const balanceDue    = Math.max(0, (project.totalCost || 0) - totalIncome);

    res.json({ totalIncome, totalExpenses, profit, balanceDue, totalCost: project.totalCost || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
