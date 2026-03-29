import mongoose from 'mongoose';

const NotificationLogSchema = new mongoose.Schema({
  type: String,
  title: String,
  message: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

export default mongoose.model('NotificationLog', NotificationLogSchema);
