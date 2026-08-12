import { Injectable, NotFoundException } from '@nestjs/common';
import type { PriorityPatient } from '@ts-sm/shared';

import { PatientsRepository, type PriorityPatientRow } from './patients.repository';

function toPriorityPatient(row: PriorityPatientRow): PriorityPatient {
  return {
    id: row.id,
    sessionId: row.sessionId,
    patientName: row.patientName,
    procedure: row.procedure,
    requestedBy: row.requestedBy,
    status: row.status,
    llmSummary: row.llmSummary,
    outcome: row.outcome,
    durationSeconds: row.durationSeconds,
    caseNotes: row.caseNotes,
    sessionDate: row.sessionDate,
  };
}

@Injectable()
export class PatientsService {
  constructor(private readonly repository: PatientsRepository) {}

  async list(): Promise<PriorityPatient[]> {
    const rows = await this.repository.findAll();
    return rows.map(toPriorityPatient);
  }

  async getById(id: string): Promise<PriorityPatient> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException(`Paciente prioritario ${id} no encontrado`);
    }
    return toPriorityPatient(row);
  }
}
