'use client';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { BellOff } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import type { Conversation } from '@/types/models';
export function ConversationItem({conversation:c,selected}:{conversation:Conversation;selected:boolean}){const peer=c.participants[0];const title=c.title||peer?.display_name||'Conversation';const preview=c.last_message?.body||'Start a conversation';const muted=Boolean(c.muted_until&&new Date(c.muted_until).getTime()>Date.now());return <Link className={`conversation-item ${selected?'selected':''} ${c.unread_count?'unread':''}`} href={`/chat/${c.id}`}><Avatar name={title} color={c.avatar_color} imageUrl={peer?.avatar_url} online={c.is_online}/><span className="conversation-copy"><span className="conversation-title"><b>{title}</b><time>{c.last_activity_at?formatDistanceToNow(new Date(c.last_activity_at),{addSuffix:false}):''}</time></span><span className="conversation-preview">{c.type==='group'&&c.last_message?`${c.last_message.sender.display_name}: `:''}{preview}{muted&&<BellOff size={13}/>}</span></span>{c.unread_count>0&&<span className="unread-badge">{c.unread_count}</span>}</Link>}
