import { useEffect, useRef, useState } from 'react';

interface KbVersionChipProps {
  version: number;
}

const PULSE_DURATION_MS = 700;

export function KbVersionChip({ version }: KbVersionChipProps) {
  const previousVersion = useRef(version);
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (version === previousVersion.current) return;
    previousVersion.current = version;
    setIsPulsing(true);
    const timeout = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [version]);

  return (
    <span
      className={
        isPulsing
          ? 'rounded-full border border-border-mid px-[10px] py-[4px] font-mono text-[11px] text-fg [animation:kb-version-pulse_700ms_ease-out]'
          : 'rounded-full border border-border-mid bg-surface-2 px-[10px] py-[4px] font-mono text-[11px] text-fg'
      }
    >
      KB v{version}
    </span>
  );
}
