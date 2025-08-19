// src/components/UserMenu.tsx
"use client";

import useSWR from "swr";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SessionResponse = {
  session?: { user?: { email?: string | null } | null } | null;
};

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

export default function UserMenu() {
  const { data, mutate } = useSWR<SessionResponse>("/api/auth/session", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
    dedupingInterval: 5_000,
  });
  const router = useRouter();
  const email = data?.session?.user?.email ?? undefined;

  async function handleLogout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    await mutate(undefined, { revalidate: false }); // clear swr cache
    router.push("/login");
  }

  // Not logged in → show plain link
  if (!email) {
    return (
      <a href="/login" className="text-sm text-zinc-300 hover:text-white transition">
        Log in
      </a>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="text-sm text-zinc-300 hover:text-white transition px-2 py-1 rounded">
          {email}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[160px] rounded-md bg-zinc-800 shadow-lg p-1 text-sm"
        >
          <DropdownMenu.Item
            onClick={handleLogout}
            className="cursor-pointer rounded px-2 py-1 text-red-400 hover:bg-red-600 hover:text-white"
          >
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}