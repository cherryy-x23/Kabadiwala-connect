import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const mime = file.mimetype.toLowerCase();
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

  const mimeMatch = ALLOWED_MIME_TYPES.includes(mime);
  const extMatch = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeMatch && extMatch) {
    cb(null, true);
  } else {
    const err: any = new Error('Only JPG, PNG and WEBP images up to 5MB are allowed.');
    err.statusCode = 400;
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter,
});

export const uploadOptionalPhoto = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const singleUpload = upload.single('photo');

  singleUpload(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'Image must be smaller than 5MB.',
        });
        return;
      }
      if (err.code === 'INVALID_FILE_TYPE' || err.statusCode === 400) {
        res.status(400).json({
          success: false,
          message: err.message || 'Only JPG, PNG and WEBP images up to 5MB are allowed.',
        });
        return;
      }
      if (err.name === 'MulterError') {
        res.status(400).json({
          success: false,
          message: err.message,
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: err.message || 'Invalid photo upload.',
      });
      return;
    }
    next();
  });
};
