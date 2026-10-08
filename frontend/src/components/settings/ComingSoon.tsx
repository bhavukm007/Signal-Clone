'use client';
import { useUiStore } from '@/store/uiStore';

export function ComingSoon({ name }: { name: string }) {
  const notify = useUiStore((state) => state.notify);
  return (
    <button className="settings-link" onClick={() => notify(`${name} are coming soon.`)}>
      {name}
      <span>Coming Soon</span>
    </button>
  );
}
