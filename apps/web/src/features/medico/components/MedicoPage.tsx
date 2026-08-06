import { Topbar } from '../../../shared/layouts/Topbar';
import { useSessions } from '../api/useSessions';

import { Sidenav } from './Sidenav';

export function MedicoPage() {
  // Andamio provisional del Paso 8 de SPEC 02 — lo reemplaza la tabla real de SPEC 03.
  const { data: sessions, isLoading, isError } = useSessions();

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
        <Sidenav />
        <main className="px-[30px] py-[26px]">
          <h2 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-fg">
            Dashboard de control
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Todas las sesiones atendidas por el asistente de voz
          </p>
          {isLoading && <p className="mt-4 text-[13px] text-muted">Cargando sesiones…</p>}
          {isError && (
            <p className="mt-4 text-[13px] text-danger">No se pudieron cargar las sesiones.</p>
          )}
          {sessions && (
            <ul className="mt-4 text-[13px] text-fg">
              {sessions.map((session) => (
                <li key={session.id}>{session.code}</li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </>
  );
}
