import { sendContactEmail } from '../utils/mailer.js';

export const submitContactForm = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'name, email, and message are required' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const attachments = files.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    }));
    const attachmentList = files.map((file) => `${file.originalname} (${Math.round(file.size / 1024)} KB)`);

    const receiver = process.env.CONTACT_RECEIVER_EMAIL || 'innovativehubofficial@gmail.com';

    await sendContactEmail({
      toEmail: receiver,
      fromName: name,
      fromEmail: email,
      subject,
      message,
      attachments,
      attachmentList,
    });

    res.status(200).json({ success: true, message: 'Contact message sent successfully' });
  } catch (error) {
    next(error);
  }
};
