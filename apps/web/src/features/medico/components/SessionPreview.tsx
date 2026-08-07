import { StatusTag } from '../../../shared/components/StatusTag';
import { useSession } from '../api/useSession';

interface SessionPreviewProps {
  id: string;
}

export function SessionPreview({ id }: SessionPreviewProps) {
  const { data: session, isLoading } = useSession(id);

  if (isLoading || !session) {
    return <p className="mt-2 text-[13px] text-muted">Cargando…</p>;
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <p className="text-[13.5px] text-fg">
        {session.patientName} · {session.procedure} · {session.time}
      </p>
      <StatusTag variant={session.status} />
    </div>
  );
}
