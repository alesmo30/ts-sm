import type { ReactNode } from 'react';

import { Tooltip } from '../../../shared/components/Tooltip';

const RATES = [0.75, 1, 1.25, 1.5] as const;

const DISABLED_TOOLTIP = 'El asistente está hablando. La velocidad se puede cambiar antes de tu próximo mensaje.';

interface SpeedControlProps {
  rate: number;
  onChange: (rate: number) => void;
  /** true mientras el asistente responde: la velocidad ya elegida queda fija hasta el próximo turno. */
  disabled: boolean;
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label="Velocidad de voz"
      className="flex items-center gap-1 rounded-full border border-border-mid bg-surface-2 p-1"
    >
      {children}
    </div>
  );
}

export function SpeedControl({ rate, onChange, disabled }: SpeedControlProps) {
  const buttons = RATES.map((value) => (
    <button
      key={value}
      type="button"
      disabled={disabled}
      aria-pressed={rate === value}
      onClick={() => onChange(value)}
      className={`rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
        rate === value ? 'bg-accent text-on-accent' : 'text-muted hover:text-fg'
      }`}
    >
      {value}x
    </button>
  ));

  if (!disabled) {
    return <Group>{buttons}</Group>;
  }

  return (
    <Tooltip label={DISABLED_TOOLTIP}>
      <Group>{buttons}</Group>
    </Tooltip>
  );
}
