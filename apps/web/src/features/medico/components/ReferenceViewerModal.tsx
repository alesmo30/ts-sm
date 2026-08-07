import type { Reference } from '@ts-sm/shared';

import { Modal } from '../../../shared/components/Modal';

interface ReferenceViewerModalProps {
  reference: Reference;
  onClose: () => void;
}

export function ReferenceViewerModal({ reference, onClose }: ReferenceViewerModalProps) {
  return (
    <Modal title={reference.name} onClose={onClose}>
      <pre className="whitespace-pre-wrap font-mono text-[13px] text-fg">{reference.body}</pre>
    </Modal>
  );
}
