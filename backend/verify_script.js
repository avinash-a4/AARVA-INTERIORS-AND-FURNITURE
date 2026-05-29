const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function getPdfText(buffer) {
  if (typeof pdf === 'function') {
    const data = await pdf(buffer);
    return data.text;
  } else if (pdf && pdf.PDFParse) {
    const parser = new pdf.PDFParse({ data: buffer });
    const res = await parser.getText();
    await parser.destroy();
    return res.text;
  } else {
    throw new Error('Unsupported pdf-parse module format');
  }
}
const User = require('./models/User');
const Project = require('./models/Project');
const Payment = require('./models/Payment');

// Mock request and response to call routes directly if needed,
// but since I only need to test the PDF generation and database,
// I can just directly invoke the functions.
// I will just require the router or start the express app?
// Let's just copy the logic or require admin.js, wait admin.js has Auth middleware.
// Better to just spin up the app on a port and make http requests using native fetch.
const express = require('express');
const adminRoutes = require('./routes/admin');
// const authRoutes = require('./routes/auth');
const app = express();
app.use(express.json());
// mock protect middleware
app.use((req, res, next) => {
  req.user = { _id: new mongoose.Types.ObjectId(), role: 'admin' };
  next();
});
app.use('/api/admin', adminRoutes);
// app.use('/api/auth', authRoutes);

const { MongoMemoryServer } = require('mongodb-memory-server');

let server;
let mongoServer;

