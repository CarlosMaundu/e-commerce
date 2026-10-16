// src/lib/uploads.ts — single image uploads: checked, resized and stored.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

// Object storage (S3, Cloudflare R2, MinIO…) when S3_BUCKET is set; else the
// uploads folder on this server.
const s3 = process.env.S3_BUCKET
  ? new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: process.env.S3_ACCESS_KEY_ID
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' }
        : undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    })
  : null;

/**
 * Makes an uploaded image ready to serve, and returns its URL: turned upright,
 * no wider or taller than `maxSize` pixels, metadata (camera, GPS location)
 * removed and re-compressed; then stored (object storage or the uploads
 * folder). GIFs are kept as they are, so animations still play.
 */
export const storeUpload = async (file: Express.Multer.File, { maxSize = 1600 } = {}) => {
  const name = path.basename(file.filename);
  if (file.mimetype !== 'image/gif') {
    try {
      const image = sharp(file.path, { failOn: 'error' })
        .rotate()
        .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true });
      const out =
        file.mimetype === 'image/png'
          ? await image.png({ compressionLevel: 9 }).toBuffer()
          : file.mimetype === 'image/webp'
            ? await image.webp({ quality: 82 }).toBuffer()
            : await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      await fs.promises.writeFile(file.path, out);
    } catch {
      await fs.promises.rm(file.path, { force: true });
      throw new HttpError(400, ['That file isn’t an image we can read. Please try another.']);
    }
  }
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: `uploads/${name}`,
        Body: await fs.promises.readFile(file.path),
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    await fs.promises.rm(file.path, { force: true });
    return `${(process.env.S3_PUBLIC_URL || '').replace(/\/$/, '')}/uploads/${name}`;
  }
  return `${config.publicUploadsPath}/${name}`;
};
