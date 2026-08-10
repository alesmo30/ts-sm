import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';

import { Topbar } from '../../../shared/layouts/Topbar';
import { usePriorityPatients } from '../api/usePriorityPatients';
import { useStatsCounts } from '../api/useStatsCounts';
import type { MedicoView, Selection } from '../types';

import { DashboardView } from './DashboardView';
import { KnowledgeView } from './KnowledgeView';
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
    title: 'Atención prioritaria',
    subtitle: 'Solicitada por el paciente o detectada por el asistente de voz',
  },
  references: {
    title: 'Referencias',
    subtitle: 'Documentos e indicaciones que alimentan el RAG del asistente',
  },
  knowledge: {
    title: 'Agregar conocimiento',
    subtitle: 'Sube documentos o texto para que el asistente los use de inmediato',
  },
};

export function MedicoPage() {
  const [view, setView] = useState<MedicoView>('priority');
  const [selected, setSelected] = useState<Selection>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  // Abierto por defecto — colapsar es una preferencia del médico dentro de su
  // sesión, no persiste entre recargas.
  const [isSidenavCollapsed, setIsSidenavCollapsed] = useState(false);

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
        logoExtra={
          <button
            type="button"
            aria-label={isSidenavCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-pressed={isSidenavCollapsed}
            onClick={() => setIsSidenavCollapsed((prev) => !prev)}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-border-mid bg-surface-2 text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            {isSidenavCollapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.7} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.7} />
            )}
          </button>
        }
      />
      <div
        className={
          isSidenavCollapsed
            ? 'grid h-[calc(100vh-72px)] grid-cols-1 min-[920px]:grid-cols-[72px_minmax(0,1fr)]'
            : 'grid h-[calc(100vh-72px)] grid-cols-1 min-[920px]:grid-cols-[minmax(240px,1fr)_minmax(0,3fr)]'
        }
      >
        <Sidenav view={view} onViewChange={handleViewChange} counts={counts} isCollapsed={isSidenavCollapsed} />
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
          {view === 'knowledge' && <KnowledgeView />}
        </main>
      </div>
    </>
  );
}
