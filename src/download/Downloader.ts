import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { pipeline } from 'node:stream/promises';
import type { ChunkState } from './download.types';
import type { StorageService } from '../storage/StorageService';

const MAX_DOWNLOAD_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const PROGRESS_PERSIST_INTERVAL = 1024 * 1024; // 1 MB

export class Downloader extends EventEmitter {
  private url: string;
  private outputPath: string;
  private chunks: ChunkState[];
  private storage: StorageService;
  private activeRequests: http.ClientRequest[] = [];
  private isPaused = false;
  private speedSamples: { time: number; bytes: number }[] = [];

  constructor(
    url: string,
    outputPath: string,
    chunks: ChunkState[],
    storage: StorageService,
  ) {
    super();
    this.url = url;
    this.outputPath = outputPath;
    this.chunks = chunks;
    this.storage = storage;
  }

  static splitIntoChunks(
    totalBytes: number,
    threadCount = 4,
  ): { start: number; end: number }[] {
    if (totalBytes <= 0 || threadCount <= 0) return [];
    const chunkSize = Math.floor(totalBytes / threadCount);
    const chunks: { start: number; end: number }[] = [];
    for (let i = 0; i < threadCount; i++) {
      const start = i * chunkSize;
      const end = i === threadCount - 1 ? totalBytes - 1 : (i + 1) * chunkSize - 1;
      chunks.push({ start, end });
    }
    return chunks;
  }

  static validateUrl(url: string): void {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(
        `Invalid URL scheme: ${parsed.protocol} — only https: and http: are allowed`,
      );
    }
  }

  start(): void {
    this.isPaused = false;
    this.activeRequests = [];

    try {
      Downloader.validateUrl(this.url);
    } catch (err) {
      this.emit('error', err);
      return;
    }

    const incompleteChunks = this.chunks.filter((c) => !c.completed);
    if (incompleteChunks.length === 0) {
      this.mergeChunks()
        .then(() => this.emit('complete'))
        .catch((err) => this.emit('error', err));
      return;
    }

    let completedCount = this.chunks.filter((c) => c.completed).length;
    const totalChunks = this.chunks.length;

    for (const chunk of incompleteChunks) {
      this.downloadChunk(chunk)
        .then(() => {
          completedCount++;
          if (completedCount === totalChunks) {
            this.mergeChunks()
              .then(() => this.emit('complete'))
              .catch((err) => this.emit('error', err));
          }
        })
        .catch((err) => {
          if (!this.isPaused) {
            this.emit('error', err);
          }
        });
    }
  }

  pause(): void {
    this.isPaused = true;
    for (const req of this.activeRequests) {
      req.destroy();
    }
    this.activeRequests = [];
    this.emit('paused');
  }

  resume(): void {
    this.start();
  }

  private downloadChunk(chunk: ChunkState): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isPaused) {
        reject(new Error('Download paused'));
        return;
      }

      const rangeStart = chunk.byteStart + chunk.bytesDownloaded;
      const rangeEnd = chunk.byteEnd;

      if (rangeStart > rangeEnd) {
        chunk.completed = true;
        this.storage.updateChunkProgress(
          chunk.downloadId,
          chunk.chunkIndex,
          chunk.bytesDownloaded,
          true,
        );
        resolve();
        return;
      }

      const parsed = new URL(this.url);
      const httpModule = parsed.protocol === 'https:' ? https : http;

      const req = httpModule.get(
        this.url,
        {
          headers: {
            Range: `bytes=${rangeStart}-${rangeEnd}`,
          },
        },
        (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            // Follow redirect
            req.destroy();
            const redirectChunk = { ...chunk };
            const oldUrl = this.url;
            this.url = res.headers.location;
            this.downloadChunk(redirectChunk).then(resolve).catch(reject);
            this.url = oldUrl;
            return;
          }

          if (res.statusCode !== 206 && res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for chunk ${chunk.chunkIndex}`));
            return;
          }

          const writer = fs.createWriteStream(chunk.tempPath, { flags: 'a' });
          let bytesSinceLastPersist = 0;

          res.on('data', (data: Buffer) => {
            if (this.isPaused) {
              req.destroy();
              writer.end();
              return;
            }

            chunk.bytesDownloaded += data.length;
            bytesSinceLastPersist += data.length;

            // Track speed
            this.speedSamples.push({ time: Date.now(), bytes: data.length });
            const cutoff = Date.now() - 3000;
            this.speedSamples = this.speedSamples.filter((s) => s.time > cutoff);

            // Persist progress every ~1 MB
            if (bytesSinceLastPersist >= PROGRESS_PERSIST_INTERVAL) {
              this.storage.updateChunkProgress(
                chunk.downloadId,
                chunk.chunkIndex,
                chunk.bytesDownloaded,
                false,
              );
              bytesSinceLastPersist = 0;
            }

            // Emit progress
            const totalDownloaded = this.chunks.reduce(
              (sum, c) => sum + c.bytesDownloaded,
              0,
            );
            const totalBytes = this.chunks.reduce(
              (sum, c) => sum + (c.byteEnd - c.byteStart + 1),
              0,
            );
            const speedBps = this.calculateSpeed();

            this.emit('progress', {
              downloadedBytes: totalDownloaded,
              totalBytes,
              speedBps,
            });
          });

          res.on('end', () => {
            writer.end(() => {
              chunk.completed = true;
              this.storage.updateChunkProgress(
                chunk.downloadId,
                chunk.chunkIndex,
                chunk.bytesDownloaded,
                true,
              );
              resolve();
            });
          });

          res.on('error', (err) => {
            writer.end();
            reject(err);
          });

          res.pipe(writer, { end: false });
        },
      );

      req.on('error', (err) => {
        if (!this.isPaused) {
          reject(err);
        }
      });

      this.activeRequests.push(req);
    });
  }

  private calculateSpeed(): number {
    if (this.speedSamples.length === 0) return 0;
    const cutoff = Date.now() - 3000;
    const recent = this.speedSamples.filter((s) => s.time > cutoff);
    if (recent.length === 0) return 0;
    const totalBytes = recent.reduce((sum, s) => sum + s.bytes, 0);
    const elapsed = (Date.now() - recent[0].time) / 1000;
    return elapsed > 0 ? totalBytes / elapsed : 0;
  }

  async mergeChunks(): Promise<void> {
    const sorted = [...this.chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const output = fs.createWriteStream(this.outputPath);

    for (const chunk of sorted) {
      if (!fs.existsSync(chunk.tempPath)) continue;
      const input = fs.createReadStream(chunk.tempPath);
      await pipeline(input, output, { end: false });
      fs.unlinkSync(chunk.tempPath);
    }

    output.end();
    await new Promise<void>((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }
}
