import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Admin from "../models/Admin.model.js";

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not set in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB for seeding admin");

  const email = process.env.SEED_ADMIN_EMAIL || "admin@innovativehub.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log("Admin already exists:", existing.email);
    process.exit(0);
  }

  const admin = new Admin({ email, password });
  await admin.save();
  console.log("Seeded admin:", admin.email);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
