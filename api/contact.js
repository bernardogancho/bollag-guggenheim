const nodemailer = require('nodemailer');

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'welcome@bollag.net';
const CONTACT_FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL ||
  (process.env.SMTP_USER ? `Bollag Website <${process.env.SMTP_USER}>` : 'Bollag Website <no-reply@bollag.net>');

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function wantsJson(req) {
  const accept = String(req.headers.accept || '');
  const requestedWith = String(req.headers['x-requested-with'] || '');
  return accept.includes('application/json') || requestedWith.toLowerCase() === 'fetch';
}

function createTransport() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL);
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    const error = new Error('Email settings are not configured.');
    error.statusCode = 500;
    throw error;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user,
      pass: password,
    },
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalize(value) {
  return String(value || '').trim();
}

function formatMessage(data) {
  const lines = [
    'New contact form submission',
    '',
    `Name: ${data.firstName} ${data.lastName}`,
    `Email: ${data.email}`,
    `Company: ${data.company || '—'}`,
    `Subject: ${data.subject}`,
    '',
    'Message:',
    data.message,
  ];

  return lines.join('\n');
}

function formatHtml(data) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6">
      <h2 style="margin: 0 0 16px; font-size: 20px;">New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(data.company || '—')}</p>
      <p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>
      <div style="margin-top: 20px;">
        <strong>Message:</strong>
        <div style="white-space: pre-wrap; margin-top: 8px;">${escapeHtml(data.message)}</div>
      </div>
    </div>
  `;
}

function parseBody(rawBody, contentType) {
  if (!rawBody) {
    return {};
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(rawBody));
  }

  return {};
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const rawBody = await readBody(req);
    const payload = parseBody(rawBody, String(req.headers['content-type'] || '').toLowerCase());
    const honeypot = normalize(payload.website);

    if (honeypot) {
      if (wantsJson(req)) {
        return json(res, 200, { ok: true, message: 'Thanks. Your message has been sent.' });
      }

      res.statusCode = 303;
      res.setHeader('Location', '/contact/?sent=1');
      return res.end();
    }

    const contactData = {
      firstName: normalize(payload.first_name || payload.firstName),
      lastName: normalize(payload.last_name || payload.lastName),
      email: normalize(payload.email),
      company: normalize(payload.company),
      subject: normalize(payload.subject),
      message: normalize(payload.message),
    };

    const missingField = ['firstName', 'lastName', 'email', 'subject', 'message'].find(field => !contactData[field]);
    if (missingField) {
      const error = new Error('Please complete all required fields.');
      error.statusCode = 400;
      throw error;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
      const error = new Error('Please enter a valid email address.');
      error.statusCode = 400;
      throw error;
    }

    const transport = createTransport();
    await transport.sendMail({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      replyTo: contactData.email,
      subject: `[Contact] ${contactData.subject}`,
      text: formatMessage(contactData),
      html: formatHtml(contactData),
    });

    if (wantsJson(req)) {
      return json(res, 200, {
        ok: true,
        message: 'Thanks. Your message has been sent.',
      });
    }

    res.statusCode = 303;
    res.setHeader('Location', '/contact/?sent=1');
    return res.end();
  } catch (error) {
    if (wantsJson(req)) {
      return json(res, error.statusCode || 500, {
        error: error.message || 'Could not send your message.',
        details: error.details || null,
      });
    }

    res.statusCode = 303;
    res.setHeader('Location', '/contact/?sent=0');
    return res.end();
  }
};
