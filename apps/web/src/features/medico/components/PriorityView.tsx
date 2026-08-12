import { useState } from 'react';

import { SearchInput } from '../../../shared/components/SearchInput';
import { TableStates } from '../../../shared/components/TableStates';
import { usePriorityPatients } from '../api/usePriorityPatients';

import { PriorityTable } from './PriorityTable';

interface PriorityViewProps {
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function PriorityView({ selectedId, onSelect }: PriorityViewProps) {
  const [query, setQuery] = useState('');
  const { data: patients, isLoading, isError, refetch } = usePriorityPatients();

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = patients?.filter(
    (patient) =>
      normalizedQuery.length === 0 ||
      patient.patientName.toLowerCase().includes(normalizedQuery) ||
      patient.procedure.toLowerCase().includes(normalizedQuery) ||
      patient.id.toLowerCase().includes(normalizedQuery),
  );
  const isEmpty = !isLoading && !isError && (filtered?.length ?? 0) === 0;

  return (
    <div className="mt-5">
      <SearchInput value={query} onChange={setQuery} placeholder="Buscar por paciente, ID o procedimiento…" />
      <div className="mt-4">
        <TableStates
          isLoading={isLoading}
          isError={isError}
          isEmpty={isEmpty}
          query={normalizedQuery || undefined}
          onRetry={() => void refetch()}
        />
        {!isLoading && !isError && !isEmpty && filtered && (
          <PriorityTable patients={filtered} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
