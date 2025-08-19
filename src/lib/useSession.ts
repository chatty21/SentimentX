// src/lib/useSession.ts
'use client';

import { useEffect, useState } from 'react';

type SessionState =
  | { status: 'loading'; email?: string | null }
  | { status: 'authenticated'; email: string | null }
  | { status: 'unauthenticated'; email?: string | null };

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch('/api/auth/session', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!cancelled) {
        setState(j?.status === 'authenticated'
          ? { status: 'authenticated', email: j.email ?? null }
          : { status: 'unauthenticated' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}