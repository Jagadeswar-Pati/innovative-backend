import dotenv from 'dotenv';
import cloudinary from 'cloudinary';

dotenv.config();

const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (cloudinaryUrl) {
  const parsed = new URL(cloudinaryUrl);
  cloudinary.v2.config({
    secure: true,
    cloud_name: parsed.hostname,
    api_key: parsed.username,
    api_secret: parsed.password,
  });
} else {
  cloudinary.v2.config({
    secure: true,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export default cloudinary.v2;
