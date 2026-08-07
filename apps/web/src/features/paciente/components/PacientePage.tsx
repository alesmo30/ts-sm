import { FileText } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Topbar } from '../../../shared/layouts/Topbar';
import { useConversation } from '../api/useConversation';
import { useSessionLifecycle } from '../api/useSessionLifecycle';

import { ChatView } from './ChatView';
import { Composer } from './Composer';
import { ExitModal } from './ExitModal';
import { PreSesion } from './PreSesion';

export function PacientePage() {
  const navigate = useNavigate();
  const { sessionId, isStarting, isClosing, start, close } = useSessionLifecycle();
  const { turns, streamingText, isStreaming, error, send } = useConversation(sessionId);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  async function handleConfirmExit(): Promise<void> {
    await close();
    navigate('/medico');
  }

  return (
    <>
      <Topbar
        markLabel="Pa"
        title="Hola Paciente"
        subtitle="Asistente de voz — MeridianAsiste"
        switchLabel="Cambiar a Dr"
        switchTo="/medico"
        onInterceptSwitch={sessionId ? () => setIsExitModalOpen(true) : undefined}
        leftExtra={
          <button
            type="button"
            aria-label="Actualizar conocimiento"
            className="flex items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[14px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
          >
            <FileText size={14} strokeWidth={1.7} />
            <span className="hidden sm:inline">Actualizar conocimiento</span>
          </button>
        }
      />

      {sessionId === null ? (
        <main className="flex min-h-[calc(100vh-72px)] items-center justify-center px-5">
          <div className="w-full max-w-[720px]">
            <PreSesion onStart={() => void start()} isStarting={isStarting} />
          </div>
        </main>
      ) : (
        <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[720px] flex-col">
          <ChatView turns={turns} streamingText={streamingText} isStreaming={isStreaming} error={error} />
          <Composer onSend={send} />
        </main>
      )}

      {isExitModalOpen && (
        <ExitModal
          isClosing={isClosing}
          onCancel={() => setIsExitModalOpen(false)}
          onConfirm={() => void handleConfirmExit()}
        />
      )}
    </>
  );
}
