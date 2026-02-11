import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
	{
		type: { type: String },
		title: { type: String, required: true },
		message: { type: String, required: true },
		entityType: { type: String },
		entityId: { type: mongoose.Schema.Types.ObjectId },
		read: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
