import type { Session } from '@ts-sm/shared';

import { StatusTag } from '../../../shared/components/StatusTag';

interface SessionTableProps {
  sessions: Session[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function SessionTable({ sessions, selectedId, onSelect }: SessionTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
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
                onClick={() => onSelect(session.id)}
                className={
                  session.id === selectedId
                    ? 'cursor-pointer bg-accent-soft transition-colors duration-[120ms]'
                    : 'cursor-pointer transition-colors duration-[120ms] hover:bg-surface-2'
                }
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
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => onSelect(session.id)}
              className={
                session.id === selectedId
                  ? 'flex w-full flex-col gap-1 rounded-[10px] border border-border-mid bg-accent-soft px-[14px] py-3 text-left'
                  : 'flex w-full flex-col gap-1 rounded-[10px] border border-border-mid bg-surface px-[14px] py-3 text-left'
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[12px] tabular-nums text-muted">
                  {session.date} · {session.time}
                </span>
                <StatusTag variant={session.status} />
              </div>
              <span className="text-[13.5px] font-medium text-fg">{session.patientName}</span>
              <span className="text-[12.5px] text-muted">{session.procedure}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
