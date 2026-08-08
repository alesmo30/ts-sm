import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: ReactNode;
}

interface Position {
  top: number;
  left: number;
}

/**
 * Tooltip propio, no el `title` nativo del navegador: `title` tiene un delay
 * de aparición (~1s) controlado por el sistema operativo, no por CSS — no se
 * puede acortar.
 *
 * Se renderiza en un portal a document.body con position:fixed, no como hijo
 * absolute del trigger: el composer vive dentro de un contenedor con
 * overflow-hidden (para el scroll del chat), así que cualquier tooltip
 * posicionado como hijo normal queda recortado por ese ancestro sin importar
 * el z-index — z-index solo decide qué está arriba, no si algo se recorta.
 * Con position:fixed + portal, el tooltip escapa de ese overflow por completo.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  function show(): void {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.top, left: rect.left + rect.width / 2 });
  }

  function hide(): void {
    setPosition(null);
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[1000] -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md border border-border-mid bg-surface-3 px-2.5 py-1.5 text-[11.5px] text-fg shadow-sm"
            style={{ top: position.top, left: position.left }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
