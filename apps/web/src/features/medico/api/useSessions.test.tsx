import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSessions } from './useSessions';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const sessionFixture = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'SES-4821',
  date: '2026-08-04',
  time: '09:12',
  patientName: 'Marcela Ortiz',
  procedure: 'Consulta preoperatoria',
  status: 'ok',
  kbVersion: 1,
  summary: 'Resumen',
  structuredSummary: null,
  createdAt: '2026-08-04T09:12:00.000Z',
  email: 'marcela@example.com',
  phone: '3001234567',
  closedAt: null,
  lastActivityAt: '2026-08-04T09:12:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSessions', () => {
  it('devuelve las sesiones cuando la API responde con datos válidos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([sessionFixture]),
      }),
    );

    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].code).toBe('SES-4821');
  });

  it('pasa a estado de error si la respuesta no cumple el esquema', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ code: 'SES-4821' }]),
      }),
    );

    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('pasa a estado de error si la API responde con un status no ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) }),
    );

    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
