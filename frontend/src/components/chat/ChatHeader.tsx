'use client';

import { ArrowLeft, MoreVertical, Phone, Search, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { lastSeenTime } from '@/lib/formatters';
import { useUiStore } from '@/store/uiStore';
import type { User } from '@/types/models';

export function ChatHeader({
  title,
  peer,
  online,
  lastSeenAt,
  conversationType,
  memberCount,
  onBack,
  onSearch,
}: {
  title: string;
  peer?: User;
  online: boolean;
  lastSeenAt?: string | null;
  conversationType: 'direct' | 'group';
  memberCount: number;
  onBack: () => void;
  onSearch: () => void;
}) {
  return (
    <header className="chat-header">
      <button className="icon-button mobile-back" onClick={onBack} aria-label="Back">
        <ArrowLeft />
      </button>
      <button
        className="chat-identity-button"
        aria-label={`Open ${title} info`}
        onClick={() => useUiStore.getState().openModal('conversation-info')}
      >
        <Avatar
          name={title}
          color={peer?.avatar_color}
          imageUrl={peer?.avatar_url}
          online={online}
        />
        <span className="chat-heading">
          <b>{title}</b>
          <small>
            {conversationType === 'group'
              ? `${memberCount} members`
              : online
                ? 'online'
                : lastSeenAt
                  ? `last seen ${lastSeenTime(lastSeenAt)}`
                  : 'offline'}
          </small>
        </span>
      </button>
      <button
        className="icon-button"
        aria-label="Voice call"
        onClick={() => useUiStore.getState().notify('Voice calls are coming soon.')}
      >
        <Phone />
      </button>
      <button
        className="icon-button"
        aria-label="Video call"
        onClick={() => useUiStore.getState().notify('Video calls are coming soon.')}
      >
        <Video />
      </button>
      <button className="icon-button" aria-label="Search messages" onClick={onSearch}>
        <Search />
      </button>
      <button
        className="icon-button"
        aria-label="More options"
        onClick={() => useUiStore.getState().openModal('conversation-info')}
      >
        <MoreVertical />
      </button>
    </header>
  );
}
