import { FileText, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Topbar } from '../../../shared/layouts/Topbar';
import { useConversation } from '../api/useConversation';
import { useSessionLifecycle } from '../api/useSessionLifecycle';
import { useVoiceConfig } from '../api/useVoiceConfig';
import { useAudioPlayback } from '../audio/useAudioPlayback';
import { useMicrophone } from '../audio/useMicrophone';
import { useWebSpeechFallback } from '../audio/useWebSpeechFallback';

import { ChatView } from './ChatView';
import { Composer } from './Composer';
import { ConfirmModal } from './ConfirmModal';
import { PreSesion } from './PreSesion';
import { SpeedControl } from './SpeedControl';

export function PacientePage() {
  const navigate = useNavigate();
  const { sessionId, isStarting, isClosing, start, close, reset } = useSessionLifecycle();
  const voiceConfig = useVoiceConfig();
  const audioPlayback = useAudioPlayback();
  const [speechRate, setSpeechRate] = useState(1);

  // Texto del composer, dueño de PacientePage (no de Composer): el mic
  // necesita poder acumular transcripciones ahí, editables, sin auto-enviar
  // — estilo Wispr Flow. Ver decisión en specs/06-capa-de-voz.md.
  const [draft, setDraft] = useState('');
  const [draftHasVoice, setDraftHasVoice] = useState(false);

  const isDeepgram = voiceConfig.provider === 'deepgram';
  const isWebSpeech = voiceConfig.provider === 'webspeech';

  function appendTranscript(text: string): void {
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    setDraftHasVoice(true);
  }

  const {
    turns,
    streamingText,
    isStreaming,
    error,
    sttStatus,
    isSynthesizingVoice,
    send,
    sendAudioStart,
    sendAudioEnd,
    sendAudioChunk,
  } = useConversation(sessionId, {
    onAudioChunk: isDeepgram ? audioPlayback.enqueue : undefined,
    onTranscript: appendTranscript,
  });

  function handleSend(): void {
    const trimmed = draft.trim();
    if (!trimmed) return;
    send(trimmed, draftHasVoice);
    setDraft('');
    setDraftHasVoice(false);
  }

  // Botón "detener": el usuario puede cortar el audio manualmente en cualquier
  // punto de la respuesta. Es un stop de audio nada más (no cancela el LLM en
  // el backend, ver decisión en la conversación) — mientras está activo, se
  // trata como si el turno ya hubiera terminado para desbloquear la UI.
  const [voiceStoppedOverride, setVoiceStoppedOverride] = useState(false);
  const [isStopVoiceModalOpen, setIsStopVoiceModalOpen] = useState(false);

  // Entrada de los dos hooks de mic: no puede depender de webSpeech.isSpeaking
  // (circular, todavía no existe acá). isResponding de más abajo sí lo suma,
  // para bloquear composer/velocidad mientras el fallback local sigue leyendo.
  const rawBusyForMic = isStreaming || audioPlayback.isPlaying || sttStatus === 'transcribing';
  const busyForMic = voiceStoppedOverride ? false : rawBusyForMic;

  const deepgramMic = useMicrophone({
    enabled: isDeepgram,
    busy: busyForMic,
    onAudioChunk: sendAudioChunk,
    onRecordingStart: sendAudioStart,
    onRecordingStop: sendAudioEnd,
  });

  const webSpeech = useWebSpeechFallback({
    enabled: isWebSpeech,
    busy: busyForMic,
    // El fallback local transcribe en el propio navegador (sin round-trip al
    // servidor): mismo destino que el resultado de Deepgram, se acumula.
    onFinalTranscript: appendTranscript,
  });

  // Estado real de "el asistente está respondiendo": bloquea input, envío y
  // selector de velocidad hasta que termine de escribir Y de sonar, sea por
  // Deepgram (audioPlayback) o por el fallback local (webSpeech.isSpeaking).
  const isResponding = voiceStoppedOverride ? false : busyForMic || (isWebSpeech && webSpeech.isSpeaking);
  const showStopVoice = isResponding && (isDeepgram || isWebSpeech);

  function handleRequestStopVoice(): void {
    setIsStopVoiceModalOpen(true);
  }

  function handleConfirmStopVoice(): void {
    audioPlayback.stop();
    webSpeech.cancel();
    setVoiceStoppedOverride(true);
    setIsStopVoiceModalOpen(false);
  }

  // Al arrancar un turno nuevo (isStreaming pasa de false a true, sea por
  // send() o por el saludo inicial) se levanta el override del stop manual y
  // se vuelve a habilitar la cola de audio, muteada por audioPlayback.stop().
  const wasStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      setVoiceStoppedOverride(false);
      audioPlayback.reset();
    }
    wasStreamingRef.current = isStreaming;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // Velocidad de reproducción: la misma preferencia se aplica a los dos
  // caminos de TTS, Deepgram (Web Audio) y el fallback local (speechSynthesis).
  useEffect(() => {
    audioPlayback.setRate(speechRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechRate]);

  // TTS del fallback local: habla el último turno del asistente una sola vez.
  const spokenTurnIds = useRef(new Set<string>());
  useEffect(() => {
    if (!isWebSpeech) return;
    const lastTurn = turns[turns.length - 1];
    if (lastTurn?.who === 'assistant' && !spokenTurnIds.current.has(lastTurn.id)) {
      spokenTurnIds.current.add(lastTurn.id);
      webSpeech.speak(lastTurn.text, speechRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, isWebSpeech, speechRate]);

  const micState = isDeepgram ? deepgramMic.state : isWebSpeech ? webSpeech.state : 'off';
  const onMicPointerDown = isDeepgram ? deepgramMic.start : isWebSpeech ? webSpeech.start : () => {};
  const onMicPointerUp = isDeepgram ? deepgramMic.stop : isWebSpeech ? webSpeech.stop : () => {};

  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);

  async function handleConfirmExit(): Promise<void> {
    await close();
    navigate('/medico');
  }

  // Mismo guardado de sesión que "Cambiar a Dr", pero sin navegar: se queda
  // en /paciente y vuelve a la pantalla de inicio (reset del sessionId) para
  // poder arrancar una conversación nueva.
  async function handleConfirmEnd(): Promise<void> {
    await close();
    setDraft('');
    setDraftHasVoice(false);
    setIsEndModalOpen(false);
    reset();
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
        secondaryExtra={
          sessionId ? (
            <button
              type="button"
              aria-label="Terminar conversación"
              onClick={() => setIsEndModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[14px] py-[9px] text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
            >
              <LogOut size={14} strokeWidth={1.7} />
              <span className="hidden sm:inline">Terminar conversación</span>
            </button>
          ) : undefined
        }
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
        <main className="mx-auto flex h-[calc(100vh-72px)] w-full max-w-[720px] flex-col overflow-hidden border-x border-border">
          {(isDeepgram || isWebSpeech) && (
            <div className="flex items-center justify-end gap-2 border-b border-border px-5 py-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.03em] text-tx-muted">Velocidad de voz</span>
              <SpeedControl rate={speechRate} onChange={setSpeechRate} disabled={isResponding} />
            </div>
          )}
          <ChatView
            turns={turns}
            streamingText={streamingText}
            isStreaming={isStreaming}
            error={error}
            isSynthesizingVoice={isSynthesizingVoice}
          />
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            micState={micState}
            onMicPointerDown={onMicPointerDown}
            onMicPointerUp={onMicPointerUp}
            disabled={isResponding}
            showStopVoice={showStopVoice}
            onRequestStopVoice={handleRequestStopVoice}
          />
        </main>
      )}

      {isExitModalOpen && (
        <ConfirmModal
          title="¿Cambiar a vista médico?"
          message="Esto finaliza tu sesión actual con el asistente. Tu conversación se guardará antes de salir."
          confirmLabel="Cambiar a vista médico"
          pendingLabel="Guardando…"
          isPending={isClosing}
          onCancel={() => setIsExitModalOpen(false)}
          onConfirm={() => void handleConfirmExit()}
        />
      )}

      {isEndModalOpen && (
        <ConfirmModal
          title="¿Terminar la conversación?"
          message="Tu conversación se guardará y podrás empezar una nueva desde el inicio."
          confirmLabel="Terminar conversación"
          pendingLabel="Guardando…"
          isPending={isClosing}
          onCancel={() => setIsEndModalOpen(false)}
          onConfirm={() => void handleConfirmEnd()}
        />
      )}

      {isStopVoiceModalOpen && (
        <ConfirmModal
          title="¿Detener al asistente?"
          message="Se corta el audio que está sonando o por sonar. El asistente queda disponible de inmediato para tu próximo mensaje."
          confirmLabel="Detener"
          onCancel={() => setIsStopVoiceModalOpen(false)}
          onConfirm={handleConfirmStopVoice}
        />
      )}
    </>
  );
}
