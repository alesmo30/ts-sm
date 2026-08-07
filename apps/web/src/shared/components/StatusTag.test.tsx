import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusTag } from './StatusTag';

describe('StatusTag', () => {
  it('muestra "Exitosa" con punto para la variante ok', () => {
    const { container } = render(<StatusTag variant="ok" />);
    expect(screen.getByText('Exitosa')).toBeInTheDocument();
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
  });

  it('muestra "Atención humana" para la variante attn', () => {
    render(<StatusTag variant="attn" />);
    expect(screen.getByText('Atención humana')).toBeInTheDocument();
  });

  it('muestra "No exitosa" para la variante fail', () => {
    render(<StatusTag variant="fail" />);
    expect(screen.getByText('No exitosa')).toBeInTheDocument();
  });

  it('la variante plain no muestra punto de color', () => {
    const { container } = render(<StatusTag variant="plain" />);
    expect(screen.getByText('Neutro')).toBeInTheDocument();
    expect(container.querySelector('.bg-current')).not.toBeInTheDocument();
  });
});
