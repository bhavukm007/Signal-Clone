import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatPhoneNumber, normalizePhoneNumber, normalizePhoneOrUsername } from './phone';

test('normalizes accepted Indian number formats to E.164', () => {
  for (const input of [
    '+919000000001',
    '+91 90000 00001',
    '+91-90000-00001',
    '919000000001',
    '9000000001',
  ])
    assert.equal(normalizePhoneNumber(input), '+919000000001');
  assert.equal(formatPhoneNumber('+919000000001'), '+91 90000 00001');
});

test('keeps usernames and rejects malformed numbers', () => {
  assert.equal(normalizePhoneOrUsername('maya_iyer'), 'maya_iyer');
  assert.equal(normalizePhoneNumber('+910123456789'), null);
  assert.equal(normalizePhoneNumber('123'), null);
});
