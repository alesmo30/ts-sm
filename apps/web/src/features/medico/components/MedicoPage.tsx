import { Topbar } from '../../../shared/layouts/Topbar';

import { Sidenav } from './Sidenav';

export function MedicoPage() {
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
        </main>
      </div>
    </>
  );
}
