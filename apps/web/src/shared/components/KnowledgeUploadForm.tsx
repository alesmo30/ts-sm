import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useCreateReference } from '../api/useCreateReference';
import { useIngestJob } from '../api/useIngestJob';

import { IngestJobStatus } from './IngestJobStatus';

export function KnowledgeUploadForm() {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createReference = useCreateReference();
  const { data: job } = useIngestJob(activeJobId);
  const queryClient = useQueryClient();

  // kb_state.version solo sube cuando la ingesta termina de verdad
  // (createReferenceWithChunks, al final del pipeline) — invalidar al recibir
  // el 202 del POST es prematuro, la fila ni existe todavía. Este es el punto
  // real donde la versión (y el conteo de referencias) cambiaron en el server.
  const notifiedJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (job?.stage !== 'Indexado' || notifiedJobIdRef.current === job.id) return;
    notifiedJobIdRef.current = job.id;
    void queryClient.invalidateQueries({ queryKey: ['references'] });
    void queryClient.invalidateQueries({ queryKey: ['knowledge', 'state'] });
    void queryClient.invalidateQueries({ queryKey: ['stats-counts'] });
  }, [job, queryClient]);

  const canSubmitText = name.trim().length > 0 && body.trim().length > 0;
  const canSubmit = file !== null || canSubmitText;

  function resetForm(): void {
    setName('');
    setBody('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (!canSubmit) return;

    const input = file ? { kind: 'file' as const, file } : { kind: 'text' as const, name, body };

    createReference.mutate(input, {
      onSuccess: (createdJob) => {
        setActiveJobId(createdJob.id);
        resetForm();
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[12px] border border-border-mid bg-surface p-4">
      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-medium text-muted" htmlFor="knowledge-name">
          Nombre del documento
        </label>
        <input
          id="knowledge-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={file !== null}
          placeholder="ej. protocolo-dolor-v2"
          className="rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[12px] font-medium text-muted" htmlFor="knowledge-body">
          Texto pegado
        </label>
        <textarea
          id="knowledge-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={file !== null}
          rows={4}
          placeholder="Pega aquí el contenido del documento…"
          className="resize-none rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-[0.05em] text-tx-muted">o</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.md,.txt,.json"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="hidden"
          id="knowledge-file"
        />
        <label
          htmlFor="knowledge-file"
          className="flex cursor-pointer items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[14px] py-[8px] text-[13px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          <Paperclip size={14} strokeWidth={1.7} />
          Elegir archivo (.pdf, .md, .txt, .json)
        </label>
        {file && <span className="truncate text-[12.5px] text-muted">{file.name}</span>}
      </div>

      <button
        type="submit"
        disabled={!canSubmit || createReference.isPending}
        className="mt-1 flex items-center justify-center gap-2 self-start rounded-full bg-accent px-[16px] py-[9px] text-[13.5px] font-medium text-on-accent disabled:opacity-50"
      >
        <Upload size={14} strokeWidth={1.7} />
        {createReference.isPending ? 'Subiendo…' : 'Subir a la base de conocimiento'}
      </button>

      {createReference.isError && (
        <p className="text-[12.5px] text-danger" role="alert">
          No fue posible iniciar la ingesta. Intenta de nuevo.
        </p>
      )}

      {job && <IngestJobStatus job={job} />}
    </form>
  );
}
