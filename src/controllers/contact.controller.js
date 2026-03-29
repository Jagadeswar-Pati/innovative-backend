import { sendContactEmail } from '../utils/mailer.js';

export const submitContactForm = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();

    if (!name || !email || !message) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Contact validation failed. req.body keys:', Object.keys(body));
      }
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.',
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files
      .filter((file) => file && file.buffer)
      .map((file) => ({
        filename: file.originalname || 'attachment',
        content: file.buffer,
        contentType: file.mimetype,
      }));
    const attachmentList = files.map((f) => `${f.originalname || 'file'} (${Math.round((f.size || 0) / 1024)} KB)`);

    const receiver = process.env.CONTACT_RECEIVER_EMAIL || 'supportinnovativehub@gmail.com';

    const sent = await sendContactEmail({
      toEmail: receiver,
      fromName: name,
      fromEmail: email,
      subject: subject || undefined,
      message,
      attachments,
      attachmentList,
    });

    if (!sent) {
      return res.status(503).json({
        success: false,
        message: 'Email service is temporarily unavailable. Please try again later or contact us by phone.',
      });
    }

    res.status(200).json({ success: true, message: 'Contact message sent successfully' });
  } catch (error) {
    console.error('Contact form error:', error?.message || error);
    next(error);
  }
};
