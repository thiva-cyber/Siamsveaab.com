/**
 * SiamSvea Website — Backend Server
 * Node.js + Express
 * 
 * Features:
 *   - Serves static frontend
 *   - Contact form API (with nodemailer)
 *   - Rate limiting to prevent spam
 *   - Input validation & sanitization
 */

const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // allow Google Fonts etc.
}));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'Public')));

// Rate limiting: max 5 contact form submissions per 15 min per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in 15 minutes.' }
});

// ── EMAIL TRANSPORTER ─────────────────────────────────────
// Uses Gmail (configure with your real credentials or use SendGrid/Mailgun)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'siamsveaab@gmail.com',
    pass: process.env.EMAIL_PASS || 'YOUR_APP_PASSWORD_HERE'
    // For Gmail: use an App Password, not your main password
    // https://support.google.com/accounts/answer/185833
  }
});

// ── INPUT VALIDATION ──────────────────────────────────────
function validateContact(body) {
  const errors = [];
  const { name, email, message, plan } = body;

  if (!name || name.trim().length < 2)
    errors.push('Name must be at least 2 characters.');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('Please provide a valid email address.');

  if (!message || message.trim().length < 10)
    errors.push('Message must be at least 10 characters.');

  const validPlans = ['one-time', 'monthly', 'undecided'];
  if (plan && !validPlans.includes(plan))
    errors.push('Invalid plan selection.');

  return errors;
}

// ── ROUTES ────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Pricing info (for dynamic loading if needed)
app.get('/api/pricing', (req, res) => {
  res.json({
    plans: [
      {
        id: 'one-time',
        name: 'One-Time Payment',
        tagline: 'Perfect for Beginners',
        priceFrom: 1500,
        currency: 'SEK',
        period: null,
        features: [
          'No ongoing commitment',
          'Fast delivery',
          'Ideal for small projects or startups',
          'Full ownership from day one'
        ]
      },
      {
        id: 'monthly',
        name: 'Monthly Plan',
        tagline: 'The Smart Choice',
        priceFrom: 500,
        priceTo: 1000,
        currency: 'SEK',
        period: 'month',
        recommended: true,
        features: [
          'Reliable web hosting',
          'Regular updates and maintenance',
          'Ongoing support',
          'Small changes and improvements included',
          'Website stays modern, secure and optimized'
        ]
      }
    ]
  });
});

// Contact form submission
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message, plan } = req.body;

  // Validate
  const errors = validateContact(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Sanitize (basic XSS prevention)
  const safe = (str) => str?.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();

  const safeName    = safe(name);
  const safeEmail   = safe(email);
  const safeMessage = safe(message);
  const safePlan    = plan ? safe(plan) : 'Not specified';

  // Compose email to business owner
  const ownerMail = {
    from: `"SiamSvea Contact Form" <${process.env.EMAIL_USER || 'siamsveaab@gmail.com'}>`,
    to: 'siamsveaab@gmail.com',
    subject: `New Inquiry from ${safeName} — ${safePlan} plan`,
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1A1F3C; color: #FAF7F0; padding: 2rem; border-left: 3px solid #C9A84C;">
        <h2 style="color: #C9A84C; font-weight: 300; letter-spacing: 0.05em;">New Website Inquiry</h2>
        <hr style="border: none; border-top: 1px solid rgba(201,168,76,0.2); margin: 1rem 0;"/>
        <p><strong style="color: #C9A84C;">Name:</strong> ${safeName}</p>
        <p><strong style="color: #C9A84C;">Email:</strong> <a href="mailto:${safeEmail}" style="color: #FAF7F0;">${safeEmail}</a></p>
        <p><strong style="color: #C9A84C;">Plan of interest:</strong> ${safePlan}</p>
        <p><strong style="color: #C9A84C;">Message:</strong></p>
        <blockquote style="border-left: 2px solid #C9A84C; margin: 0.5rem 0; padding-left: 1rem; color: #9A9EB8;">
          ${safeMessage}
        </blockquote>
        <hr style="border: none; border-top: 1px solid rgba(201,168,76,0.2); margin: 1rem 0;"/>
        <p style="font-size: 0.75rem; color: #9A9EB8;">Sent from siamsveaab.com contact form · ${new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}</p>
      </div>
    `
  };

  // Auto-reply to sender
  const autoReply = {
    from: `"SiamSvea AB" <${process.env.EMAIL_USER || 'siamsveaab@gmail.com'}>`,
    to: safeEmail,
    subject: 'We received your message — SiamSvea',
    html: `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; background: #1A1F3C; color: #FAF7F0; padding: 2rem; border-left: 3px solid #C9A84C;">
        <h2 style="color: #C9A84C; font-weight: 300;">Thank you, ${safeName}</h2>
        <p style="color: #9A9EB8; line-height: 1.7;">We've received your message and will get back to you within 24 hours.</p>
        <p style="color: #9A9EB8; line-height: 1.7;">We look forward to building something great with you.</p>
        <hr style="border: none; border-top: 1px solid rgba(201,168,76,0.2); margin: 1.5rem 0;"/>
        <p style="color: #C9A84C; font-size: 0.8rem; letter-spacing: 0.1em;">SIAMSVEA AB · STOCKHOLM, SWEDEN</p>
        <p style="font-size: 0.75rem; color: rgba(154,158,184,0.5);">siamsveaab@gmail.com</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(ownerMail);
    await transporter.sendMail(autoReply);

    console.log(`[Contact] New inquiry from ${safeName} <${safeEmail}> — plan: ${safePlan}`);

    res.json({
      success: true,
      message: 'Thank you! Your message has been sent. We\'ll be in touch within 24 hours.'
    });

  } catch (err) {
    console.error('[Contact] Email error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please email us directly at siamsveaab@gmail.com'
    });
  }
});

// ── CATCH-ALL → serve frontend ────────────────────────────
app.get('/google17c1c938f97e8d46.html', (req, res) => {
  res.send('google-site-verification: google17c1c938f97e8d46.html');
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'index.html'));
});

// ── START ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✦ SiamSvea server running at http://localhost:${PORT}\n`);
});

module.exports = app;
