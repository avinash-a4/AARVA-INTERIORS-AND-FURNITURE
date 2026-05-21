/**
 * repair_invoice_access.js
 * ─────────────────────────────────────────────────────────────
 * ONE-TIME migration script.
 *
 * Problem:
 *   Invoices generated before the Cloudinary public-access fix were
 *   uploaded with type:'authenticated' (Cloudinary default for raw assets).
 *   Their secure_url contains /raw/authenticated/ → browser gets HTTP 401.
 *
 * What this script does:
 *   1. Finds all Payment docs where invoiceUrl exists AND contains
 *      '/raw/authenticated/' (the old broken pattern).
 *   2. Clears only: invoiceUrl, invoiceNumber, invoiceGeneratedAt
 *   3. Leaves EVERYTHING else untouched:
 *      amount, type, mode, category, description, clientId, projectId,
 *      clientNameSnapshot, projectTitleSnapshot, paidAt, amountPaid,
 *      invoiceType, collections, workflow, financials — all safe.
 *
 * After running:
 *   Open admin → Payments → click any client row → Generate Invoice
 *   New invoices will upload with type:'upload' (public access).
 *
 * DELETE this file after successful verification.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const path    = require('path');
const dotenv  = require('dotenv');
const mongoose = require('mongoose');

// Load env from backend/.env (works whether run from backend/ or project root)
dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌  MONGO_URI not found in .env — aborting.');
  process.exit(1);
}

// ── Inline Payment schema (read-only subset, no side-effects on other models)
const PaymentSchema = new mongoose.Schema({
  invoiceUrl:         { type: String },
  invoiceNumber:      { type: String },
  invoiceGeneratedAt: { type: Date },
}, { strict: false }); // strict:false so all other fields are preserved untouched

const Payment = mongoose.model('Payment', PaymentSchema);

// ── Old authenticated URL pattern set by Cloudinary when type is omitted
const AUTHENTICATED_PATTERN = /\/raw\/authenticated\//;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB:', MONGO_URI);

  // ── 1. Find broken invoices ──────────────────────────────────────────────
  // invoiceUrl exists (not null/empty) AND contains the authenticated path segment
  const brokenPayments = await Payment.find({
    invoiceUrl: { $exists: true, $ne: null, $ne: '' },
  }).select('_id invoiceUrl invoiceNumber').lean();

  const toFix = brokenPayments.filter(p =>
    p.invoiceUrl && AUTHENTICATED_PATTERN.test(p.invoiceUrl)
  );

  if (toFix.length === 0) {
    console.log('✅  No broken invoices found — nothing to repair.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n🔍  Found ${toFix.length} payment(s) with authenticated (broken) invoice URL:\n`);
  toFix.forEach(p => {
    console.log(`   • Payment ID: ${p._id}`);
    console.log(`     Invoice No: ${p.invoiceNumber || '(none)'}`);
    console.log(`     Old URL:    ${p.invoiceUrl}\n`);
  });

  // ── 2. Clear invoice fields — financial data completely untouched ─────────
  const ids = toFix.map(p => p._id);

  const result = await Payment.updateMany(
    { _id: { $in: ids } },
    {
      $unset: {
        invoiceUrl:         '',
        invoiceNumber:      '',
        invoiceGeneratedAt: '',
      },
    }
  );

  console.log(`✅  Cleared invoice fields on ${result.modifiedCount} payment(s).`);
  console.log('   amount, type, collections, workflow, financials — ALL untouched.\n');
  console.log('📋  Next steps:');
  console.log('   1. Restart backend server.');
  console.log('   2. Open Admin → Payments → click a client row.');
  console.log('   3. Click "Generate Invoice" — new URL will be publicly accessible.');
  console.log('   4. Delete this file: repair_invoice_access.js\n');

  await mongoose.disconnect();
  console.log('🔌  Disconnected. Migration complete.');
}

run().catch(err => {
  console.error('❌  Migration failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
