const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export const IMAGE_ACCEPT = ACCEPTED_TYPES.join(',');

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image.'));
    };
    img.src = url;
  });
}

// Downscales in the browser so uploads stay small (well under the 5 MB API limit).
export async function fileToResizedDataUrl(file, { maxSize = 1280, quality = 0.85 } = {}) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPG, PNG or WEBP image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Image is too large. Please choose one under 15 MB.');
  }

  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
