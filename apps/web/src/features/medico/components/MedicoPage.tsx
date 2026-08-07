import { useState } from 'react';

import { Topbar } from '../../../shared/layouts/Topbar';
import { usePriorityPatients } from '../api/usePriorityPatients';
import { useStatsCounts } from '../api/useStatsCounts';
import type { MedicoView, Selection } from '../types';

import { DashboardView } from './DashboardView';
import { PriorityDetail } from './PriorityDetail';
import { PriorityView } from './PriorityView';
import { ReferencesView } from './ReferencesView';
import { SessionDetail } from './SessionDetail';
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
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);

  const { data: priorityPatients } = usePriorityPatients();
  const { data: counts } = useStatsCounts();

  function handleViewChange(nextView: MedicoView) {
    setView(nextView);
    setSelected(null);
    setOpenSessionId(null);
    setOpenPatientId(null);
  }

  function handleSelectSession(id: string) {
    setSelected({ kind: 'session', id });
    setOpenSessionId(id);
  }

  function handleSelectPatient(id: string) {
    setSelected({ kind: 'patient', id });
    setOpenPatientId(id);
  }

  function handleBackToDashboard() {
    setOpenSessionId(null);
  }

  function handleBackToPriority() {
    setOpenPatientId(null);
  }

  const { title, subtitle } = PANE_HEAD[view];
  const openPatient = openPatientId
    ? priorityPatients?.find((patient) => patient.id === openPatientId)
    : undefined;

  return (
    <>
      <Topbar
        markLabel="Dr"
        title="Hola Doc"
        subtitle="Panel de sesiones del asistente de voz"
        switchLabel="Cambiar a paciente"
        switchTo="/paciente"
      />
      <div className="grid h-[calc(100vh-72px)] grid-cols-1 min-[920px]:grid-cols-[minmax(240px,1fr)_minmax(0,3fr)]">
        <Sidenav view={view} onViewChange={handleViewChange} counts={counts} />
        <main className="flex min-h-0 flex-col overflow-y-auto px-[30px] py-[26px]">
          <h2 className="shrink-0 font-display text-[21px] font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          <p className="mt-1 shrink-0 text-[13px] text-muted">{subtitle}</p>
          {view === 'dashboard' &&
            (openSessionId ? (
              <SessionDetail id={openSessionId} onBack={handleBackToDashboard} />
            ) : (
              <DashboardView
                selectedId={selected?.kind === 'session' ? selected.id : undefined}
                onSelect={handleSelectSession}
              />
            ))}
          {view === 'priority' &&
            (openPatient ? (
              <PriorityDetail patient={openPatient} onBack={handleBackToPriority} />
            ) : (
              <PriorityView
                selectedId={selected?.kind === 'patient' ? selected.id : undefined}
                onSelect={handleSelectPatient}
              />
            ))}
          {view === 'references' && <ReferencesView />}
        </main>
      </div>
    </>
  );
}
