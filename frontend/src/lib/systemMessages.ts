export interface SystemMessageData {
  event?: string;
  actor_id?: string;
  target_id?: string;
  target_name?: string;
  group_name?: string;
  role?: string;
}

export function formatSystemMessage(
  body: string,
  data: SystemMessageData | null | undefined,
  currentUserId: string | undefined,
  senderName: string,
): string {
  if (!data?.event) return body;
  const actorIsViewer = data.actor_id === currentUserId;
  const targetIsViewer = data.target_id === currentUserId;
  const actor = actorIsViewer ? 'You' : senderName;
  const target = targetIsViewer ? 'you' : (data.target_name ?? 'a member');
  switch (data.event) {
    case 'group_created':
      return actorIsViewer ? 'You created the group' : `${senderName} created the group`;
    case 'member_added':
      return `${actor} added ${target}`;
    case 'member_removed':
      return `${actor} removed ${target}`;
    case 'member_left':
      return actorIsViewer ? 'You left the group' : `${senderName} left the group`;
    case 'member_role_changed':
      return data.role === 'admin'
        ? `${actor} made ${target} an admin`
        : `${actor} removed admin from ${target}`;
    case 'group_renamed':
      return `${actor} changed the group name to ${data.group_name ?? ''}`.trim();
    case 'group_updated':
      return actorIsViewer ? 'You updated the group' : `${senderName} updated the group`;
    default:
      return body;
  }
}
