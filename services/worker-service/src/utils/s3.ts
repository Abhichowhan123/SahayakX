import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer  from 'multer';
import path    from 'path';
import crypto  from 'crypto';

const s3 = new S3Client({
  region:      process.env.AWS_REGION      || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY    || '',
    secretAccessKey: process.env.AWS_SECRET_KEY    || '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'serveease-docs';

export const uploadToS3 = async (
  buffer:   Buffer,
  mimetype: string,
  folder:   string,
): Promise<string> => {
  const ext      = mimetype.split('/')[1];
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         filename,
    Body:        buffer,
    ContentType: mimetype,
    ACL:         'private' as any,
  }));

  return `https://${BUCKET}.s3.amazonaws.com/${filename}`;
};

// Multer in-memory storage (for processing before S3 upload)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only jpg, jpeg, png, pdf files allowed'));
  },
});
