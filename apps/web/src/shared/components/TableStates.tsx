interface TableStatesProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  query?: string;
  onRetry: () => void;
}

const SKELETON_ROWS = 4;

export function TableStates({ isLoading, isError, isEmpty, query, onRetry }: TableStatesProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-2" role="status" aria-label="Cargando">
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <div key={index} className="h-[42px] animate-pulse rounded-[8px] bg-surface-2" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-[13px] text-muted">No se pudo cargar la información.</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-border-mid px-[14px] py-[8px] text-[13px] font-medium text-fg transition-colors duration-150 hover:border-fg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (isEmpty) {
    if (query) {
      return (
        <p className="py-10 text-center text-[13px] text-muted">Sin resultados para «{query}»</p>
      );
    }
    return <p className="py-10 text-center text-[13px] text-muted">No hay registros todavía.</p>;
  }

  return null;
}
