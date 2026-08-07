import { priceFor } from './pricing';

describe('priceFor', () => {
  it('devuelve el precio de un modelo conocido', () => {
    expect(priceFor('gpt-4o-mini')).toEqual({ inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 });
  });

  it('devuelve ceros para un modelo ausente sin lanzar', () => {
    expect(priceFor('modelo-inventado-xyz')).toEqual({ inputPerMTokUsd: 0, outputPerMTokUsd: 0 });
  });
});
