/**
 * repair_invoice_storage.js
 * ─────────────────────────────────────────────────────────────
 * ONE-TIME migration script.
 *
 * Problem:
 *   Payments generated before the local-storage switch have:
 *   - Cloudinary invoiceUrl  (res.cloudinary.com/... → HTTP 401)
 *   These need to be cleared so the UI shows "Generate Invoice"
 *   again, and new PDFs are written to backend/uploads/invoices/.
 *
 * What this script touches (ONLY):
 *   invoiceUrl, invoiceNumber, invoiceGeneratedAt   ← cleared
 *
 * What this script NEVER touches:
 *   amount, type, mode, category, description
 *   clientId, projectId, clientNameSnapshot, projectTitleSnapshot
 *   paidAt, status, invoiceType
 *   amountPaid on projects, collections, workflow, financials
 *
 * Run:  node repair_invoice_storage.js
 * Then: delete this file.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const path     = require('path');
const dotenv   = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌  MONGO_URI not found in .env — aborting.');
  process.exit(1);
}

// Inline schema — strict:false preserves all financial/audit fields untouched
const PaymentSchema = new mongoose.Schema({
  invoiceUrl:         { type: String },
  invoiceNumber:      { type: String },
  invoiceGeneratedAt: { type: Date },
}, { strict: false });

const Payment = mongoose.model('Payment', PaymentSchema);

// Matches both authenticated AND upload-type Cloudinary URLs
const CLOUDINARY_PATTERN = /res\.cloudinary\.com/;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB:', MONGO_URI);

  // ── Find all payments that have a Cloudinary invoiceUrl ─────────────────
  const all = await Payment.find({
    invoiceUrl: { $exists: true, $ne: null, $ne: '' },
  }).select('_id invoiceUrl invoiceNumber').lean();

  const toFix = all.filter(p => p.invoiceUrl && CLOUDINARY_PATTERN.test(p.invoiceUrl));

  if (toFix.length === 0) {
    console.log('✅  No Cloudinary invoice URLs found — nothing to repair.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n🔍  Found ${toFix.length} payment(s) with Cloudinary invoice URL:\n`);
  toFix.forEach(p => {
    console.log(`   • Payment  : ${p._id}`);
    console.log(`     Invoice  : ${p.invoiceNumber || '(none)'}`);
    console.log(`     Old URL  : ${p.invoiceUrl}\n`);
  });

  // ── Clear ONLY the three invoice fields ─────────────────────────────────
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
  console.log('    All financial data, amounts, and collections untouched.\n');
  console.log('📋  Next steps:');
  console.log('    1. Restart backend server.');
  console.log('    2. Open Admin → Payments → click a client row.');
  console.log('    3. Click "Generate Invoice" on cleared rows.');
  console.log('    4. PDF saves to backend/uploads/invoices/ — opens directly in browser.');
  console.log('    5. Delete this file: repair_invoice_storage.js\n');

  await mongoose.disconnect();
  console.log('🔌  Disconnected. Migration complete.');
}

run().catch(err => {
  console.error('❌  Migration failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
