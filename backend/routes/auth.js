const express      = require('express');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const { Resend }   = require('resend');
const User         = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// ── RESEND CLIENT ─────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const signToken = (user) => jwt.sign(
  { id: user._id, email: user.email, role: user.role, name: user.name },
  process.env.JWT_SECRET || 'aarav_secret',
  { expiresIn: process.env.JWT_EXPIRE || '7d' }
);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: signToken(user), name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register
// → Public for first-ever admin creation
// → Requires admin token for all subsequent registrations
router.post('/register', async (req, res) => {
  try {
    // ── BOOTSTRAP GUARD ─────────────────────────────────────────
    // If any admin already exists, this route requires authentication
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      // Run protect middleware inline
      await new Promise((resolve, reject) => {
        protect(req, res, (err) => (err ? reject(err) : resolve()));
      });
      // Run adminOnly middleware inline
      await new Promise((resolve, reject) => {
        adminOnly(req, res, (err) => (err ? reject(err) : resolve()));
      });
    }

    const { name, email, phone } = req.body;

    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });

    // Accept password or temporaryPassword from frontend, else auto-generate
    const rawPassword = req.body.password || req.body.temporaryPassword || crypto.randomBytes(4).toString('hex');
    console.log('Generated password:', rawPassword);

    // Let mongoose pre('save') handle bcrypt hashing — do NOT hash manually
    const user = await User.create({ name, email, password: rawPassword, phone, role: req.body.role || 'client' });

    // ── SEND WELCOME EMAIL via Resend (fire-and-forget) ───────────────
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5500/login.html';
    console.log('Sending email from support@aaravorganisations.com to:', email);
    resend.emails.send({
      from:    'Aarav Interiors <support@aaravorganisations.com>',
      to:      email,
      subject: 'Aarav Interiors — Your Account Details',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
          <h2 style="color:#C6A969">AARAV Interiors</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your account has been created. Here are your login details:</p>
          <table style="border-collapse:collapse;margin:1rem 0;background:#f9f9f9;border-radius:6px;width:100%">
            <tr><td style="padding:10px 16px;color:#555;width:120px">Email</td><td style="padding:10px 16px"><strong>${email}</strong></td></tr>
            <tr><td style="padding:10px 16px;color:#555">Password</td><td style="padding:10px 16px"><strong>${rawPassword}</strong></td></tr>
          </table>
          <a href="${loginUrl}"
            style="display:inline-block;padding:12px 28px;background:#C6A969;color:#fff;
                   text-decoration:none;border-radius:6px;font-weight:bold;margin:0.5rem 0">
            Login to Your Dashboard
          </a>
          <p style="margin-top:1.5rem;color:#555;font-size:0.875rem">Please keep your credentials safe.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0" />
          <p style="color:#999;font-size:0.8rem">&mdash; AARAV Interiors &nbsp;&bull;&nbsp; Luxury Interior Designers</p>
        </div>`,
    })
    .then(() => console.log('✓ Email sent via Resend to', email))
    .catch(err => console.error('EMAIL ERROR:', err));

    res.status(201).json({ message: 'Client created', id: user._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
