/**
 * Limpia marcado Markdown que el LLM a veces emite pese al system prompt
 * (negritas, encabezados, viñetas). El asistente es de voz — nada de esto se
 * debe leer ni verse en la burbuja como "asterisco asterisco".
 * Aplicado por chunk de delta, no al texto completo: puede fallar en un
 * marcador partido justo en el borde de dos chunks (caso raro, se acepta).
 */
export function sanitizeAssistantText(chunk: string): string {
  return chunk
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/#/g, '');
}

export const ESCALATION_MARKER = '[[ESCALAR]]';
export const NO_REFERENCE_MARKER = '[[SIN_REFERENCIA]]';

function longestMarkerPrefixSuffix(marker: string, text: string): number {
  const maxLen = Math.min(text.length, marker.length - 1);
  for (let len = maxLen; len > 0; len -= 1) {
    if (marker.startsWith(text.slice(text.length - len))) {
      return len;
    }
  }
  return 0;
}

/**
 * Detecta y elimina una marca exacta (p. ej. [[ESCALAR]]) del stream crudo
 * del LLM antes de que sanitizeAssistantText y el resto del pipeline la vean.
 * A diferencia del sanitizador de markdown, no puede aceptar fallar en un
 * marcador partido entre dos chunks: retiene la cola sospechosa hasta el
 * siguiente chunk (o hasta flush() en 'done') en vez de emitirla de inmediato.
 */
export class MarkerFilter {
  private hold = '';
  private detected = false;

  constructor(private readonly marker: string) {}

  get markerDetected(): boolean {
    return this.detected;
  }

  /** Recibe un chunk crudo del LLM y devuelve la porción segura para emitir ya. */
  push(chunk: string): string {
    const combined = this.hold + chunk;
    const markerIndex = combined.indexOf(this.marker);

    if (markerIndex !== -1) {
      this.detected = true;
      this.hold = '';
      return combined.slice(0, markerIndex);
    }

    const holdLen = longestMarkerPrefixSuffix(this.marker, combined);
    this.hold = holdLen > 0 ? combined.slice(combined.length - holdLen) : '';
    return holdLen > 0 ? combined.slice(0, combined.length - holdLen) : combined;
  }

  /** Al terminar el turno: lo que quedó retenido no era la marca, se emite tal cual. */
  flush(): string {
    const remaining = this.hold;
    this.hold = '';
    return remaining;
  }
}

/** Especialización de MarkerFilter para [[ESCALAR]] — mantiene el nombre y la API previa. */
export class EscalationMarkerFilter extends MarkerFilter {
  constructor() {
    super(ESCALATION_MARKER);
  }

  get escalationDetected(): boolean {
    return this.markerDetected;
  }
}

/**
 * Especialización de MarkerFilter para [[SIN_REFERENCIA]]: el modelo la emite
 * cuando declara el límite de conocimiento (ver GROUNDING_INSTRUCTIONS) en vez
 * de fundamentar la respuesta en las citas recuperadas. Sirve para no mostrar
 * al paciente citas de documentos que el modelo no llegó a usar.
 */
export class NoReferenceMarkerFilter extends MarkerFilter {
  constructor() {
    super(NO_REFERENCE_MARKER);
  }

  get noReferenceDetected(): boolean {
    return this.markerDetected;
  }
}
