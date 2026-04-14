export interface Video {
  _id: string;
  durationDifference?: number;
  duration: number;
  title_id: string;
  season_number: string;
  episode_number: string;
  ratio?: number;
  hls?: string;
  urls: { label: string; url: string; size: number }[];
  subs: { id: number; language: string; url: string; name: string }[];
  translator: string;
}

export interface SkipMeta {
  [key: string]: { from: number; to: number };
}

// Dual source interface for Phase 3 offline readiness (per D-06)
export interface PlayerSource {
  type: 'hls' | 'mp4' | 'local';
  url: string;
  qualities?: { label: string; url: string; height: number; width: number; size: number }[];
}
