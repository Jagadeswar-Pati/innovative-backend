import nodemailer from 'nodemailer';
import { sendBrevoEmail } from '../services/brevoEmail.service.js';

const buildTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, '') ?? '';

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const getSenderDetails = () => {
  const rawFrom = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!rawFrom) return null;

  const match = rawFrom.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    const email = match[2].trim();
    return { rawFrom, email, name: name || undefined };
  }

  return { rawFrom: rawFrom.trim(), email: rawFrom.trim() };
};

/**
 * Gmail SMTP only reliably sends when From matches the authenticated account.
 * If SMTP_FROM is a different domain, use SMTP_USER as From and keep the display name.
 */
const resolveSmtpFromHeader = (sender) => {
  const smtpUser = process.env.SMTP_USER?.trim();
  if (!smtpUser || !sender) return { from: sender.rawFrom, smtpReplyTo: undefined };

  const host = (process.env.SMTP_HOST || '').toLowerCase();
  const userLower = smtpUser.toLowerCase();
  const fromLower = sender.email.toLowerCase();
  const isLikelyGmail =
    host.includes('gmail') || userLower.endsWith('@gmail.com') || userLower.endsWith('@googlemail.com');

  if (isLikelyGmail && fromLower !== userLower) {
    const displayName = sender.name || 'Innovative Hub';
    const safeName = String(displayName).replace(/"/g, '');
    return {
      from: `"${safeName}" <${smtpUser}>`,
      smtpReplyTo: sender.email,
    };
  }

  return { from: sender.rawFrom, smtpReplyTo: undefined };
};

const hasBrevo = () => Boolean(process.env.BREVO_API_KEY);

const formatReplyTo = (replyTo) => {
  if (!replyTo) return undefined;
  if (typeof replyTo === 'string') return replyTo;
  if (replyTo.email && replyTo.name) return `${replyTo.name} <${replyTo.email}>`;
  return replyTo.email || undefined;
};

/** Base URL for all email links (login, order, checkout). Use FRONTEND_URL on Render so links point to live site, not localhost. */
export const getFrontendBaseUrl = () => {
  const u = process.env.FRONTEND_URL?.trim();
  if (u) return u.replace(/\/$/, '');
  const login = process.env.LOGIN_URL?.trim();
  if (login) return login.replace(/\/login\/?$/, '').replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production' && process.env.DOMAIN?.trim()) {
    const d = process.env.DOMAIN.trim().replace(/^https?:\/\//, '');
    return `https://${d}`;
  }
  return 'http://localhost:5177';
};

/**
 * Send email via SMTP, falling back to Brevo if SMTP fails and Brevo is configured.
 * @returns {Promise<boolean>} true if email was sent, false if skipped or failed
 */
const sendEmailWithFallback = async ({ toEmail, toName, subject, html, attachments = [], replyTo }) => {
  const sender = getSenderDetails();
  if (!sender) {
    console.warn('Mail: sender not configured (set SMTP_FROM or SMTP_USER); skipping email');
    return false;
  }

  const transporter = buildTransporter();

  if (transporter) {
    try {
      const to = toName ? `"${String(toName).replace(/"/g, '')}" <${toEmail}>` : toEmail;
      const { from, smtpReplyTo } = resolveSmtpFromHeader(sender);
      const mergedReplyTo = replyTo || (smtpReplyTo ? { email: smtpReplyTo } : undefined);
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments: attachments || [],
        replyTo: formatReplyTo(mergedReplyTo),
      });
      return true;
    } catch (err) {
      console.warn('SMTP send failed:', err?.message || err);
      if (!hasBrevo()) {
        console.warn('Brevo not configured; email not sent. Check SMTP settings.');
        return false;
      }
    }
  } else {
    if (!hasBrevo()) {
      console.warn('Mail: SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS) and Brevo not set; skipping email');
      return false;
    }
  }

  try {
    await sendBrevoEmail({
      sender: { email: sender.email, name: sender.name || 'Innovative Hub' },
      to: { email: toEmail, name: toName },
      subject,
      html,
      replyTo,
    });
    return true;
  } catch (err) {
    console.error('Brevo fallback failed:', err?.message || err);
    return false;
  }
};

export const sendWelcomeEmail = async ({ email, name }) => {
  const baseUrl = getFrontendBaseUrl();
  const loginUrl = `${baseUrl}/login`;
  const subject = 'Welcome to Innovative Hub';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p>Welcome to Innovative Hub! 🎉<br />Your account has been successfully created, and you’re all set to explore.</p>
      <p>At Innovative Hub, you can:</p>
      <ul>
        <li>Browse high-quality electronics &amp; components</li>
        <li>Explore microcontroller boards, sensors, and modules</li>
        <li>Track your orders easily</li>
        <li>Get support for projects, innovation, and 3D printing services</li>
      </ul>
      <p>You will receive email updates for every order (confirmed, packed, shipped, delivered) so you're always in the loop.</p>
      <p>You can log in anytime using your registered email address.</p>
      <p>👉 Login here: <a href="${loginUrl}">${loginUrl}</a></p>
      <p>If you have any questions or need help, feel free to reply to this email — we’re happy to help.</p>
      <p>Happy building &amp; innovating 🚀<br />Team Innovative Hub</p>
      <p>—<br />Innovative Hub<br />Building ideas into reality</p>
    </div>
  `;

  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendOrderSuccessEmail = async ({ email, name, order, invoiceUrl, invoicePdfBuffer, invoiceFilename }) => {
  const subject = `Order Confirmed - ${order?._id}`;
  const baseUrl = getFrontendBaseUrl();
  const orderPageUrl = `${baseUrl}/order/${order?._id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your order has been placed successfully.</strong></p>
      <p>Order ID: <strong>${order?._id}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      <p><strong>Invoice (PDF):</strong> You can view and download your invoice from your order page: <a href="${orderPageUrl}">View order &amp; download invoice (PDF)</a>.${invoicePdfBuffer && invoiceFilename ? ' The invoice is also attached to this email.' : ''}</p>
      <p>You will receive an email at each step: when your order is packed, shipped (with tracking), and delivered.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  const attachments = [];
  if (invoicePdfBuffer && invoiceFilename) {
    attachments.push({ filename: invoiceFilename, content: invoicePdfBuffer });
  }
  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html, attachments });
};

