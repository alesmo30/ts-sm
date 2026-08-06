import { FileText } from 'lucide-react';

import { Topbar } from '../../../shared/layouts/Topbar';

import { PreSesion } from './PreSesion';

export function PacientePage() {
  return (
    <>
      <Topbar
        markLabel="Pa"
        title="Hola Paciente"
        subtitle="Asistente de voz — MeridianAsiste"
        switchLabel="Cambiar a Dr"
        switchTo="/medico"
        leftExtra={
          <button
            type="button"
            aria-label="Actualizar conocimiento"
            className="flex items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[14px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            <FileText size={14} strokeWidth={1.7} />
            <span className="hidden sm:inline">Actualizar conocimiento</span>
          </button>
        }
      />
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-5">
        <div className="w-full max-w-[720px]">
          <PreSesion />
        </div>
      </main>
    </>
  );
}
