import test from 'node:test';
import assert from 'node:assert/strict';
import { protectSwap, jupiterSwapUrl } from '../src/protect.ts';

test('a quote under the ceiling yields a slippage that keeps every fill under it', () => {
  // $1,000 at $770 per token against a $774.60 issuer price with a 0.50% limit.
  const p = protectSwap(1000, 1000 / 770, 774.6, 50);
  assert.equal(p.kind, 'protect');
  const worstTokens = (1000 / 770) * (1 - p.maxSlippageBps / 10_000);
  assert.ok(worstTokens >= p.minTokens, 'worst accepted fill receives at least the minimum');
  assert.ok(1000 / p.minTokens <= p.ceiling + 1e-9, 'the minimum never prices above the ceiling');
});

test('a quote above the ceiling is refused with how far over it is', () => {
  // The October 8 phone check: $779.48 route, $774.60 issuer, 0.50% limit.
  const p = protectSwap(1000, 1000 / 779.48, 774.6, 50);
  assert.equal(p.kind, 'above');
  assert.ok(p.overBps > 0 && p.overBps < 20, `over by ${p.overBps} bp`);
});

test('a quote within one slippage step of the ceiling is reported as too tight', () => {
  const ceiling = 774.6 * 1.005;
  const p = protectSwap(1000, (1000 / ceiling) * 1.00005, 774.6, 50);
  assert.equal(p.kind, 'tight');
});

test('the invariant holds across random inputs', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5000; i++) {
    const amount = 100 + rand() * 100_000;
    const issuer = 10 + rand() * 1000;
    const band = Math.floor(rand() * 200);
    const fill = issuer * (0.98 + rand() * 0.04);
    const p = protectSwap(amount, amount / fill, issuer, band);
    if (p.kind !== 'protect') continue;
    const worstPrice = amount / ((amount / fill) * (1 - p.maxSlippageBps / 10_000));
    assert.ok(worstPrice <= p.ceiling * (1 + 1e-12), `case ${i}: worst ${worstPrice} > ceiling ${p.ceiling}`);
  }
});

test('invalid inputs throw instead of returning a setting', () => {
  assert.throws(() => protectSwap(0, 1, 1, 50));
  assert.throws(() => protectSwap(100, 1, 0, 50));
});

test('the Jupiter link carries both mints in the query form', () => {
  assert.equal(jupiterSwapUrl('A', 'B'), 'https://jup.ag/?sell=A&buy=B');
});
