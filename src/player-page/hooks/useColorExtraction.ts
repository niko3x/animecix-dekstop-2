import { useEffect, useRef } from 'react';
import { postToParent } from './useParentMessages';

/**
 * Simple dominant color extraction from canvas pixel data.
 * Samples pixels and finds the most common color clusters.
 * Returns an array of [r, g, b] arrays (palette).
 */
function extractPalette(ctx: CanvasRenderingContext2D, width: number, height: number, count: number): number[][] {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const step = Math.max(1, Math.floor(pixels.length / 4 / 1000)); // sample ~1000 pixels

  // Quantize colors into buckets (5-bit per channel = 32 levels)
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < pixels.length; i += 4 * step) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Skip very dark or very bright pixels
    if (r + g + b < 30 || r + g + b > 720) continue;

    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  // Sort by frequency and return top N
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, count);

  return sorted.map((b) => [
    Math.round(b.r / b.count),
    Math.round(b.g / b.count),
    Math.round(b.b / b.count),
  ]);
}

export function useColorExtraction() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    // deviceMemory is undefined in Electron — skip the check in desktop app
    if (deviceMemory !== undefined && deviceMemory <= 4) {
      return;
    }

    const interval = setInterval(() => {
      try {
        const video = document.querySelector('video') as HTMLVideoElement;
        const canvas = canvasRef.current;
        if (!canvas || !video || video.readyState < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, 500, 500);
        const palette = extractPalette(ctx, 500, 500, 10);
        if (palette.length > 0) {
          postToParent('dominantColor', { data: palette });
        }
      } catch {
        // Canvas draw failed — silently skip this tick
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return canvasRef;
}
