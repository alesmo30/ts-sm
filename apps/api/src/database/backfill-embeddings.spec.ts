import { isRetryable } from './backfill-embeddings';

describe('backfill-embeddings isRetryable', () => {
  it('considera reintentable un 429', () => {
    expect(isRetryable({ status: 429 })).toBe(true);
  });

  it('considera reintentable un 5xx', () => {
    expect(isRetryable({ status: 503 })).toBe(true);
  });

  it('considera reintentable errores de red conocidos', () => {
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
    expect(isRetryable({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isRetryable({ code: 'ECONNREFUSED' })).toBe(true);
  });

  it('no reintenta un 400', () => {
    expect(isRetryable({ status: 400 })).toBe(false);
  });

  it('no reintenta un error sin status ni code reconocido', () => {
    expect(isRetryable(new Error('algo raro'))).toBe(false);
  });
});