const orderLinkHtml = (orderId, baseUrl, label = 'View order') => {
  const base = baseUrl || getFrontendBaseUrl();
  return `<a href="${base.replace(/\/$/, '')}/order/${orderId}">${label}</a>`;
};

export const sendOrderConfirmedEmail = async ({ email, name, order }) => {
  const subject = `Order Confirmed - ${order?._id} | Innovative Hub`;
  const baseUrl = getFrontendBaseUrl();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your order has been confirmed.</strong></p>
      <p>Order ID: <strong>${order?._id}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      <p>We will notify you when your order is packed and shipped.</p>
      <p>Track your order: ${orderLinkHtml(order?._id, baseUrl, 'View order details')}</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;
  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendOrderPackedEmail = async ({ email, name, order }) => {
  const subject = `Order Packed - ${order?._id} | Innovative Hub`;
  const baseUrl = getFrontendBaseUrl();
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your order has been packed and is ready to ship.</strong></p>
      <p>Order ID: <strong>${order?._id}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      <p>We will send you another email when it is shipped with tracking details.</p>
      <p>${orderLinkHtml(order?._id, baseUrl, 'View order')}</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;
  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendOrderShippedEmail = async ({ email, name, order, trackingLink, trackingMessage }) => {
  const subject = `Order Shipped - ${order?._id} | Innovative Hub`;
  const baseUrl = getFrontendBaseUrl();
  const trackingSection = (trackingLink || trackingMessage)
    ? `<p><strong>Tracking:</strong> ${trackingLink ? `<a href="${trackingLink}">Track your shipment</a>` : ''} ${trackingMessage ? ` – ${trackingMessage}` : ''}</p>`
    : '<p>You will receive tracking details soon.</p>';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your order has been shipped.</strong></p>
      <p>Order ID: <strong>${order?._id}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      ${trackingSection}
      <p>${orderLinkHtml(order?._id, baseUrl, 'View order')}</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;
  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendOrderDeliveredEmail = async ({ email, name, order }) => {
  const orderId = order?._id != null ? String(order._id) : '';
  const subject = `Order Delivered - ${orderId} | Innovative Hub`;
  const baseUrl = getFrontendBaseUrl();
  const orderPageUrl = `${baseUrl}/order/${orderId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your order has been successfully delivered.</strong></p>
      <p>Order ID: <strong>${orderId}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      <p>Thank you for shopping with us. We hope you are satisfied with your purchase.</p>
      <p>You can view your order details here: <a href="${orderPageUrl}">View order</a>.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  return sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendOrderFailedEmail = async ({ email, name, reason }) => {
  const subject = 'Payment Failed - Innovative Hub';
  const baseUrl = getFrontendBaseUrl();
  const checkoutUrl = `${baseUrl}/checkout`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your payment could not be completed.</strong></p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
      <p>No order was placed. Your cart items are still saved. You can try again when ready.</p>
      <p><a href="${checkoutUrl}">Go to Checkout</a></p>
      <p>If the problem continues, please contact us or try a different payment method.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  return sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

/** Sends reset link only. Never includes old/new password or token as plain text. */
export const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const subject = 'Reset your Innovative Hub password';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p>We received a request to reset your password.</p>
      <p>Click the button below to set a new password:</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Reset my password</a></p>
      <p>This link will expire in 1 hour. If you did not request this, you can ignore this email.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  return sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

/** Sends email verification link with a button. Account is active only after user clicks. */
export const sendVerificationEmail = async ({ email, name, verifyUrl }) => {
  const subject = 'Verify your Innovative Hub account';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p>Thanks for signing up! Please verify your email address to activate your account.</p>
      <p>Click the button below to verify:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;">Verify my email</a></p>
      <p>This link will expire in 24 hours. If you did not create an account, you can ignore this email.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendContactEmail = async ({ toEmail, fromName, fromEmail, subject, message, attachments, attachmentList }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>New Contact Message</h2>
      <p><strong>Name:</strong> ${fromName || 'N/A'}</p>
      <p><strong>Email:</strong> ${fromEmail || 'N/A'}</p>
      ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${(message || '').toString().replace(/\n/g, '<br />')}</p>
      ${attachmentList?.length ? `<p><strong>Attachments:</strong> ${attachmentList.join(', ')}</p>` : ''}
    </div>
  `;

  const sent = await sendEmailWithFallback({
    toEmail,
    toName: 'Innovative Hub',
    subject: subject ? `Contact: ${subject}` : 'New Contact Message',
    html,
    attachments: attachments || [],
    replyTo: fromEmail ? { email: fromEmail, name: fromName } : undefined,
  });
  return sent;
};
