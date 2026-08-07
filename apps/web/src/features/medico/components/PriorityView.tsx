import { TableStates } from '../../../shared/components/TableStates';
import { usePriorityPatients } from '../api/usePriorityPatients';

import { PriorityTable } from './PriorityTable';

interface PriorityViewProps {
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function PriorityView({ selectedId, onSelect }: PriorityViewProps) {
  const { data: patients, isLoading, isError, refetch } = usePriorityPatients();
  const isEmpty = !isLoading && !isError && (patients?.length ?? 0) === 0;

  return (
    <div className="mt-5">
      <TableStates
        isLoading={isLoading}
        isError={isError}
        isEmpty={isEmpty}
        onRetry={() => void refetch()}
      />
      {!isLoading && !isError && !isEmpty && patients && (
        <PriorityTable patients={patients} selectedId={selectedId} onSelect={onSelect} />
      )}
    </div>
  );
}
