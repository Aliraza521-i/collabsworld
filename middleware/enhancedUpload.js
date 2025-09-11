import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    'uploads',
    'uploads/documents',
    'uploads/images', 
    'uploads/images/thumbnails',
    'uploads/content',
    'uploads/verification',
    'uploads/chat',
    'uploads/temp'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
};

createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/temp';
    
    // Determine upload path based on field name
    switch (file.fieldname) {
      case 'content':
      case 'contentFiles':
        uploadPath = 'uploads/content';
        break;
      case 'images':
        uploadPath = 'uploads/images';
        break;
      case 'documents':
      case 'attachments':
      case 'verification_document':
      case 'tax_document':
        uploadPath = 'uploads/documents';
        break;
      case 'files':
        uploadPath = 'uploads/chat';
        break;
      default:
        uploadPath = 'uploads/temp';
    }
    
    const fullPath = path.join(__dirname, '..', uploadPath);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${cleanBaseName}_${uniqueSuffix}${fileExtension}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    content: ['.html', '.txt', '.docx', '.pdf'],
    verification: ['.pdf', '.jpg', '.jpeg', '.png'],
    chat: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif']
  };
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Check file type based on field name
  let isAllowed = false;
  
  switch (file.fieldname) {
    case 'content':
    case 'contentFiles':
      isAllowed = allowedTypes.content.includes(fileExtension);
      break;
    case 'images':
      isAllowed = allowedTypes.images.includes(fileExtension);
      break;
    case 'documents':
    case 'attachments':
      isAllowed = allowedTypes.documents.includes(fileExtension);
      break;
    case 'verification_document':
    case 'tax_document':
      isAllowed = allowedTypes.verification.includes(fileExtension);
      break;
    case 'files':
      isAllowed = allowedTypes.chat.includes(fileExtension);
      break;
    default:
      isAllowed = [...allowedTypes.documents, ...allowedTypes.images].includes(fileExtension);
  }
  
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExtension} not allowed for ${file.fieldname}`), false);
  }
};

// Configure multer
const uploadConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 20 // Maximum 20 files per request
  }
};

export const uploadMiddleware = multer(uploadConfig);

// Image optimization function
export const optimizeImage = async (filePath, options = {}) => {
  try {
    const {
      width = 1200,
      height = null,
      quality = 80,
      format = 'webp'
    } = options;
    
    // Generate optimized image path
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const optimizedPath = path.join(dir, `${name}_optimized.${format}`);
    
    // Process image with sharp
    await sharp(filePath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(format, { quality })
      .toFile(optimizedPath);
    
    return optimizedPath;
  } catch (error) {
    throw new Error(`Image optimization failed: ${error.message}`);
  }
};

// Create thumbnail function
export const createThumbnail = async (filePath, options = {}) => {
  try {
    const {
      width = 200,
      height = 200,
      quality = 70,
      format = 'webp'
    } = options;
    
    // Generate thumbnail path
    const dir = path.join(path.dirname(filePath), 'thumbnails');
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const thumbnailPath = path.join(dir, `${name}_thumb.${format}`);
    
    // Ensure thumbnail directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Process image with sharp
    await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toFormat(format, { quality })
      .toFile(thumbnailPath);
    
    return thumbnailPath;
  } catch (error) {
    throw new Error(`Thumbnail creation failed: ${error.message}`);
  }
};

// Process uploaded files
export const processUploadedFiles = async (files, options = {}) => {
  if (!files) return [];
  
  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
  const processedFiles = [];
  
  for (const file of fileArray) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(fileExtension);
    
    const processedFile = {
      originalname: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/${path.relative(path.join(__dirname, '..'), file.path).replace(/\\/g, '/')}`
    };
    
    // If it's an image, optimize it and create thumbnail
    if (isImage && options.optimizeImages !== false) {
      try {
        // Optimize image
        const optimizedPath = await optimizeImage(file.path, options.optimization);
        processedFile.optimizedPath = optimizedPath;
        processedFile.optimizedUrl = `/uploads/${path.relative(path.join(__dirname, '..'), optimizedPath).replace(/\\/g, '/')}`;
        
        // Create thumbnail
        const thumbnailPath = await createThumbnail(file.path, options.thumbnail);
        processedFile.thumbnailPath = thumbnailPath;
        processedFile.thumbnailUrl = `/uploads/${path.relative(path.join(__dirname, '..'), thumbnailPath).replace(/\\/g, '/')}`;
      } catch (error) {
        console.error('Error processing image:', error);
        // Continue with original file if optimization fails
      }
    }
    
    processedFiles.push(processedFile);
  }
  
  return processedFiles;
};

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          ok: false,
          message: 'File too large. Maximum size is 10MB.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          ok: false,
          message: 'Too many files. Maximum is 20 files per request.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          ok: false,
          message: 'Unexpected file field.'
        });
      default:
        return res.status(400).json({
          ok: false,
          message: 'File upload error: ' + error.message
        });
    }
  }
  
  if (error.message.includes('not allowed')) {
    return res.status(400).json({
      ok: false,
      message: error.message
    });
  }
  
  next(error);
};

// Helper function to clean up uploaded files
export const cleanupUploadedFiles = (files) => {
  if (!files) return;
  
  const fileArray = Array.isArray(files) ? files : Object.values(files).flat();
  
  fileArray.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    // Clean up optimized files and thumbnails
    if (file.optimizedPath && fs.existsSync(file.optimizedPath)) {
      fs.unlinkSync(file.optimizedPath);
    }
    
    if (file.thumbnailPath && fs.existsSync(file.thumbnailPath)) {
      fs.unlinkSync(file.thumbnailPath);
    }
  });
};

// Helper function to get file URL
export const getFileUrl = (filename, type = 'temp') => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  return `${baseUrl}/uploads/${type}/${filename}`;
};

export default {
  uploadMiddleware,
  processUploadedFiles,
  optimizeImage,
  createThumbnail,
  handleUploadError,
  cleanupUploadedFiles,
  getFileUrl
};