async function runTests() {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  
  server = app.listen(5001, () => console.log('Test server running on 5001'));

  try {
    // Clean DB
    await User.deleteMany({});
    await Project.deleteMany({});
    await Payment.deleteMany({});

    // Create admin
    const admin = await User.create({
      name: 'Test Admin',
      email: 'admin@example.com',
      password: 'password',
      role: 'admin'
    });

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'aarav_secret');
    const headers = { 'Authorization': 'Bearer ' + token };

    // Create client
    const client = await User.create({
      name: 'Test Client',
      email: 'testclient@example.com',
      password: 'password',
      role: 'client'
    });

    const project = await Project.create({
      title: 'Test Project',
      clientId: client._id,
      totalCost: 500000,
      amountPaid: 0,
      progress: 0
    });

    // TEST 1: Single payment invoice
    const p1 = await Payment.create({
      projectId: project._id,
      clientId: client._id,
      amount: 50000,
      type: 'income',
      mode: 'UPI',
      category: 'Plywood',
      description: 'Advance',
      status: 'paid',
      paidAt: new Date('2026-05-20'),
      invoiceType: 'income'
    });
    
    let res1 = await fetch(`http://localhost:5001/api/admin/payments/${p1._id}/invoice`, { method: 'POST', headers });
    let data1 = await res1.json();
    if (!res1.ok || !data1.invoiceUrl) {
      console.error("Fetch invoice failed:", res1.status, data1);
    }
    
    let t1_pass = true;
    if (!data1.invoiceUrl || !data1.invoiceNumber) t1_pass = false;
    
    // check PDF 1
    const pdf1Path = path.join(__dirname, data1.invoiceUrl);
    const pdf1Buf = fs.readFileSync(pdf1Path);
    const pdf1Text = await getPdfText(pdf1Buf);
    
    // No stray 1 check
    if (pdf1Text.includes('TOTAL AMOUNT\n1 \u20B9')) t1_pass = false; // The prompt said stray "1" was removed
    // Check amount
    if (!pdf1Text.includes('50,000')) t1_pass = false;
    // Check mode
    if (!pdf1Text.includes('UPI')) t1_pass = false;

    console.log(`TEST 1 (Single Invoice): ${t1_pass ? 'PASS' : 'FAIL'}`);

    // Create more payments for Test 2
    const p2 = await Payment.create({
      projectId: project._id,
      clientId: client._id,
      amount: 5000,
      type: 'expense',
      mode: 'Cash',
      category: 'Hardware',
      description: 'Labour',
      status: 'paid',
      paidAt: new Date('2026-05-21'),
      invoiceType: 'expense'
    });

    const p3 = await Payment.create({
      projectId: project._id,
      clientId: client._id,
      amount: 75000,
      type: 'income',
      mode: 'Other',
      category: 'Other',
      description: '[Collection] Weekly Procurement',
      status: 'paid',
      paidAt: new Date('2026-05-24'),
      invoiceType: 'collection'
    });

    // Test 2: Full Client Invoice
    let res2 = await fetch(`http://localhost:5001/api/admin/clients/${client._id}/ledger-invoice`, { method: 'POST', headers });
    let data2 = await res2.json();

    let t2_pass = true;
    if (!data2.ledgerInvoiceNumber?.startsWith('LEDGER-')) t2_pass = false;
    
    const pdf2Path = path.join(__dirname, data2.ledgerInvoiceUrl);
    const pdf2Buf = fs.readFileSync(pdf2Path);
    const pdf2Text = await getPdfText(pdf2Buf);

    // verify totals
    if (!pdf2Text.includes('1,25,000')) t2_pass = false; // total income 50k + 75k
    if (!pdf2Text.includes('5,000')) t2_pass = false; // expense
    if (!pdf2Text.includes('1,20,000')) t2_pass = false; // net collected
    if (!pdf2Text.includes('3')) t2_pass = false; // total transactions

    console.log(`TEST 2 (Ledger Invoice): ${t2_pass ? 'PASS' : 'FAIL'}`);

    // TEST 3: Storage safety
    let t3_pass = true;
    const dbP1 = await Payment.findById(p1._id);
    if (!dbP1.invoiceUrl || !dbP1.invoiceNumber || !dbP1.invoiceGeneratedAt) t3_pass = false;
    
    const dbP3 = await Payment.findById(p3._id); // most recent
    if (!dbP3.ledgerInvoiceUrl || !dbP3.ledgerInvoiceNumber || !dbP3.ledgerGeneratedAt) t3_pass = false;
    if (dbP1.ledgerInvoiceUrl) t3_pass = false; // should only be on most recent

    console.log(`TEST 3 (Storage safety): ${t3_pass ? 'PASS' : 'FAIL'}`);

    // TEST 4: Deleted entity
    await User.findByIdAndDelete(client._id);
    let res4 = await fetch(`http://localhost:5001/api/admin/clients/${client._id}/ledger-invoice`, { method: 'POST', headers });
    let data4 = await res4.json();
    
    let t4_pass = true;
    if (!data4.ledgerInvoiceUrl) t4_pass = false;
    const pdf4Path = path.join(__dirname, data4.ledgerInvoiceUrl);
    const pdf4Buf = fs.readFileSync(pdf4Path);
    const pdf4Text = await getPdfText(pdf4Buf);
    if (!pdf4Text.includes('Client')) t4_pass = false; // fallback

    console.log(`TEST 4 (Deleted entity): ${t4_pass ? 'PASS' : 'FAIL'}`);

    // TEST 5: Large history
    for(let i=0; i<30; i++) {
       await Payment.create({
        projectId: project._id,
        clientId: client._id,
        amount: 1000,
        type: 'income',
        mode: 'Cash',
        category: 'Other',
        description: 'Test',
        status: 'paid',
        paidAt: new Date(),
        invoiceType: 'income'
      });
    }

    let res5 = await fetch(`http://localhost:5001/api/admin/clients/${client._id}/ledger-invoice`, { method: 'POST', headers });
    let data5 = await res5.json();
    let t5_pass = true;
    const pdf5Path = path.join(__dirname, data5.ledgerInvoiceUrl);
    const pdf5Buf = fs.readFileSync(pdf5Path);
    // We can get number of pages by parsing first
    if (typeof pdf === 'function') {
      const pdf5Data = await pdf(pdf5Buf);
      if (pdf5Data.numpages < 2) t5_pass = false;
    } else if (pdf && pdf.PDFParse) {
      const parser = new pdf.PDFParse({ data: pdf5Buf });
      const docInfo = await parser.load();
      if (docInfo.numPages < 2) t5_pass = false;
      await parser.destroy();
    }

    console.log(`TEST 5 (Large history): ${t5_pass ? 'PASS' : 'FAIL'}`);

  } catch (err) {
    console.error(err);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }
}

runTests();
