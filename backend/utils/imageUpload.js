const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

class ImageUploadError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Accepts a "data:image/...;base64,..." string and returns the decoded image.
function parseImageDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!match) throw new ImageUploadError('Please upload a valid image file.');

  const mimeType = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) throw new ImageUploadError('Only JPG, PNG or WEBP images are supported.');

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) throw new ImageUploadError('The uploaded image is empty.');
  if (buffer.length > MAX_IMAGE_BYTES) throw new ImageUploadError('Image must be 5 MB or smaller.');

  return { buffer, mimeType, extension, base64: buffer.toString('base64') };
}

module.exports = { MAX_IMAGE_BYTES, ImageUploadError, parseImageDataUrl };
