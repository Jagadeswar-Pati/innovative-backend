import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model.js";

export default async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findOne({ email: decoded.email }).select('-password');
    if (!admin) return res.status(401).json({ message: "Invalid token" });
    req.admin = {
      id: admin._id.toString(),
      name: admin.email.split('@')[0],
      email: admin.email,
      role: admin.role || 'admin'
    };
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
