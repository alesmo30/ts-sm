import { useEffect, useState } from 'react';

interface EscalationCountdownModalProps {
  countdownSeconds: number;
  onExpire: () => void;
  onCancel: () => void;
}

export function EscalationCountdownModal({ countdownSeconds, onExpire, onCancel }: EscalationCountdownModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire();
      return;
    }
    const timeout = setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(10,11,12,.65)] backdrop-blur-[4px]"
      role="alertdialog"
      aria-modal="true"
      aria-label="Escalando a un médico"
    >
      <div className="w-full max-w-[420px] rounded-[16px] bg-surface p-6 text-center shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        <p className="font-mono text-[42px] font-semibold tabular-nums text-accent">{secondsLeft}</p>
        <p className="mt-2 text-[14.5px] leading-[1.5] text-fg">
          Terminando sesión. Tu caso será consultado con un médico. Mantente pendiente de tu correo y de
          tu teléfono.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-full border border-border-mid bg-surface-2 px-[18px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
