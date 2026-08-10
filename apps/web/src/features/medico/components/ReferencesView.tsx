import type { Reference } from '@ts-sm/shared';
import { useState } from 'react';

import { useReferences } from '../../../shared/api/useReferences';
import { TableStates } from '../../../shared/components/TableStates';

import { ReferenceList } from './ReferenceList';
import { ReferenceViewerModal } from './ReferenceViewerModal';

export function ReferencesView() {
  const { data: references, isLoading, isError, refetch } = useReferences();
  const [openReference, setOpenReference] = useState<Reference | null>(null);
  const isEmpty = !isLoading && !isError && (references?.length ?? 0) === 0;

  return (
    <div className="mt-5">
      <TableStates
        isLoading={isLoading}
        isError={isError}
        isEmpty={isEmpty}
        onRetry={() => void refetch()}
      />
      {!isLoading && !isError && !isEmpty && references && (
        <ReferenceList references={references} onOpen={setOpenReference} />
      )}
      {openReference && (
        <ReferenceViewerModal reference={openReference} onClose={() => setOpenReference(null)} />
      )}
    </div>
  );
}
