import type { PriorityPatient } from '@ts-sm/shared';

import { StatusTag } from '../../../shared/components/StatusTag';

interface PriorityTableProps {
  patients: PriorityPatient[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function PriorityTable({ patients, selectedId, onSelect }: PriorityTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Paciente
              </th>
              <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Procedimiento
              </th>
              <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Solicitado por
              </th>
              <th className="border-b border-border pb-3 pr-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Fecha
              </th>
              <th className="border-b border-border pb-3 font-mono text-[11px] uppercase tracking-[0.05em] text-muted">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr
                key={patient.id}
                onClick={() => onSelect(patient.id)}
                className={
                  patient.id === selectedId
                    ? 'cursor-pointer bg-accent-soft transition-colors duration-[120ms]'
                    : 'cursor-pointer transition-colors duration-[120ms] hover:bg-surface-2'
                }
              >
                <td className="border-b border-border py-3 pr-3 text-[13.5px] text-fg">
                  {patient.patientName}
                </td>
                <td className="border-b border-border py-3 pr-3 text-[13.5px] text-fg">
                  {patient.procedure}
                </td>
                <td className="border-b border-border py-3 pr-3 text-[13.5px] text-fg">
                  {patient.requestedBy}
                </td>
                <td className="border-b border-border py-3 pr-3 text-[13.5px] text-fg">
                  {patient.sessionDate ?? '—'}
                </td>
                <td className="border-b border-border py-3">
                  <StatusTag variant={patient.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {patients.map((patient) => (
          <li key={patient.id}>
            <button
              type="button"
              onClick={() => onSelect(patient.id)}
              className={
                patient.id === selectedId
                  ? 'flex w-full flex-col gap-1 rounded-[10px] border border-border-mid bg-accent-soft px-[14px] py-3 text-left'
                  : 'flex w-full flex-col gap-1 rounded-[10px] border border-border-mid bg-surface px-[14px] py-3 text-left'
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-medium text-fg">{patient.patientName}</span>
                <StatusTag variant={patient.status} />
              </div>
              <span className="text-[12.5px] text-muted">{patient.procedure}</span>
              <span className="text-[12px] text-muted">
                Solicitado por {patient.requestedBy}
                {patient.sessionDate ? ` · ${patient.sessionDate}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
