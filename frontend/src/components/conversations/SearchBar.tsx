'use client';
import { Search, X } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
export function SearchBar(){const value=useUiStore(s=>s.searchQuery);const set=useUiStore(s=>s.setSearchQuery);return <label className="search-bar"><Search size={17}/><input value={value} onChange={e=>set(e.target.value)} placeholder="Search" aria-label="Search chats"/>{value&&<button aria-label="Clear search" onClick={()=>set('')}><X size={15}/></button>}</label>}
