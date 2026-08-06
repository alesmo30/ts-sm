import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { kbState, priorityPatients, references, sessions, transcripts } from './schema';

type SeedTurn = readonly [who: 'patient' | 'assistant', text: string];

interface SeedSession {
  code: string;
  fecha: string;
  hora: string;
  paciente: string;
  proc: string;
  estado: 'ok' | 'attn' | 'fail';
  chat: readonly SeedTurn[];
  resumen: string;
}

const seedSessions: readonly SeedSession[] = [
  {
    code: 'SES-4821',
    fecha: '2026-08-04',
    hora: '09:12',
    paciente: 'Marcela Ortiz',
    proc: 'Consulta preoperatoria',
    estado: 'ok',
    chat: [
      ['patient', 'Hola, tengo dudas sobre el ayuno antes de la cirugía.'],
      [
        'assistant',
        'Claro, Marcela. Debes ayunar 8 horas antes del procedimiento, solo agua permitida hasta 2 horas antes.',
      ],
      ['patient', '¿Puedo tomar mi medicamento para la presión?'],
      [
        'assistant',
        'Sí, tómalo con un sorbo pequeño de agua a la hora habitual, salvo indicación contraria de tu médico.',
      ],
    ],
    resumen:
      'Se confirmaron indicaciones de ayuno de 8 horas y continuidad del tratamiento antihipertensivo. Paciente sin dudas adicionales.',
  },
  {
    code: 'SES-4822',
    fecha: '2026-08-04',
    hora: '10:45',
    paciente: 'Jorge Restrepo',
    proc: 'Seguimiento post-operatorio',
    estado: 'attn',
    chat: [
      ['patient', 'Tengo dolor fuerte en la zona de la incisión hace dos días.'],
      [
        'assistant',
        'Entiendo tu preocupación, Jorge. Voy a marcar esto para que un profesional te contacte directamente.',
      ],
      ['patient', 'Está bien, gracias.'],
    ],
    resumen:
      'Paciente reporta dolor intenso persistente en zona operatoria. Se escaló para atención humana prioritaria.',
  },
  {
    code: 'SES-4823',
    fecha: '2026-08-03',
    hora: '16:20',
    paciente: 'Ana Beltrán',
    proc: 'Consulta general',
    estado: 'ok',
    chat: [
      ['patient', '¿Cada cuánto debo tomar el antibiótico?'],
      ['assistant', 'Cada 8 horas durante 7 días, sin saltarte dosis aunque te sientas mejor.'],
    ],
    resumen:
      'Se reforzó el esquema de dosificación del antibiótico prescrito. Sin señales de alerta.',
  },
  {
    code: 'SES-4824',
    fecha: '2026-08-03',
    hora: '12:05',
    paciente: 'Luis Fernández',
    proc: 'Examen de laboratorio',
    estado: 'fail',
    chat: [
      ['patient', 'No entiendo qué me está preguntando.'],
      [
        'assistant',
        'Perdona la confusión. Intentemos de nuevo: ¿en qué fecha te realizaste el último examen?',
      ],
      ['patient', 'No sé, mejor hablo con alguien.'],
    ],
    resumen:
      'Sesión no logró completar la recolección de información. Paciente terminó la llamada sin resolución.',
  },
  {
    code: 'SES-4825',
    fecha: '2026-08-02',
    hora: '08:30',
    paciente: 'Marcela Ortiz',
    proc: 'Consulta preoperatoria',
    estado: 'ok',
    chat: [
      ['patient', '¿A qué hora debo llegar el día de la cirugía?'],
      ['assistant', 'Debes llegar 2 horas antes, a las 6:00 a.m., a admisiones del segundo piso.'],
    ],
    resumen: 'Se confirmó hora y lugar de llegada para el procedimiento programado.',
  },
];

interface SeedPriorityPatient {
  patientName: string;
  procedure: string;
  requestedBy: string;
  status: 'ok' | 'attn' | 'fail';
  llmSummary: string;
  outcome: string;
  durationSeconds: number;
  caseNotes: string;
  linkedSessionCode: string | null;
}

const seedPriorityPatients: readonly SeedPriorityPatient[] = [
  {
    patientName: 'Jorge Restrepo',
    procedure: 'Seguimiento post-operatorio',
    requestedBy: 'Asistente de voz',
    status: 'attn',
    llmSummary:
      'El paciente reportó dolor intenso y persistente en la zona de incisión, dos días después del procedimiento. El asistente no pudo descartar signos de infección y escaló el caso para contacto humano inmediato.',
    outcome: 'Escalado a atención humana',
    durationSeconds: 6 * 60 + 12,
    caseNotes:
      'Cirugía de vesícula realizada el 2026-08-01. Dolor reportado nivel 8/10, sin fiebre referida. Requiere valoración presencial en las próximas 24 horas.',
    linkedSessionCode: 'SES-4822',
  },
  {
    patientName: 'Luis Fernández',
    procedure: 'Examen de laboratorio',
    requestedBy: 'Paciente',
    status: 'fail',
    llmSummary:
      'El paciente solicitó hablar con un humano tras no lograr ubicar la fecha de su último examen. La conversación terminó sin resolución ni agenda de nueva cita.',
    outcome: 'Sesión no resuelta',
    durationSeconds: 3 * 60 + 40,
    caseNotes:
      'Paciente con antecedente de control de glicemia. No se logró confirmar fecha de examen previo; se recomienda contacto telefónico para agendar toma de muestra.',
    linkedSessionCode: 'SES-4824',
  },
  {
    patientName: 'Diana Salazar',
    procedure: 'Consulta de resultados',
    requestedBy: 'Paciente',
    status: 'attn',
    llmSummary:
      'La paciente pidió expresamente hablar con su médico tratante antes de conocer el resultado de su biopsia, por ansiedad ante el procedimiento.',
    outcome: 'Atención personalizada solicitada',
    durationSeconds: 4 * 60 + 5,
    caseNotes:
      'Biopsia de piel realizada el 2026-07-28, resultado disponible en sistema. Paciente prefiere recibir el resultado directamente del médico.',
    linkedSessionCode: null,
  },
];

