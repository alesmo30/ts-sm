import type { Session } from '@ts-sm/shared';

import { StatusTag } from '../../../shared/components/StatusTag';

interface SessionTableProps {
  sessions: Session[];
}

export function SessionTable({ sessions }: SessionTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr>
          <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            Fecha
          </th>
          <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            Hora
          </th>
          <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            ID sesión
          </th>
          <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            Paciente
          </th>
          <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            Procedimiento
          </th>
          <th className="border-b border-border pb-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
            Estado
          </th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => (
          <tr
            key={session.id}
            className="cursor-pointer transition-colors duration-[120ms] hover:bg-surface-2"
          >
            <td className="border-b border-border py-3 pr-3 font-mono text-[13.5px] tabular-nums text-fg">
              {session.date}
            </td>
            <td className="border-b border-border py-3 pr-3 font-mono text-[13.5px] tabular-nums text-fg">
              {session.time}
            </td>
            <td className="border-b border-border py-3 pr-3 font-mono text-[13.5px] tabular-nums text-fg">
              {session.code}
            </td>
            <td className="border-b border-border py-3 pr-3 text-[13.5px] text-fg">
              {session.patientName}
            </td>
            <td className="border-b border-border py-3 pr-3 text-[13.5px] text-fg">
              {session.procedure}
            </td>
            <td className="border-b border-border py-3">
              <StatusTag variant={session.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
