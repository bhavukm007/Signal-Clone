'use client';
import { Search, X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import type { RefObject } from 'react';
export function SearchBar({inputRef}:{inputRef?:RefObject<HTMLInputElement>}){const value=useUiStore(s=>s.searchQuery);const set=useUiStore(s=>s.setSearchQuery);return <label className="search-bar"><Search size={17}/><input ref={inputRef} value={value} onChange={e=>set(e.target.value)} placeholder="Search" aria-label="Search chats"/>{value&&<button aria-label="Clear search" onClick={()=>set('')}><X size={15}/></button>}</label>}
