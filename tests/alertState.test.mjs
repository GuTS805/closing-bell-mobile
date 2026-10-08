import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAlertState } from '../src/alertState.ts';

test('notifies once when the route moves from over the limit to within it', () => {
  assert.deepEqual(nextAlertState({ band: 50, within: false }, 42), { within: true, notify: true });
});

test('stays quiet while the route remains within the limit', () => {
  assert.deepEqual(nextAlertState({ band: 50, within: true }, 42), { within: true, notify: false });
});

test('re-arms when the route goes back over the limit', () => {
  assert.deepEqual(nextAlertState({ band: 50, within: true }, 61), { within: false, notify: false });
  assert.deepEqual(nextAlertState({ band: 50, within: false }, 61), { within: false, notify: false });
});

test('a route exactly at the limit counts as within it', () => {
  assert.equal(nextAlertState({ band: 50, within: false }, 50).notify, true);
});
