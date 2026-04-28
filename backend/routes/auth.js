const express      = require('express');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const nodemailer   = require('nodemailer');
const User         = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// ── MAIL TRANSPORTER ──────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

// POST /api/auth/register  (Public — creates clients or admin accounts)
router.post('/register', async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already exists' });

    // Use provided password if given (e.g. for admin), else auto-generate
    const rawPassword = req.body.password || crypto.randomBytes(4).toString('hex');
    console.log('Generated password:', rawPassword); // temp debug log

    // Let mongoose pre('save') handle bcrypt hashing — do NOT hash manually
    const user = await User.create({ name, email, password: rawPassword, phone, role: 'client' });

    // Send the EXACT same rawPassword — never touch it after this point
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Aarav Interiors Login Credentials',
        html: `
          <h2>Welcome to AARAV Interiors</h2>
          <p>Your account has been created successfully.</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${rawPassword}</p>
          <p>Please login and change your password after your first sign-in.</p>
        `,
      });
    } catch (mailErr) {
      // Log mail failure but do NOT block the response
      console.error('Failed to send welcome email:', mailErr.message);
    }

    res.status(201).json({ message: 'Client created', id: user._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
