import type { IngestJob } from '@ts-sm/shared';
import { CheckCircle2 } from 'lucide-react';

interface IngestJobStatusProps {
  job: IngestJob;
}

const STAGE_PCT: Record<IngestJob['stage'], number> = {
  Recibido: 5,
  'Extrayendo texto': 30,
  Fragmentando: 55,
  'Generando embeddings': 80,
  Indexado: 100,
};

export function IngestJobStatus({ job }: IngestJobStatusProps) {
  if (job.error) {
    return (
      <div className="rounded-[10px] border border-danger/30 bg-danger-soft px-[14px] py-3">
        <p className="truncate text-[13px] font-medium text-fg">{job.fileName}</p>
        <p className="mt-1 text-[12.5px] text-danger">{job.error}</p>
      </div>
    );
  }

  const isDone = job.stage === 'Indexado';
  const pct = STAGE_PCT[job.stage];

  return (
    <div className="rounded-[10px] border border-border-mid bg-surface px-[14px] py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-medium text-fg">{job.fileName}</p>
        {isDone && <CheckCircle2 size={16} strokeWidth={1.7} className="shrink-0 text-accent" />}
      </div>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.03em] text-muted">
        {isDone ? 'Procesado y disponible' : job.stage}
      </p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
