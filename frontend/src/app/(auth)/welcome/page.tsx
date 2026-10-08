import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
export default function Welcome(){return <section className="welcome-card"><div className="brand-mark"><MessageCircle size={38}/></div><h1>Signal</h1><p>Say hello to a different messaging experience.</p><Link className="primary-button" href="/register">Get started</Link><small>Private. Simple. Secure.</small></section>}
