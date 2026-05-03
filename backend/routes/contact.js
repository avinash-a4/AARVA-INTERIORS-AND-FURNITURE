const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const Lead = require('../models/Lead');

const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body;

    // Basic Validation
    if (!name || !email || !phone || !message) {
      return res.status(400).json({ error: 'Please provide all required fields (Name, Email, Phone, Message).' });
    }

    // 1. SAVE TO DB
    await Lead.create({
      name,
      email,
      phone,
      service,
      message,
      createdAt: new Date()
    });

    // 2. SEND EMAIL
    await resend.emails.send({
      from: 'AARAV Interiors <support@aaravorganisations.com>',
      to: 'aaravinteriordesigners@gmail.com',
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h2>New Lead</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Service Requested:</b> ${service || 'None specified'}</p>
        <p><b>Message:</b><br/> ${message.replace(/\n/g, '<br/>')}</p>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Contact email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;
