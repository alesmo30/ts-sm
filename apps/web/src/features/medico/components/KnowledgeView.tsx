import type { Reference } from '@ts-sm/shared';
import { useState } from 'react';

import { useKbState } from '../../../shared/api/useKbState';
import { useReferences } from '../../../shared/api/useReferences';
import { useSetReferenceActive } from '../../../shared/api/useSetReferenceActive';
import { KbVersionChip } from '../../../shared/components/KbVersionChip';
import { KnowledgeUploadForm } from '../../../shared/components/KnowledgeUploadForm';
import { TableStates } from '../../../shared/components/TableStates';

import { ReferenceList } from './ReferenceList';
import { ReferenceViewerModal } from './ReferenceViewerModal';

type Tab = 'upload' | 'corpus';

export function KnowledgeView() {
  const [tab, setTab] = useState<Tab>('upload');
  const [openReference, setOpenReference] = useState<Reference | null>(null);

  const origin = tab === 'upload' ? 'upload' : 'corpus';
  const { data: references, isLoading, isError, refetch } = useReferences({ origin, includeInactive: true });
  const setActive = useSetReferenceActive();
  const { data: kbState } = useKbState();

  const isEmpty = !isLoading && !isError && (references?.length ?? 0) === 0;

  return (
    <div className="mt-5 flex flex-col gap-5">
      {kbState && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <span>Base de conocimiento actual:</span>
          <KbVersionChip version={kbState.version} />
        </div>
      )}

      <KnowledgeUploadForm />

      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={
            tab === 'upload'
              ? 'border-b-2 border-accent px-3 py-2 text-[13px] font-medium text-fg'
              : 'border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg'
          }
        >
          Subidos
        </button>
        <button
          type="button"
          onClick={() => setTab('corpus')}
          className={
            tab === 'corpus'
              ? 'border-b-2 border-accent px-3 py-2 text-[13px] font-medium text-fg'
              : 'border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg'
          }
        >
          Base
        </button>
      </div>

      <TableStates isLoading={isLoading} isError={isError} isEmpty={isEmpty} onRetry={() => void refetch()} />
      {!isLoading && !isError && !isEmpty && references && (
        <ReferenceList
          references={references}
          onOpen={setOpenReference}
          onToggleActive={(reference) => setActive.mutate({ id: reference.id, active: !reference.active })}
          isToggling={setActive.isPending}
        />
      )}
      {openReference && (
        <ReferenceViewerModal reference={openReference} onClose={() => setOpenReference(null)} />
      )}
    </div>
  );
}
