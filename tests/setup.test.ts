// tests/setup.test.ts
import { describe, expect, it } from 'vitest';

describe('Vitest Basiskonfiguration', () => {
  it('lädt und evaluiert mathematische Bedingungen fehlerfrei', () => {
    expect(2 + 2).toBe(4);
  });
});