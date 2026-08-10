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
  email: 'marcela@example.com',
  phone: '3001234567',
  closedAt: null,
  lastActivityAt: '2026-08-04T09:12:00.000Z',
};

const sessionDetailFixture = { ...sessionFixture, turns: [] };

function mockFetchByPath() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/stats/counts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessions: 1, priorityPatients: 0, references: 0 }),
      });
    }
    if (url.includes('/sessions/')) {
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
  it('al hacer clic en una sesión se abre su detalle con la información del paciente', async () => {
    vi.stubGlobal('fetch', mockFetchByPath());

    renderMedicoPage();

    const row = await screen.findByText('SES-4821');
    fireEvent.click(row);

    await waitFor(() => expect(screen.getByText('Volver al dashboard')).toBeInTheDocument());

    expect(
      screen.getByText((_, element) =>
        (element?.textContent ?? '').startsWith('Marcela Ortiz · Consulta preoperatoria ·'),
      ),
    ).toBeInTheDocument();
  });
});
