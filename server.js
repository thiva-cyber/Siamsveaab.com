/**
 * SiamSvea Website — Backend Server
 * Node.js + Express + Resend
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'Public')));

// Rate limiting
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in 15 minutes.' }
});

// ── INPUT VALIDATION ──────────────────────────────────────
function validateContact(body) {
  const errors = [];
  const { name, email, message, plan } = body;
  if (!name || name.trim().length < 2) errors.push('Name must be at least 2 characters.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please provide a valid email address.');
  if (!message || message.trim().length < 10) errors.push('Message must be at least 10 characters.');
  const validPlans = ['one-time', 'monthly', 'undecided'];
  if (plan && !validPlans.includes(plan)) errors.push('Invalid plan selection.');
  return errors;
}

// ── ROUTES ────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, message, plan } = req.body;

  const errors = validateContact(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const safe = (str) => str?.toString().replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
  const safeName    = safe(name);
  const safeEmail   = safe(email);
  const safeMessage = safe(message);
  const safePlan    = plan ? safe(plan) : 'Not specified';

  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // Send to business owner
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SiamSvea <onboarding@resend.dev>',
        to: ['siamsveaab@gmail.com'],
        subject: `New Inquiry from ${safeName} — ${safePlan} plan`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #1A1F3C; color: #FAF7F0; padding: 2rem; border-left: 3px solid #C9A84C;">
            <h2 style="color: #C9A84C; font-weight: 300;">New Website Inquiry</h2>
            <hr style="border: none; border-top: 1px solid rgba(201,168,76,0.2); margin: 1rem 0;"/>
            <p><strong style="color: #C9A84C;">Name:</strong> ${safeName}</p>
            <p><strong style="color: #C9A84C;">Email:</strong> ${safeEmail}</p>
            <p><strong style="color: #C9A84C;">Plan:</strong> ${safePlan}</p>
            <p><strong style="color: #C9A84C;">Message:</strong></p>
            <blockquote style="border-left: 2px solid #C9A84C; margin: 0.5rem 0; padding-left: 1rem; color: #9A9EB8;">${safeMessage}</blockquote>
          </div>
        `
      })
    });

    // Auto-reply to sender
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SiamSvea <onboarding@resend.dev>',
        to: [safeEmail],
        subject: 'We received your message — SiamSvea',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #1A1F3C; color: #FAF7F0; padding: 2rem; border-left: 3px solid #C9A84C;">
            <h2 style="color: #C9A84C; font-weight: 300;">Thank you, ${safeName}</h2>
            <p style="color: #9A9EB8; line-height: 1.7;">We have received your message and will get back to you within 24 hours.</p>
            <p style="color: #9A9EB8; line-height: 1.7;">We look forward to building something great with you.</p>
            <hr style="border: none; border-top: 1px solid rgba(201,168,76,0.2); margin: 1.5rem 0;"/>
            <p style="color: #C9A84C; font-size: 0.8rem;">SIAMSVEA AB · STOCKHOLM, SWEDEN</p>
          </div>
        `
      })
    });

    console.log(`[Contact] New inquiry from ${safeName} <${safeEmail}> — plan: ${safePlan}`);
    res.json({ success: true, message: 'Thank you! Your message has been sent.' });

  } catch (err) {
    console.error('[Contact] Email error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send message. Please email us directly at siamsveaab@gmail.com' });
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
