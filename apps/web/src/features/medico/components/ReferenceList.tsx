import type { Reference } from '@ts-sm/shared';

import { formatBytes, formatDate } from '../../../shared/lib/format';

interface ReferenceListProps {
  references: Reference[];
  onOpen: (reference: Reference) => void;
}

export function ReferenceList({ references, onOpen }: ReferenceListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {references.map((reference) => (
        <li key={reference.id}>
          <button
            type="button"
            onClick={() => onOpen(reference)}
            className="flex w-full items-center gap-3 rounded-[10px] border border-transparent px-[14px] py-3 text-left transition-colors duration-150 hover:border-border-mid"
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
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
