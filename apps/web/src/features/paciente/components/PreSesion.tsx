import { CreateSessionSchema, type CreateSessionInput } from '@ts-sm/shared';
import { Mic } from 'lucide-react';
import { useState } from 'react';

interface PreSesionProps {
  onStart: (input: CreateSessionInput) => void;
  isStarting: boolean;
}

type FormState = { patientName: string; procedure: string; email: string; phone: string };

const EMPTY_FORM: FormState = { patientName: '', procedure: '', email: '', phone: '' };

export function PreSesion({ onStart, isStarting }: PreSesionProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function handleChange(field: keyof FormState, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();

    const result = CreateSessionSchema.safeParse(form);
    if (!result.success) {
      const nextErrors: Partial<Record<keyof FormState, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormState;
        nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onStart(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3 text-center">
      <h2 className="font-display text-[24px] font-semibold text-fg">Habla con tu asistente de voz</h2>
      <p className="max-w-[520px] text-[15px] leading-[1.5] text-muted">
        Podrás escribir o hablar tus preguntas sobre tu procedimiento. Todo queda registrado para tu
        médico.
      </p>

      <div className="mt-3 grid w-full max-w-[420px] grid-cols-1 gap-3 text-left">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted" htmlFor="pre-sesion-nombre">
            Nombre completo
          </label>
          <input
            id="pre-sesion-nombre"
            type="text"
            value={form.patientName}
            onChange={(event) => handleChange('patientName', event.target.value)}
            className="rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg"
          />
          {errors.patientName && <p className="text-[12px] text-danger">{errors.patientName}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted" htmlFor="pre-sesion-procedimiento">
            Procedimiento
          </label>
          <input
            id="pre-sesion-procedimiento"
            type="text"
            value={form.procedure}
            onChange={(event) => handleChange('procedure', event.target.value)}
            className="rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg"
          />
          {errors.procedure && <p className="text-[12px] text-danger">{errors.procedure}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-muted" htmlFor="pre-sesion-correo">
            Correo
          </label>
          <input
            id="pre-sesion-correo"
            type="email"
            value={form.email}
            onChange={(event) => handleChange('email', event.target.value)}
            className="rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg"
          />
          {errors.email && <p className="text-[12px] text-danger">{errors.email}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[12px] font-medium text-muted" htmlFor="pre-sesion-telefono">
              Teléfono
            </label>
            <span className="rounded-full bg-accent-soft px-2 py-[2px] text-[11px] font-medium text-accent">
              Usa tu número real
            </span>
          </div>
          <input
            id="pre-sesion-telefono"
            type="tel"
            value={form.phone}
            onChange={(event) => handleChange('phone', event.target.value)}
            className="rounded-[8px] border border-border-mid bg-surface-2 px-3 py-2 text-[13.5px] text-fg"
          />
          <p className="text-[12px] text-muted">
            Si el médico escala tu caso, te llamará a este número — pon uno real para vivir la experiencia completa.
          </p>
          {errors.phone && <p className="text-[12px] text-danger">{errors.phone}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isStarting}
        className="mt-3 flex items-center gap-2 rounded-full bg-accent px-[18px] py-[10px] text-[13.5px] font-medium text-on-accent disabled:opacity-60"
      >
        <Mic size={14} strokeWidth={1.7} />
        {isStarting ? 'Iniciando…' : 'Comenzar'}
      </button>
      <p className="mt-1 text-[12.5px] text-tx-muted">Se te pedirá permiso de micrófono si usas voz</p>
    </form>
  );
}
