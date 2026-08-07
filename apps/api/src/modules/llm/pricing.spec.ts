import { PRICING, priceFor } from './pricing';

describe('priceFor', () => {
  it('devuelve el precio de un modelo conocido', () => {
    const [knownModel, knownPricing] = Object.entries(PRICING)[0];
    expect(priceFor(knownModel)).toEqual(knownPricing);
  });

  it('devuelve ceros para un modelo ausente sin lanzar', () => {
    expect(priceFor('modelo-inventado-xyz')).toEqual({ inputPerMTokUsd: 0, outputPerMTokUsd: 0 });
  });
});
