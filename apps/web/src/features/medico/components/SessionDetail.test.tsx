import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionDetail } from './SessionDetail';

const baseSession = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'SES-4821',
  date: '2026-08-04',
  time: '09:12',
  patientName: 'Marcela Ortiz',
  procedure: 'Consulta preoperatoria',
  status: 'fail',
  kbVersion: 1,
  summary: 'Fiebre alta reportada, se avisó al médico.',
  createdAt: '2026-08-04T09:12:00.000Z',
  email: 'marcela@example.com',
  phone: '3001234567',
  closedAt: '2026-08-04T09:30:00.000Z',
  lastActivityAt: '2026-08-04T09:30:00.000Z',
  turns: [],
};

function mockFetch(structuredSummary: unknown) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/knowledge/state')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: 1 }) });
    }
    if (url.includes('/sessions/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...baseSession, structuredSummary }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
}

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionDetail id={baseSession.id} onBack={() => {}} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('SessionDetail — triage clínico (SPEC 10)', () => {
  it('muestra alertas, recomendaciones y cobertura cuando structuredSummary trae datos', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        recommendations: ['Reposo relativo por 48 horas.'],
        alerts: ['Fiebre de 39°C reportada.'],
        escalated: true,
        coverage: { covered: ['fiebre', 'dolor'], pending: ['movilidad', 'herida', 'apetito', 'sueño'], grouped: false },
        metrics: { turns: 4, durationSeconds: 120, ttftMs: null, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      }),
    );

    renderDetail();

    expect(await screen.findByText('Triage clínico')).toBeInTheDocument();
    expect(screen.getByText('Fiebre de 39°C reportada.')).toBeInTheDocument();
    expect(screen.getByText('· Reposo relativo por 48 horas.')).toBeInTheDocument();
    expect(screen.getByText(/Cubiertas: fiebre, dolor/)).toBeInTheDocument();
    expect(screen.getByText(/Pendientes: movilidad, herida, apetito, sueño/)).toBeInTheDocument();
  });

  it('no muestra el bloque de triage cuando structuredSummary es null', async () => {
    vi.stubGlobal('fetch', mockFetch(null));

    renderDetail();

    await screen.findByText((_, element) =>
      (element?.textContent ?? '').startsWith('Marcela Ortiz · Consulta preoperatoria ·'),
    );
    expect(screen.queryByText('Triage clínico')).not.toBeInTheDocument();
  });

  it('marca la confirmación agrupada cuando coverage.grouped es true', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        recommendations: [],
        alerts: [],
        escalated: false,
        coverage: { covered: ['dolor', 'fiebre', 'movilidad', 'herida', 'apetito', 'sueño'], pending: [], grouped: true },
        metrics: { turns: 4, durationSeconds: 60, ttftMs: null, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      }),
    );

    renderDetail();

    expect(await screen.findByText(/confirmación agrupada/)).toBeInTheDocument();
  });
});
