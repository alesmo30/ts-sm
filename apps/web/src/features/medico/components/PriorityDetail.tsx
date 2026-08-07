import type { PriorityPatient } from '@ts-sm/shared';
import { ArrowLeft } from 'lucide-react';

import { formatDuration } from '../../../shared/lib/format';

interface PriorityDetailProps {
  patient: PriorityPatient;
  onBack: () => void;
}

export function PriorityDetail({ patient, onBack }: PriorityDetailProps) {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={14} strokeWidth={1.7} />
        Volver a pacientes con atención personalizada
      </button>

      <div className="mt-4 grid grid-cols-1 gap-5 min-[1180px]:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium text-muted">Resumen del LLM</p>
          <p className="mt-1 text-[13.5px] text-fg">{patient.llmSummary}</p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-[12px] text-muted">Resultado</dt>
            <dd className="text-[13.5px] text-fg">{patient.outcome}</dd>
            <dt className="text-[12px] text-muted">Duración</dt>
            <dd className="font-mono text-[13.5px] tabular-nums text-fg">
              {formatDuration(patient.durationSeconds)}
            </dd>
            <dt className="text-[12px] text-muted">Nombre</dt>
            <dd className="text-[13.5px] text-fg">{patient.patientName}</dd>
            <dt className="text-[12px] text-muted">Procedimiento</dt>
            <dd className="text-[13.5px] text-fg">{patient.procedure}</dd>
          </dl>
        </div>

        <div className="rounded-[10px] border border-border-mid bg-surface p-4">
          <p className="text-[12.5px] font-medium text-muted">Resumen del caso</p>
          <p className="mt-2 text-[13.5px] text-fg">{patient.caseNotes}</p>
        </div>
      </div>
    </div>
  );
}
