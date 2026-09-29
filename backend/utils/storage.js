/**
 * Image storage. Uses S3 when S3_UPLOADS_BUCKET is set (EC2 IAM role or env
 * credentials); otherwise writes to backend/uploads for local development.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const LOCAL_URL_PREFIX = '/uploads';

let s3Client = null;

function s3Config() {
  const bucket = process.env.S3_UPLOADS_BUCKET;
  if (!bucket) return null;
  const region = process.env.S3_UPLOADS_REGION || process.env.AWS_REGION || 'ap-south-2';
  const publicBase = (process.env.S3_UPLOADS_PUBLIC_URL || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/+$/, '');
  return { bucket, region, publicBase };
}

function getS3Client(region) {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({ region });
  }
  return s3Client;
}

function isLocalStorage() {
  return !s3Config();
}

async function saveImage({ buffer, mimeType, extension }, folder) {
  const key = `${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  const config = s3Config();

  if (config) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await getS3Client(config.region).send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable'
    }));
    return { key, url: `${config.publicBase}/${key}` };
  }

  const filePath = path.join(LOCAL_UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return { key, url: `${LOCAL_URL_PREFIX}/${key}` };
}

async function deleteImage(key) {
  if (!key) return;
  const config = s3Config();
  try {
    if (config) {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await getS3Client(config.region).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
      return;
    }
    const filePath = path.resolve(LOCAL_UPLOAD_DIR, key);
    if (!filePath.startsWith(LOCAL_UPLOAD_DIR)) return;
    await fs.unlink(filePath);
  } catch (err) {
    console.warn('Image delete skipped:', err.message);
  }
}

module.exports = { LOCAL_UPLOAD_DIR, LOCAL_URL_PREFIX, isLocalStorage, saveImage, deleteImage };
