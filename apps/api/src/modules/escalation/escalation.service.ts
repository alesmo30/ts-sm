import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { LlmPort } from '../llm/llm.port';
import { SessionsService } from '../sessions/sessions.service';

import { EscalationRepository } from './escalation.repository';

export type EscalationReason = 'red_flag' | 'patient_request' | 'knowledge_gap';

const INITIAL_OUTCOME = 'Escalada en curso: el paciente todavía no decide si continuar o cerrar.';
const ACCEPTED_OUTCOME = 'Escalada aceptada: la sesión se cerró y el caso quedó en manos del médico.';
const CANCELLED_OUTCOME = 'Escalada cancelada por el paciente: la conversación continuó con normalidad.';

// Heurística de palabras, no una segunda llamada al LLM (REGLAS.md prohíbe un
// segundo modelo generativo, y una clasificación aparte dispararía otro call
// por turno). Sirve solo para poblar `reason` en el ServerEvent — no cambia
// la conducta de la escalada, que es idéntica para los dos disparadores.
const PATIENT_REQUEST_KEYWORDS = [
  'médico',
  'medico',
  'humano',
  'remit',
  'hablar con alguien',
  'persona real',
  'un doctor',
];

export function detectEscalationReason(patientText: string): EscalationReason {
  const lower = patientText.toLowerCase();
  return PATIENT_REQUEST_KEYWORDS.some((keyword) => lower.includes(keyword)) ? 'patient_request' : 'red_flag';
}

const ESCALATION_SUMMARY_PROMPT = `Resume el caso clínico de la conversación anterior entre un paciente y un asistente de voz post-operatorio para que un médico lo revise. Responde en español de Colombia, en texto plano sin viñetas.

Genera dos campos:
- summary: 2 a 4 oraciones con el estado clínico del paciente y lo que ha reportado.
- caseNotes: lo relevante para el médico que decide qué hacer — síntomas concretos, tiempos, y cualquier detalle operativo mencionado.`;

const EscalationSummarySchema = z.object({
  summary: z.string(),
  caseNotes: z.string(),
});

function reasonToCaseNotes(reason: EscalationReason): string {
  switch (reason) {
    case 'red_flag':
      return 'El agente detectó una posible bandera roja clínica durante la conversación.';
    case 'patient_request':
      return 'El paciente pidió explícitamente ser remitido a un médico.';
    case 'knowledge_gap':
      return 'El asistente no tenía información para responder y el paciente aceptó que su pregunta pasara al médico.';
  }
}

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly repository: EscalationRepository,
    private readonly sessionsService: SessionsService,
    private readonly llmPort: LlmPort,
  ) {}

  /** Devuelve true solo si esta llamada creó la fila — dos disparos en la misma sesión producen una sola. */
  async escalate(sessionId: string, reason: EscalationReason): Promise<boolean> {
    const session = await this.sessionsService.getDetail(sessionId);

    const created = await this.repository.create({
      sessionId,
      patientName: session.patientName,
      procedure: session.procedure,
      requestedBy: 'Agente de voz',
      outcome: INITIAL_OUTCOME,
      caseNotes: reasonToCaseNotes(reason),
    });

    if (!created) {
      return false;
    }

    await this.refresh(sessionId);
    return true;
  }

  /** Regenera resumen, notas y duración a partir de la transcripción completa. No toca outcome ni status. */
  async refresh(sessionId: string): Promise<void> {
    const existing = await this.repository.findBySessionId(sessionId);
    if (!existing) return;

    const detail = await this.sessionsService.getDetail(sessionId);
    const durationSeconds = Math.max(0, Math.round((Date.now() - detail.createdAt.getTime()) / 1000));

    const transcriptText = detail.turns
      .filter((turn) => turn.who !== 'system')
      .map((turn) => `${turn.who === 'patient' ? 'Paciente' : 'Asistente'}: ${turn.text}`)
      .join('\n');

    try {
      const { data } = await this.llmPort.structured(
        [
          { role: 'system', content: ESCALATION_SUMMARY_PROMPT },
          { role: 'user', content: transcriptText || 'Sin turnos registrados todavía.' },
        ],
        { schema: EscalationSummarySchema, schemaName: 'escalation_summary' },
      );

      await this.repository.updateBySessionId(sessionId, {
        llmSummary: data.summary,
        caseNotes: data.caseNotes,
        durationSeconds,
      });
    } catch (error) {
      this.logger.error(
        `No fue posible regenerar el resumen de escalada de la sesión ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.repository.updateBySessionId(sessionId, { durationSeconds });
    }
  }

  /** El paciente cancela la cuenta regresiva: la conversación sigue, el registro no se borra. */
  async cancel(sessionId: string): Promise<void> {
    const existing = await this.repository.findBySessionId(sessionId);
    if (!existing) return;
    await this.repository.updateBySessionId(sessionId, { outcome: CANCELLED_OUTCOME });
  }

  /** Se llama siempre al cerrar una sesión (aceptación del timeout o inactividad) — no-op si nunca escaló. */
  async onSessionClosed(sessionId: string): Promise<void> {
    const existing = await this.repository.findBySessionId(sessionId);
    if (!existing) return;

    await this.refresh(sessionId);

    if (existing.outcome === INITIAL_OUTCOME) {
      await this.repository.updateBySessionId(sessionId, { outcome: ACCEPTED_OUTCOME });
    }
  }
}
