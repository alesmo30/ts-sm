import { ArrowLeftRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '../components/ThemeToggle';

interface TopbarProps {
  markLabel: 'Dr' | 'Pa';
  title: string;
  subtitle: string;
  switchLabel: string;
  switchTo: string;
  leftExtra?: ReactNode;
  /** Acción adicional pegada al botón de cambiar de vista, ej. "Terminar conversación". */
  secondaryExtra?: ReactNode;
  onInterceptSwitch?: () => void;
}

export function Topbar({
  markLabel,
  title,
  subtitle,
  switchLabel,
  switchTo,
  leftExtra,
  secondaryExtra,
  onInterceptSwitch,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent-soft p-[6px]"
          aria-label={markLabel === 'Dr' ? 'Vista médico' : 'Vista paciente'}
        >
          <img src="/brand/source-meridian-mark.png" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[17px] font-semibold leading-tight text-fg sm:text-[18px]">
            {title}
          </h1>
          <p className="truncate text-[12.5px] text-muted sm:text-[13px]">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {leftExtra}
        {secondaryExtra}
        <Link
          to={switchTo}
          aria-label={switchLabel}
          onClick={(event) => {
            if (!onInterceptSwitch) return;
            event.preventDefault();
            onInterceptSwitch();
          }}
          className="flex items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[14px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          <ArrowLeftRight size={14} strokeWidth={1.7} />
          <span className="hidden sm:inline">{switchLabel}</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
