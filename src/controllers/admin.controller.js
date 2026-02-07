import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model.js";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matched = await admin.comparePassword(password);
    if (!matched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ role: admin.role, email: admin.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id.toString(),
        name: admin.email.split('@')[0],
        email: admin.email,
        role: admin.role || 'admin'
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
