import { useState } from 'react';

import { BottomPanel } from '../../../shared/components/BottomPanel';
import { Topbar } from '../../../shared/layouts/Topbar';
import type { MedicoView, Selection } from '../types';

import { DashboardView } from './DashboardView';
import { SessionPreview } from './SessionPreview';
import { Sidenav } from './Sidenav';

const PANE_HEAD: Record<MedicoView, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard de control',
    subtitle: 'Todas las sesiones atendidas por el asistente de voz',
  },
  priority: {
    title: 'Pacientes con atención personalizada',
    subtitle: 'Solicitada por el paciente o detectada por el asistente de voz',
  },
  references: {
    title: 'Referencias',
    subtitle: 'Documentos e indicaciones que alimentan el RAG del asistente',
  },
};

export function MedicoPage() {
  const [view, setView] = useState<MedicoView>('dashboard');
  const [selected, setSelected] = useState<Selection>(null);

  function handleViewChange(nextView: MedicoView) {
    setView(nextView);
    setSelected(null);
  }

  function handleSelectSession(id: string) {
    setSelected({ kind: 'session', id });
  }

  const { title, subtitle } = PANE_HEAD[view];

  return (
    <>
      <Topbar
        markLabel="Dr"
        title="Hola Doc"
        subtitle="Panel de sesiones del asistente de voz"
        switchLabel="Cambiar a paciente"
        switchTo="/paciente"
      />
      <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
        <Sidenav view={view} onViewChange={handleViewChange} />
        <main className="px-[30px] py-[26px]">
          <h2 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
          {view === 'dashboard' && (
            <DashboardView
              selectedId={selected?.kind === 'session' ? selected.id : undefined}
              onSelect={handleSelectSession}
            />
          )}
        </main>
      </div>
      <BottomPanel>
        {selected?.kind === 'session' ? <SessionPreview id={selected.id} /> : undefined}
      </BottomPanel>
    </>
  );
}
