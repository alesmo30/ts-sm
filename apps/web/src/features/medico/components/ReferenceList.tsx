import type { Reference } from '@ts-sm/shared';

import { formatBytes, formatDate } from '../../../shared/lib/format';

interface ReferenceListProps {
  references: Reference[];
  onOpen: (reference: Reference) => void;
  onToggleActive?: (reference: Reference) => void;
  isToggling?: boolean;
  /** Muestra si cada fila es de la base o subida a mano — solo tiene sentido cuando la lista mezcla ambos orígenes. */
  showOrigin?: boolean;
}

export function ReferenceList({ references, onOpen, onToggleActive, isToggling, showOrigin }: ReferenceListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {references.map((reference) => (
        <li key={reference.id}>
          <div
            className={
              reference.active
                ? 'flex w-full items-center gap-3 rounded-[10px] border border-transparent px-[14px] py-3 transition-colors duration-150 hover:border-border-mid'
                : 'flex w-full items-center gap-3 rounded-[10px] border border-transparent px-[14px] py-3 opacity-50 transition-colors duration-150 hover:border-border-mid'
            }
          >
            <button
              type="button"
              onClick={() => onOpen(reference)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-2 font-mono text-[10px] font-bold text-accent">
                {reference.type}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-fg">
                  {reference.name}
                </span>
                <span className="block text-[12px] text-muted">
                  {formatDate(reference.addedAt)} · {formatBytes(reference.sizeBytes)}
                  {showOrigin && (reference.origin === 'upload' ? ' · Subida por mí' : ' · Base')}
                  {!reference.active && ' · Deshabilitado'}
                </span>
              </span>
            </button>
            {onToggleActive && (
              <button
                type="button"
                disabled={isToggling}
                onClick={() => onToggleActive(reference)}
                className="shrink-0 rounded-full border border-border-mid px-[12px] py-[6px] text-[12px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {reference.active ? 'Deshabilitar' : 'Rehabilitar'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
