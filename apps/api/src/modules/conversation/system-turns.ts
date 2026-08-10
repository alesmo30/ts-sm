/**
 * Texto del turno `who: 'system'` que marca una actualización de conocimiento
 * (DESIGN.md §4.13). Sin los guiones: los dibuja el componente, no el dato.
 * La hora se formatea acá, en el servidor, para que la vista read-only del
 * médico muestre exactamente lo que vio el paciente.
 */
export function buildKnowledgeUpdateText(referenceName: string, at: Date = new Date()): string {
  const hours = String(at.getHours()).padStart(2, '0');
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `Base de conocimiento actualizada · ${referenceName} · ${hours}:${minutes}`;
}
