import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { matchesContactQuery, sortAndGroupContacts } from './contacts';

const contact = (id: string, display_name: string, extras = {}) => ({
  id,
  display_name,
  ...extras,
});

test('sorts case-insensitively and ignores accents while retaining duplicate names', () => {
  const groups = sortAndGroupContacts(
    [
      contact('z', 'Élodie'),
      contact('b', 'bruno'),
      contact('a2', 'Álvaro'),
      contact('a1', 'alvaro'),
      contact('a3', 'ALVARO'),
      contact('a4', 'alice'),
    ],
    'en-US',
  );

  assert.deepEqual(
    groups.map(({ letter }) => letter),
    ['A', 'B', 'E'],
  );
  assert.deepEqual(
    groups[0].contacts.map(({ id }) => id),
    ['a4', 'a1', 'a2', 'a3'],
  );
  assert.equal(groups[0].contacts.length, 4);
});

test('places number- and emoji-leading names in the final # group', () => {
  const groups = sortAndGroupContacts(
    [contact('emoji', '😀 Eva'), contact('number', '2Fast'), contact('name', 'Maya')],
    'en-US',
  );

  assert.deepEqual(
    groups.map(({ letter }) => letter),
    ['M', '#'],
  );
  assert.deepEqual(
    groups[1].contacts.map(({ id }) => id),
    ['emoji', 'number'],
  );
});

test('search matches names, phone numbers, and usernames without accent or case sensitivity', () => {
  const value = contact('a', 'Élodie Martin', {
    phone_number: '+33 600 123 456',
    username: 'elo_martin',
  });

  assert.equal(matchesContactQuery(value, 'elodie'), true);
  assert.equal(matchesContactQuery(value, '600 123'), true);
  assert.equal(matchesContactQuery(value, 'ELO_MARTIN'), true);
  assert.equal(matchesContactQuery(value, 'nobody'), false);
});
