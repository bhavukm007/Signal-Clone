import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatSystemMessage } from './systemMessages';

test('formats group changes from the actor and target member perspective', () => {
  const added = {
    event: 'member_added',
    actor_id: 'actor',
    target_id: 'target',
    target_name: 'Isha Kapoor',
  };
  assert.equal(formatSystemMessage('', added, 'actor', 'Aarav Mehta'), 'You added Isha Kapoor');
  assert.equal(formatSystemMessage('', added, 'target', 'Aarav Mehta'), 'Aarav Mehta added you');
  assert.equal(
    formatSystemMessage('', added, 'other', 'Aarav Mehta'),
    'Aarav Mehta added Isha Kapoor',
  );
});

test('keeps leave and role-change notices concise and uses supplied group data', () => {
  assert.equal(
    formatSystemMessage('', { event: 'member_left', actor_id: 'self' }, 'self', 'Isha Kapoor'),
    'You left the group',
  );
  assert.equal(
    formatSystemMessage(
      '',
      { event: 'member_role_changed', actor_id: 'admin', target_id: 'self', role: 'admin' },
      'self',
      'Aarav',
    ),
    'Aarav made you an admin',
  );
  assert.equal(
    formatSystemMessage(
      '',
      { event: 'group_renamed', actor_id: 'self', group_name: 'Design team' },
      'self',
      'Aarav',
    ),
    'You changed the group name to Design team',
  );
});
