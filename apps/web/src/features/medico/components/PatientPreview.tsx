import type { PriorityPatient } from '@ts-sm/shared';

import { StatusTag } from '../../../shared/components/StatusTag';

interface PatientPreviewProps {
  patient: PriorityPatient;
}

export function PatientPreview({ patient }: PatientPreviewProps) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <p className="text-[13.5px] text-fg">
        {patient.patientName} · {patient.procedure} · {patient.requestedBy}
      </p>
      <StatusTag variant={patient.status} />
    </div>
  );
}
