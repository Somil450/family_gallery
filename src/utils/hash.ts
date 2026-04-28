// Simple perceptual hash using canvas — good enough for duplicate detection
// in the browser without a native library
export async function computeImageHash(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const SIZE = 16;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
      const grayscale: number[] = [];

      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        grayscale.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }

      const avg = grayscale.reduce((a, b) => a + b, 0) / grayscale.length;
      const bits = grayscale.map((v) => (v >= avg ? '1' : '0')).join('');
      // Convert binary string to hex
      const hex = parseInt(bits, 2).toString(16).padStart(64, '0');

      URL.revokeObjectURL(url);
      resolve(hex);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    img.src = url;
  });
}

export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

export function isDuplicateHash(hash1: string, hash2: string, threshold = 5): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}
