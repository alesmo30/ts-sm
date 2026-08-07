import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TableStates } from './TableStates';

describe('TableStates', () => {
  it('muestra skeleton de filas cuando está cargando', () => {
    const { container } = render(
      <TableStates isLoading isError={false} isEmpty={false} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });

  it('muestra el mensaje de error con botón de reintento', () => {
    const onRetry = vi.fn();
    render(<TableStates isLoading={false} isError isEmpty={false} onRetry={onRetry} />);
    expect(screen.getByText('No se pudo cargar la información.')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Reintentar' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('muestra el mensaje de vacío sin query', () => {
    render(<TableStates isLoading={false} isError={false} isEmpty onRetry={vi.fn()} />);
    expect(screen.getByText('No hay registros todavía.')).toBeInTheDocument();
  });

  it('muestra "Sin resultados para «X»" cuando hay query', () => {
    render(<TableStates isLoading={false} isError={false} isEmpty query="zzz" onRetry={vi.fn()} />);
    expect(screen.getByText('Sin resultados para «zzz»')).toBeInTheDocument();
  });
});
