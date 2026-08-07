import type { ReactNode } from 'react';
import { useState } from 'react';

import { BottomPanel } from '../../../shared/components/BottomPanel';
import { Topbar } from '../../../shared/layouts/Topbar';
import { usePriorityPatients } from '../api/usePriorityPatients';
import type { MedicoView, Selection } from '../types';

import { DashboardView } from './DashboardView';
import { PatientPreview } from './PatientPreview';
import { PriorityDetail } from './PriorityDetail';
import { PriorityView } from './PriorityView';
import { ReferencesView } from './ReferencesView';
import { SessionDetail } from './SessionDetail';
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
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);

  const { data: priorityPatients } = usePriorityPatients();

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
  const selectedPatient =
    selected?.kind === 'patient'
      ? priorityPatients?.find((patient) => patient.id === selected.id)
      : undefined;
  const openPatient = openPatientId
    ? priorityPatients?.find((patient) => patient.id === openPatientId)
    : undefined;

  let bottomPanelContent: ReactNode;
  if (selected?.kind === 'session') {
    bottomPanelContent = <SessionPreview id={selected.id} />;
  } else if (selectedPatient) {
    bottomPanelContent = <PatientPreview patient={selectedPatient} />;
  } else {
    bottomPanelContent = undefined;
  }

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
      <BottomPanel>{bottomPanelContent}</BottomPanel>
    </>
  );
}
