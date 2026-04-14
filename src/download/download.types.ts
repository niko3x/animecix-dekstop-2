export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';

export interface ChunkState {
  downloadId: string;
  chunkIndex: number;
  byteStart: number;
  byteEnd: number;
  bytesDownloaded: number;
  tempPath: string;
  completed: boolean;
}

export interface DownloadQueueItem {
  id: string;
  episodeId: string;
  title: string;
  url: string;
  subUrls: { language: string; url: string }[];
  outputPath: string;
  totalBytes: number;
  status: DownloadStatus;
  createdAt: number;
  updatedAt: number;
  chunks: ChunkState[];
}

export interface DownloadProgress {
  id: string;
  episodeId: string;
  title: string;
  status: DownloadStatus;
  progressPercent: number;
  speedBps: number;
  totalBytes: number;
  downloadedBytes: number;
}
