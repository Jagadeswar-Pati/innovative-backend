import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

// Configure multer for memory storage (no local files)
const storage = multer.memoryStorage();

// Images only (existing behaviour)
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Videos only (for product videos)
const videoFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed'), false);
  }
};

const uploadVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB for videos
  }
});

export { uploadVideo };

// Cloudinary upload helper function
export const uploadToCloudinary = async (fileBuffer, folder = 'innovative-hub', resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: resourceType
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export const uploadBufferToCloudinary = async ({
  buffer,
  folder,
  filename,
  resourceType = 'auto',
}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType, public_id: filename },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

/** PDF only — Cloudinary raw */
const offlinePdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Only PDF files are allowed'), false);
};

/** Word .doc / .docx — Cloudinary raw */
const offlineDocFilter = (req, file, cb) => {
  const ok =
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ok) cb(null, true);
  else cb(new Error('Only Word documents (.doc, .docx) are allowed'), false);
};

export const uploadOfflinePdf = multer({
  storage,
  fileFilter: offlinePdfFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const uploadOfflineDoc = multer({
  storage,
  fileFilter: offlineDocFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export default upload;
