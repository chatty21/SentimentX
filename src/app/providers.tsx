// src/app/providers.tsx
'use client';

export default function Providers({ children }: { children: React.ReactNode }) {
  // No NextAuth SessionProvider anymore; Supabase auth is handled per component/middleware
  return <>{children}</>;
}