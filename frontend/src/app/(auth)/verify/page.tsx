'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
export default function Verify(){const [code,setCode]=useState('');const [error,setError]=useState('');const router=useRouter();const setSession=useAuthStore(s=>s.setSession);async function submit(e:React.FormEvent){e.preventDefault();const identifier=sessionStorage.getItem('signal-identifier')||'';try{const result=await authApi.verifyOtp(identifier,code);setSession(result.token,result.user);router.replace(result.is_new_user?'/profile':'/');}catch(err){setError(err instanceof Error?err.message:'Code could not be verified.')}}return <section className="auth-card"><h1>Enter verification code</h1><p>Use the code sent to {typeof window!=='undefined'?sessionStorage.getItem('signal-identifier'):''}.</p><form onSubmit={submit}><Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" error={error}/><small>Use 123456</small><Button variant="primary">Continue</Button></form></section>}
