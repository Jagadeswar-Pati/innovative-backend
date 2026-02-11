import nodemailer from 'nodemailer';
import { sendBrevoEmail } from '../services/brevoEmail.service.js';
import { isInstitutionalEmailDomain } from './emailDomain.js';

const buildTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

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

const sendEmailWithFallback = async ({ toEmail, toName, subject, html, attachments = [], replyTo }) => {
  const sender = getSenderDetails();
  if (!sender) {
    console.warn('SMTP sender not configured; skipping email');
    return;
  }

  const isRestrictedDomain = isInstitutionalEmailDomain(toEmail);
  const transporter = buildTransporter();

  if (isRestrictedDomain) {
    try {
      await sendBrevoEmail({
        sender: { email: sender.email, name: sender.name },
        to: { email: toEmail, name: toName },
        subject,
        html,
        replyTo,
      });
    } catch (err) {
      console.error('Failed to send email via Brevo:', err?.message || err);
    }
    return;
  }

  if (transporter) {
    try {
      await transporter.sendMail({ from: sender.rawFrom, to: toEmail, subject, html, attachments, replyTo });
      return;
    } catch (err) {
      console.warn('SMTP failed; retrying via Brevo:', err?.message || err);
    }
  } else {
    console.warn('SMTP not configured; using Brevo fallback');
  }

  try {
    await sendBrevoEmail({
      sender: { email: sender.email, name: sender.name },
      to: { email: toEmail, name: toName },
      subject,
      html,
      replyTo,
    });
  } catch (err) {
    console.error('Failed to send email via Brevo:', err?.message || err);
  }
};

export const sendWelcomeEmail = async ({ email, name }) => {
  const baseUrl = process.env.LOGIN_URL || process.env.FRONTEND_URL || 'http://localhost:5174/login';
  const loginUrl = baseUrl.endsWith('/login') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/login`;
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
  const baseUrl = process.env.FRONTEND_URL || process.env.LOGIN_URL || 'http://localhost:5177';
  const orderPageUrl = `${baseUrl.replace(/\/$/, '')}/order/${order?._id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p>Your order has been placed successfully.</p>
      <p>Order ID: <strong>${order?._id}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      <p><strong>Invoice (PDF):</strong> You can view and download your invoice from your order page: <a href="${orderPageUrl}">View order &amp; download invoice (PDF)</a>.${invoicePdfBuffer && invoiceFilename ? ' The invoice is also attached to this email.' : ''}</p>
      <p>We will notify you as the order progresses.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  const attachments = [];
  if (invoicePdfBuffer && invoiceFilename) {
    attachments.push({ filename: invoiceFilename, content: invoicePdfBuffer });
  }
  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html, attachments });
};

export const sendOrderDeliveredEmail = async ({ email, name, order }) => {
  const subject = `Order Delivered - ${order?._id}`;
  const baseUrl = process.env.FRONTEND_URL || process.env.LOGIN_URL || 'http://localhost:5177';
  const orderPageUrl = `${baseUrl.replace(/\/$/, '')}/order/${order?._id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p><strong>Your order has been successfully delivered.</strong></p>
      <p>Order ID: <strong>${order?._id}</strong></p>
      <p>Total: <strong>₹${Number(order?.totalAmount || 0).toFixed(2)}</strong></p>
      <p>Thank you for shopping with us. We hope you are satisfied with your purchase.</p>
      <p>You can view your order details here: <a href="${orderPageUrl}">View order</a>.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendOrderFailedEmail = async ({ email, name, reason }) => {
  const subject = 'Payment Failed - Innovative Hub';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p>Your payment could not be completed.</p>
      ${reason ? `<p>Reason: ${reason}</p>` : ''}
      <p>No order was created. Please try again.</p>
      <p>— Innovative Hub Team</p>
    </div>
  `;

  await sendEmailWithFallback({ toEmail: email, toName: name, subject, html });
};

export const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const subject = 'Reset your Innovative Hub password';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>Hi ${name || 'Customer'},</p>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in 1 hour. If you did not request this, you can ignore this email.</p>
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

  await sendEmailWithFallback({
    toEmail,
    toName: 'Innovative Hub',
    subject: subject ? `Contact: ${subject}` : 'New Contact Message',
    html,
    attachments,
    replyTo: fromEmail ? { email: fromEmail, name: fromName } : undefined,
  });
};
