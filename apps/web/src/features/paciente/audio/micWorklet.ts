// Servido desde public/worklets/mic-processor.js, fuera del pipeline de
// módulos de Vite: new URL('./x.ts', import.meta.url) y su variante ?url no
// empaquetan nada de forma confiable para AudioWorklets en el build de
// producción (probado y descartado — ver fricciones de SPEC 06).
const WORKLET_URL = '/worklets/mic-processor.js';

/** Registra el procesador PCM 16kHz mono y devuelve el nodo listo para conectar. */
export async function createMicWorkletNode(context: AudioContext): Promise<AudioWorkletNode> {
  await context.audioWorklet.addModule(WORKLET_URL);
  return new AudioWorkletNode(context, 'mic-processor');
}
