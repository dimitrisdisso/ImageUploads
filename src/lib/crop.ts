export type CropPixels = { x: number; y: number; width: number; height: number };
export async function cropFile(file: File, pixels: CropPixels): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1200 / pixels.width);
  canvas.width = Math.round(pixels.width * scale);
  canvas.height = Math.round(pixels.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('Δεν είναι διαθέσιμη η περικοπή.'); }
  ctx.drawImage(bitmap, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Η περικοπή απέτυχε.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-crop.jpg`, { type: 'image/jpeg' });
}