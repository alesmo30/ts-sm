import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MedicoPage } from './MedicoPage';

const sessionFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'SES-4821',
  date: '2026-08-04',
  time: '09:12',
  patientName: 'Marcela Ortiz',
  procedure: 'Consulta preoperatoria',
  status: 'ok',
  kbVersion: 1,
  summary: 'Resumen de la sesión',
  structuredSummary: null,
  createdAt: '2026-08-04T09:12:00.000Z',
};

const sessionDetailFixture = { ...sessionFixture, turns: [] };

function mockFetchByPath() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/sessions/') ) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sessionDetailFixture) });
    }
    if (url.includes('/sessions')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([sessionFixture]) });
    }
    if (url.includes('/patients/priority')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    if (url.includes('/knowledge/state')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: 1 }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function renderMedicoPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MedicoPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MedicoPage — selección de fila', () => {
  it('el panel inferior deja el texto de reposo al seleccionar una sesión', async () => {
    vi.stubGlobal('fetch', mockFetchByPath());

    renderMedicoPage();

    expect(
      screen.getByText('Selecciona una sesión o un paciente para ver su información aquí.'),
    ).toBeInTheDocument();

    const row = await screen.findByText('SES-4821');
    fireEvent.click(row);

    await waitFor(() =>
      expect(
        screen.queryByText('Selecciona una sesión o un paciente para ver su información aquí.'),
      ).not.toBeInTheDocument(),
    );
  });
});
