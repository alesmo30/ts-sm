import type { Citation } from '@ts-sm/shared';

import { Modal } from './Modal';

interface CitationModalProps {
  citation: Citation;
  kbVersion: number;
  onClose: () => void;
}

export function CitationModal({ citation, kbVersion, onClose }: CitationModalProps) {
  return (
    <Modal title={citation.docName} onClose={onClose}>
      <p className="whitespace-pre-wrap text-[13.5px] leading-[1.5] text-fg">{citation.snippet}</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
        <dt className="text-[12px] text-muted">Versión del documento</dt>
        <dd className="font-mono text-[13px] text-fg">v{citation.version}</dd>
        <dt className="text-[12px] text-muted">KB del turno</dt>
        <dd className="font-mono text-[13px] text-fg">v{kbVersion}</dd>
      </dl>
    </Modal>
  );
}
