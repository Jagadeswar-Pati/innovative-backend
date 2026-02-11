import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import errorHandler from './middleware/errorHandler.middleware.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import orderRoutes from './routes/order.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import reviewRoutes from './routes/review.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import commentRoutes from './routes/comment.routes.js';
import userRoutes from './routes/user.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import cartRoutes from './routes/cart.routes.js';
import profileRoutes from './routes/profile.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import profitRoutes from './routes/profit.routes.js';
import contactRoutes from './routes/contact.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
// Support multiple origins via comma-separated CORS_ORIGIN env variable
const rawCors = process.env.CORS_ORIGIN || "http://localhost:5173";
const allowedOrigins = rawCors === '*'
  ? ['*']
  : rawCors.split(',').map((s) => s.trim()).filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/.test(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Routes
app.use("/api/user", profileRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/profit", profitRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/delivery", deliveryRoutes);

app.use(errorHandler);

export default app;
