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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactApi, conversationApi } from '@/lib/chatApi';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/ui/Avatar';

export function Sidebar() {
 const pathname=usePathname(); const router=useRouter(); const queryClient=useQueryClient(); const user=useAuthStore(s=>s.user); const open=()=>useUiStore.getState().openModal('new-chat'); const searchRef=useRef<HTMLInputElement>(null); const query=useUiStore(s=>s.searchQuery); const term=useDebounce(query,250); const {data:conversations=[],isLoading,error}=useConversations(); const {data:people=[]}=useQuery({queryKey:['sidebar-people',term],queryFn:()=>contactApi.search(term),enabled:term.trim().length>1});
 useKeyboardShortcuts({newChat:open,focusSearch:()=>searchRef.current?.focus(),close:()=>useUiStore.getState().openModal(null),nextConversation:(direction)=>{const index=conversations.findIndex(item=>pathname===`/chat/${item.id}`);const next=conversations[(index+direction+conversations.length)%conversations.length];if(next)router.push(`/chat/${next.id}`)}});
 async function startChat(userId:string){try{const conversation=await conversationApi.direct(userId);await queryClient.invalidateQueries({queryKey:['conversations']});router.push(`/chat/${conversation.id}`)}catch{useUiStore.getState().notify('Could not start this conversation.')}}
 return <aside className="sidebar"><nav className="nav-rail"><Link href="/" aria-label="Chats"><MessageCircle/></Link><Link href="/settings" aria-label="Settings"><Settings/></Link><Link href="/settings" aria-label="Profile">{user&&<UserAvatar user={user} size="small"/>}</Link></nav><section className="conversation-sidebar"><header className="sidebar-header"><h1>Chats</h1><button className="icon-button" aria-label="New chat" onClick={open}><Pencil size={19}/></button></header><SearchBar inputRef={searchRef}/><div className="conversation-list">{isLoading&&<p className="inline-loading">Loading chats…</p>}{error&&<p className="error-state">Chats could not be loaded.</p>}{!isLoading&&!error&&conversations.length===0&&<p className="inline-loading">No conversations yet. Start a new chat.</p>}{conversations.map(item=><ConversationItem key={item.id} conversation={item} selected={pathname===`/chat/${item.id}`}/>)}{term.length>1&&people.length>0&&<><p className="list-section-title">People</p>{people.map(person=><button className="contact-row" key={person.id} onClick={()=>void startChat(person.id)}><Avatar name={person.display_name} color={person.avatar_color} online={person.is_online}/><span>{person.display_name}</span></button>)}</>}</div><button className="compose-fab" aria-label="Compose" onClick={open}><Pencil/></button></section></aside>;
}
