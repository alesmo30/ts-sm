import type { Citation } from '@ts-sm/shared';
import { useState } from 'react';

import { CitationModal } from './CitationModal';

interface CitationChipsProps {
  citations: Citation[];
  kbVersion: number;
}

export function CitationChips({ citations, kbVersion }: CitationChipsProps) {
  const [openCitation, setOpenCitation] = useState<Citation | null>(null);

  if (citations.length === 0) return null;

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {citations.map((citation) => (
          <button
            key={citation.chunkId}
            type="button"
            onClick={() => setOpenCitation(citation)}
            className="max-w-[220px] truncate rounded-full border border-border-mid bg-surface-2 px-[10px] py-[3px] font-mono text-[10.5px] text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            {citation.docName}
          </button>
        ))}
      </div>
      {openCitation && (
        <CitationModal citation={openCitation} kbVersion={kbVersion} onClose={() => setOpenCitation(null)} />
      )}
    </>
  );
}
