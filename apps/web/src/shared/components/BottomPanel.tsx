import type { ReactNode } from 'react';

interface BottomPanelProps {
  children?: ReactNode;
}

export function BottomPanel({ children }: BottomPanelProps) {
  return (
    <div className="border-t border-border px-[30px] py-[22px] pb-[30px]">
      <h3 className="font-display text-[17px] font-semibold text-fg">
        Detalle del registro seleccionado
      </h3>
      {children ?? (
        <p className="mt-2 text-[13px] text-muted">
          Selecciona una sesión o un paciente para ver su información aquí.
        </p>
      )}
    </div>
  );
}
