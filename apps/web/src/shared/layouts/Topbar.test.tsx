import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { Topbar } from './Topbar';

describe('Topbar', () => {
  it('renderiza la marca, el título y el switch button', () => {
    render(
      <MemoryRouter>
        <Topbar
          markLabel="Dr"
          title="Hola Doc"
          subtitle="Panel de sesiones del asistente de voz"
          switchLabel="Cambiar a paciente"
          switchTo="/paciente"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Dr')).toBeInTheDocument();
    expect(screen.getByText('Hola Doc')).toBeInTheDocument();
    expect(screen.getByText('Cambiar a paciente')).toBeInTheDocument();
  });
});
