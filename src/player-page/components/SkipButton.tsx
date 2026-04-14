import { useMediaPlayer, useMediaState } from '@vidstack/react';
import type { SkipMeta } from '../types';

interface SkipButtonProps {
  meta: SkipMeta | null;
}

export function SkipButton({ meta }: SkipButtonProps) {
  const player = useMediaPlayer();
  const currentTime = useMediaState('currentTime');

  if (!meta || !player) return null;

  let targetTime: number | null = null;

  for (const key of Object.keys(meta)) {
    const data = meta[key];
    if (data && currentTime > data.from && currentTime < data.to) {
      targetTime = data.to;
      break;
    }
  }

  if (targetTime === null) return null;

  const skipTo = targetTime;

  return (
    <button
      className="skip"
      onClick={() => {
        player.currentTime = skipTo;
        player.play().catch(() => {});
      }}
    >
      Bu Kısmı Atla
    </button>
  );
}
