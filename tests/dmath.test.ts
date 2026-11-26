import { describe, expect, it } from 'vitest';
import { datan2, dcos, dexp, dhypot, dsin } from '../src/sim/dmath';

describe('deterministic math (cross-browser lockstep)', () => {
  it('matches the platform functions closely', () => {
    for (let i = -400; i <= 400; i++) {
      const x = i * 0.137;
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-10);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-10);
      for (const y of [-3.3, -0.2, 0, 0.7, 5]) expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-10);
    }
    for (const x of [-5, -1.2, -0.06, 0, 0.3, 2]) expect(Math.abs(dexp(x) / Math.exp(x) - 1)).toBeLessThan(1e-10);
    expect(dhypot(3, 4)).toBe(5);
  });
});
