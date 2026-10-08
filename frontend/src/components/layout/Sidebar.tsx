'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, Settings, Pencil } from 'lucide-react';
import { UserAvatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useConversations } from '@/hooks/useConversations';
import { useUiStore } from '@/store/uiStore';
import { ConversationItem } from '@/components/conversations/ConversationItem';
import { SearchBar } from '@/components/conversations/SearchBar';

export function Sidebar() {
 const pathname=usePathname(); const user=useAuthStore(s=>s.user); const open=()=>useUiStore.getState().openModal('new-chat'); const {data:conversations=[]}=useConversations();
 return <aside className="sidebar"><nav className="nav-rail"><Link href="/" aria-label="Chats"><MessageCircle/></Link><Link href="/settings" aria-label="Settings"><Settings/></Link><Link href="/settings" aria-label="Profile">{user&&<UserAvatar user={user} size="small"/>}</Link></nav><section className="conversation-sidebar"><header className="sidebar-header"><h1>Chats</h1><button className="icon-button" aria-label="New chat" onClick={open}><Pencil size={19}/></button></header><SearchBar/><div className="conversation-list">{conversations.map(item=><ConversationItem key={item.id} conversation={item} selected={pathname===`/chat/${item.id}`}/>)}</div><button className="compose-fab" aria-label="Compose" onClick={open}><Pencil/></button></section></aside>;
}
