import test from 'node:test';
import assert from 'node:assert/strict';
import { percent } from '../src/format.ts';

test('signs gaps and never shows a negative zero', () => {
  assert.equal(percent(61.2), '+0.61%');
  assert.equal(percent(-5.4), '-0.05%');
  assert.equal(percent(-0.3), '0.00%');
  assert.equal(percent(0.4), '0.00%');
  assert.equal(percent(0), '0.00%');
});
