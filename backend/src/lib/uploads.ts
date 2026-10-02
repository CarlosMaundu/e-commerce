// src/lib/uploads.ts — single image uploads into the uploads volume.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';
import { HttpError } from './http';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

fs.mkdirSync(config.uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadsDir,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) =>
    IMAGE_TYPES[file.mimetype]
      ? cb(null, true)
      : cb(new HttpError(400, ['Please upload a JPG, PNG, WebP or GIF image.'])),
});

/** Accepts one image in the `file` field; friendly errors for size and type. */
export const singleImage = (req: Request, res: Response, next: NextFunction) =>
  upload.single('file')(req, res, (error: unknown) => {
    if ((error as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(413, ['That file is too large. Please choose one under 5 MB.']));
    }
    next(error);
  });

export const uploadedUrl = (file: Express.Multer.File) => `${config.publicUploadsPath}/${path.basename(file.filename)}`;
