import { Mic } from 'lucide-react';

export function PreSesion() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h2 className="font-display text-[24px] font-semibold text-fg">Habla con tu asistente de voz</h2>
      <p className="max-w-[520px] text-[15px] leading-[1.5] text-muted">
        Podrás escribir o hablar tus preguntas sobre tu procedimiento. Todo queda registrado para tu
        médico.
      </p>
      <button
        type="button"
        className="mt-3 flex items-center gap-2 rounded-full bg-accent px-[18px] py-[10px] text-[13.5px] font-medium text-on-accent"
      >
        <Mic size={14} strokeWidth={1.7} />
        Comenzar
      </button>
      <p className="mt-1 text-[12.5px] text-tx-muted">Se te pedirá permiso de micrófono si usas voz</p>
    </div>
  );
}
