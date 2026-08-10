import type { Reference, ReferenceOrigin, ReferenceType } from '@ts-sm/shared';
import { useMemo, useState } from 'react';

import { useReferences } from '../../../shared/api/useReferences';
import { TableStates } from '../../../shared/components/TableStates';

import { ReferenceList } from './ReferenceList';
import { ReferenceViewerModal } from './ReferenceViewerModal';

type OriginTab = ReferenceOrigin | 'all';

const ORIGIN_TABS: { key: OriginTab; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'corpus', label: 'Base' },
  { key: 'upload', label: 'Subidas por mí' },
];

export function ReferencesView() {
  const [originTab, setOriginTab] = useState<OriginTab>('all');
  const [typeFilter, setTypeFilter] = useState<ReferenceType | 'all'>('all');
  const [openReference, setOpenReference] = useState<Reference | null>(null);

  const {
    data: references,
    isLoading,
    isError,
    refetch,
  } = useReferences({ origin: originTab === 'all' ? undefined : originTab });

  // Solo se ofrecen como filtro los tipos que de verdad aparecen en la
  // pestaña activa — mostrar un chip "JSON" cuando no hay ningún JSON solo
  // invita a un vacío confuso.
  const availableTypes = useMemo(
    () => Array.from(new Set((references ?? []).map((reference) => reference.type))).sort(),
    [references],
  );

  const filtered = useMemo(
    () => (references ?? []).filter((reference) => typeFilter === 'all' || reference.type === typeFilter),
    [references, typeFilter],
  );

  const isEmpty = !isLoading && !isError && filtered.length === 0;

  function handleOriginChange(next: OriginTab): void {
    setOriginTab(next);
    setTypeFilter('all');
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        {ORIGIN_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleOriginChange(tab.key)}
            className={
              originTab === tab.key
                ? 'border-b-2 border-accent px-3 py-2 text-[13px] font-medium text-fg'
                : 'border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={
              typeFilter === 'all'
                ? 'rounded-full bg-accent-soft px-[12px] py-[5px] text-[12px] font-medium text-accent'
                : 'rounded-full border border-border-mid px-[12px] py-[5px] text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-accent'
            }
          >
            Todos los formatos
          </button>
          {availableTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={
                typeFilter === type
                  ? 'rounded-full bg-accent-soft px-[12px] py-[5px] font-mono text-[12px] font-medium text-accent'
                  : 'rounded-full border border-border-mid px-[12px] py-[5px] font-mono text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-accent'
              }
            >
              {type}
            </button>
          ))}
        </div>
      )}

      <TableStates
        isLoading={isLoading}
        isError={isError}
        isEmpty={isEmpty}
        query={typeFilter !== 'all' ? typeFilter : undefined}
        onRetry={() => void refetch()}
      />
      {!isLoading && !isError && !isEmpty && (
        <ReferenceList references={filtered} onOpen={setOpenReference} showOrigin={originTab === 'all'} />
      )}
      {openReference && (
        <ReferenceViewerModal reference={openReference} onClose={() => setOpenReference(null)} />
      )}
    </div>
  );
}
