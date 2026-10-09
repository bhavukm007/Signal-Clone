'use client';

import type { User } from '@/types/models';
import { UserAvatar } from '@/components/ui/Avatar';
import { SidePanel } from '@/components/ui/SidePanel';
import { formatPhoneNumber } from '@/lib/formatters';

export function ContactProfilePanel({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <SidePanel title="Profile" onClose={onClose}>
      <div className="contact-profile-summary">
        <UserAvatar user={user} size="normal" />
        <h3>{user.display_name}</h3>
        {user.about && <p>{user.about}</p>}
      </div>
      <dl className="contact-profile-fields">
        {user.phone_number && (
          <div>
            <dt>Phone</dt>
            <dd>{formatPhoneNumber(user.phone_number)}</dd>
          </div>
        )}
        {user.username && (
          <div>
            <dt>Username</dt>
            <dd>@{user.username}</dd>
          </div>
        )}
      </dl>
    </SidePanel>
  );
}
