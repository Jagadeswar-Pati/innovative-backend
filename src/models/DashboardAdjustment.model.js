import mongoose from 'mongoose';

/**
 * Singleton document for manual adjustments to dashboard stats.
 * Admin can add/remove numbers (e.g. manual sales) — these are added to the real stats.
 */
const dashboardAdjustmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, default: 'default' },
    manualOrders: { type: Number, default: 0 },
    manualRevenue: { type: Number, default: 0 },
    manualProfit: { type: Number, default: 0 },
    manualCompletedOrders: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const DashboardAdjustment = mongoose.model('DashboardAdjustment', dashboardAdjustmentSchema);

export default DashboardAdjustment;
