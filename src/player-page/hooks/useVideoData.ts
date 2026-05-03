import { useState, useCallback, useRef, useEffect } from 'react';
import type { Video, SkipMeta } from '../types';

export function useVideoData(initialId: string, initialVid?: string) {
  const [data, setData] = useState<Video | null>(null);
  const [meta, setMeta] = useState<SkipMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const cancelRef = useRef<(() => void) | undefined>(undefined);
  // Track whether we received pre-fetched data from the parent (desktop app fast path)
  const prefetchedRef = useRef(false);

  const fetchVideo = useCallback(async (id: string, vid?: string) => {
    if (!id) return;

    // Cancel previous fetch
    cancelRef.current?.();
    let cancelled = false;
    cancelRef.current = () => {
      cancelled = true;
    };

    setMeta(null);

    try {
      const url =
        'https://tau-video.xyz/api/video/' + id + (vid ? '?vid=' + vid : '');
      const res = await fetch(url);
      const videoData: Video = await res.json();

      if (cancelled) return;
      setData(videoData);

      // Fetch skip markers
      const slug =
        videoData.title_id +
        '_' +
        videoData.season_number +
        '_' +
        videoData.episode_number +
        '_' +
        videoData.translator;

      try {
        const metaRes = await fetch(
          'https://tau-video.xyz/api/most-sought/' +
            slug +
            '?tauId=' +
            videoData._id
        );
        const metaData = await metaRes.json();
        if (!cancelled) setMeta(metaData);
      } catch {
        // Skip markers not available
      }
    } catch (err) {
      console.error('Failed to fetch video data:', err);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }, []);

  // Accept pre-fetched data from parent (desktop app fast path).
  // Called by useParentMessages when it receives 'initVideoData' postMessage.
  // Cancels any in-flight fetch and uses the pre-fetched data directly.
  const setPrefetchedData = useCallback((video: Video, skipMeta: SkipMeta | null) => {
    cancelRef.current?.();
    prefetchedRef.current = true;
    setData(video);
    setMeta(skipMeta);
    setLoading(false);
  }, []);

  // Initial fetch — starts immediately but setPrefetchedData cancels it if
  // pre-fetched data arrives via postMessage before the API responds
  useEffect(() => {
    if (initialId === 'offline') {
      (window as any).animecix?.getOfflineVideoData?.().then((data: any) => {
        if (data?.video) {
          setPrefetchedData(data.video, data.skipMeta ?? null);
        }
      }).catch(() => {});
      return;
    }
    if (!prefetchedRef.current) {
      fetchVideo(initialId, initialVid);
    }
    return () => {
      cancelRef.current?.();
    };
  }, [initialId, initialVid, fetchVideo, setPrefetchedData]);

  return { data, meta, loading, fetchVideo, setPrefetchedData };
}
