/**
 * Shrink a photo in the browser before it is sent: at most `max` px on the long side, re-encoded as JPEG.
 * Re-encoding through a canvas also drops the photo's hidden EXIF data (camera, GPS location).
 */
export async function shrinkPhoto(file: File, max = 1280, quality = 0.85): Promise<{ mediaType: 'image/jpeg'; data: string; preview: string }> {
  if (!/^image\//.test(file.type)) throw new Error('That isn’t a photo. Choose a JPEG, PNG or HEIC image.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This photo couldn’t be opened. Try a JPEG or PNG.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL('image/jpeg', quality);
    return { mediaType: 'image/jpeg', data: preview.slice(preview.indexOf(',') + 1), preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}
