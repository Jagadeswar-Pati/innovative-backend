import mongoose from 'mongoose';

const reviewSettingsSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['any-user', 'delivered-only'], default: 'delivered-only' },
  },
  { timestamps: true }
);

const ReviewSettings = mongoose.model('ReviewSettings', reviewSettingsSchema);

export default ReviewSettings;