interface SeedReference {
  name: string;
  type: 'PDF' | 'MD' | 'TXT' | 'JSON' | 'NOTA';
  addedAt: string;
  sizeBytes: number | null;
  body: string;
}

const seedReferences: readonly SeedReference[] = [
  {
    name: 'protocolo-preoperatorio.pdf',
    type: 'PDF',
    addedAt: '2026-07-20',
    sizeBytes: 340 * 1024,
    body: 'Documento PDF · Protocolo de preparación preoperatoria estándar: ayuno, medicación habitual, y hora de llegada por tipo de procedimiento.',
  },
  {
    name: 'guia-dolor-postoperatorio.md',
    type: 'MD',
    addedAt: '2026-07-22',
    sizeBytes: 12 * 1024,
    body: '# Guía de manejo del dolor postoperatorio\n\n- Dolor leve (1-3/10): manejo con analgésico habitual.\n- Dolor moderado (4-6/10): reforzar pauta y observar 24h.\n- Dolor severo (7-10/10) o con fiebre: escalar a atención humana inmediata.',
  },
  {
    name: 'faq-antibioticos.txt',
    type: 'TXT',
    addedAt: '2026-07-25',
    sizeBytes: 4 * 1024,
    body: '¿Cada cuánto se toma el antibiótico estándar? Cada 8 horas durante 7 días.\n¿Qué hacer si se olvida una dosis? Tomarla apenas se recuerde, sin duplicar la siguiente.',
  },
  {
    name: 'escalamiento-reglas.json',
    type: 'JSON',
    addedAt: '2026-07-28',
    sizeBytes: 2 * 1024,
    body: '{\n  "reglas_escalamiento": [\n    {"condicion": "dolor >= 7", "accion": "atencion_humana"},\n    {"condicion": "fiebre_reportada", "accion": "atencion_humana"},\n    {"condicion": "paciente_solicita_humano", "accion": "atencion_humana"}\n  ]\n}',
  },
  {
    name: 'Nota del Dr. sobre casos oncológicos',
    type: 'NOTA',
    addedAt: '2026-07-30',
    sizeBytes: null,
    body: 'Cuando el paciente mencione resultados de biopsia o diagnóstico oncológico, el asistente debe evitar dar el resultado directamente y ofrecer siempre la opción de hablar con el médico tratante.',
  },
];

async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL debe estar definida para correr la semilla');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  await db.transaction(async (tx) => {
    const sessionIdByCode = new Map<string, string>();

    for (const seedSession of seedSessions) {
      const [inserted] = await tx
        .insert(sessions)
        .values({
          code: seedSession.code,
          date: seedSession.fecha,
          time: seedSession.hora,
          patientName: seedSession.paciente,
          procedure: seedSession.proc,
          status: seedSession.estado,
          kbVersion: 1,
          summary: seedSession.resumen,
          structuredSummary: null,
        })
        .onConflictDoNothing({ target: sessions.code })
        .returning({ id: sessions.id });

      const sessionId =
        inserted?.id ??
        (
          await tx
            .select({ id: sessions.id })
            .from(sessions)
            .where(eq(sessions.code, seedSession.code))
        )[0]?.id;

      if (!sessionId) {
        throw new Error(`No se pudo resolver el id de la sesión ${seedSession.code}`);
      }

      sessionIdByCode.set(seedSession.code, sessionId);

      for (const [seq, [who, text]] of seedSession.chat.entries()) {
        await tx
          .insert(transcripts)
          .values({
            sessionId,
            seq,
            who,
            text,
            isVoice: false,
            citations: [],
            kbVersion: 1,
          })
          .onConflictDoNothing({ target: [transcripts.sessionId, transcripts.seq] });
      }
    }

    for (const patient of seedPriorityPatients) {
      const existing = await tx
        .select({ id: priorityPatients.id })
        .from(priorityPatients)
        .where(eq(priorityPatients.patientName, patient.patientName));

      if (existing.length > 0) {
        continue;
      }

      await tx.insert(priorityPatients).values({
        sessionId: patient.linkedSessionCode
          ? (sessionIdByCode.get(patient.linkedSessionCode) ?? null)
          : null,
        patientName: patient.patientName,
        procedure: patient.procedure,
        requestedBy: patient.requestedBy,
        status: patient.status,
        llmSummary: patient.llmSummary,
        outcome: patient.outcome,
        durationSeconds: patient.durationSeconds,
        caseNotes: patient.caseNotes,
      });
    }

    for (const reference of seedReferences) {
      await tx
        .insert(references)
        .values({
          name: reference.name,
          type: reference.type,
          addedAt: new Date(reference.addedAt),
          sizeBytes: reference.sizeBytes,
          active: true,
          version: 1,
          chunks: 0,
          body: reference.body,
        })
        .onConflictDoNothing({ target: references.name });
    }

    await tx
      .insert(kbState)
      .values({ id: 1, version: 1 })
      .onConflictDoNothing({ target: kbState.id });
  });

  await pool.end();
   
  console.log('Semilla aplicada.');
}

seed().catch((error) => {
   
  console.error('Falló la semilla:', error);
  process.exit(1);
});
