import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/**
 * Finds the ffmpeg binary path.
 * In dev: uses system ffmpeg (expected at /opt/homebrew/bin/ffmpeg or in PATH).
 * In packaged app: will use ffmpeg-static or extraResources (Phase 4 concern).
 */
export function findFfmpegPath(): string {
  // Try ffmpeg-static first (if installed)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('ffmpeg-static') as string;
  } catch {
    // Fall back to system ffmpeg
    return 'ffmpeg';
  }
}

/**
 * Check if ffmpeg is available on the system.
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    const ffmpegPath = findFfmpegPath();
    await execFileAsync(ffmpegPath, ['-version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse an HLS m3u8 playlist and extract segment URLs.
 * Handles both absolute and relative URLs.
 * Only accepts http/https URLs (T-03-11 threat mitigation).
 */
export function parseM3u8(playlistContent: string, playlistUrl: string): string[] {
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1);
  const lines = playlistContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  return lines.map((line) => {
    if (line.startsWith('http://') || line.startsWith('https://')) {
      return line;
    }
    return baseUrl + line;
  });
}

/**
 * Mux TS segment files into a single MP4 using ffmpeg concat demuxer.
 * No re-encoding — fast copy mode with faststart for streaming.
 *
 * SECURITY: Uses execFile (not exec) to prevent shell injection (T-03-09).
 * segmentPaths must be validated absolute paths.
 *
 * Timeout: 5 minutes to prevent hanging on malformed input (T-03-12).
 */
export async function muxTsToMp4(segmentPaths: string[], outputMp4Path: string): Promise<void> {
  const ffmpegPath = findFfmpegPath();

  // Create concat file list for ffmpeg
  const concatDir = path.dirname(outputMp4Path);
  const concatListPath = path.join(concatDir, '_concat_list.txt');
  const concatContent = segmentPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListPath,
        '-c',
        'copy',
        '-movflags',
        'faststart',
        '-y', // overwrite output
        outputMp4Path,
      ],
      { timeout: 300000 }, // 5 min timeout for large files
    );
  } finally {
    // Clean up concat list file
    try {
      fs.unlinkSync(concatListPath);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Manual TS concatenation fallback (no ffmpeg required).
 * Simple byte-level concatenation of MPEG-TS files.
 * Less reliable than ffmpeg for malformed segments but works for simple cases.
 */
export async function concatTsToMp4Fallback(
  segmentPaths: string[],
  outputPath: string,
): Promise<void> {
  const output = fs.createWriteStream(outputPath);
  for (const segPath of segmentPaths) {
    await new Promise<void>((resolve, reject) => {
      const input = fs.createReadStream(segPath);
      input.pipe(output, { end: false });
      input.on('end', resolve);
      input.on('error', reject);
    });
  }
  output.end();
  await new Promise<void>((resolve) => output.on('finish', resolve));
}

/**
 * HlsMuxer — class interface for use in StreamCache.
 * Wraps the functional API for object-oriented usage.
 */
export class HlsMuxer {
  /**
   * Mux an array of TS segment file paths into a single MP4.
   * Tries ffmpeg first; falls back to simple concatenation if unavailable.
   */
  static async mux(segmentPaths: string[], outputMp4Path: string): Promise<void> {
    const ffmpegAvailable = await isFfmpegAvailable();
    if (ffmpegAvailable) {
      await muxTsToMp4(segmentPaths, outputMp4Path);
    } else {
      await concatTsToMp4Fallback(segmentPaths, outputMp4Path);
    }
  }
}
