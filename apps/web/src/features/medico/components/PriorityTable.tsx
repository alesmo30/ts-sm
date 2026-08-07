import type { PriorityPatient } from '@ts-sm/shared';

import { StatusTag } from '../../../shared/components/StatusTag';

interface PriorityTableProps {
  patients: PriorityPatient[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function PriorityTable({ patients, selectedId, onSelect }: PriorityTableProps) {
  return (
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
            <td className="border-b border-border py-3">
              <StatusTag variant={patient.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
