import { useState } from 'react';

import { SearchInput } from '../../../shared/components/SearchInput';
import { TableStates } from '../../../shared/components/TableStates';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { useSessions } from '../api/useSessions';

import { SessionTable } from './SessionTable';

interface DashboardViewProps {
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function DashboardView({ selectedId, onSelect }: DashboardViewProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: sessions, isLoading, isError, refetch } = useSessions(debouncedQuery || undefined);

  const isEmpty = !isLoading && !isError && (sessions?.length ?? 0) === 0;

  return (
    <div className="mt-5">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Buscar por paciente, ID o procedimiento…"
      />
      <div className="mt-4">
        <TableStates
          isLoading={isLoading}
          isError={isError}
          isEmpty={isEmpty}
          query={debouncedQuery}
          onRetry={() => void refetch()}
        />
        {!isLoading && !isError && !isEmpty && sessions && (
          <SessionTable sessions={sessions} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}
