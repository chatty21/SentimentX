// src/app/page.tsx  (server component)
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function Home() {
  // If your TS complains, keep the await:
  const cookieStore = await cookies(); // or just: const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},     // no-op in server component
        remove: () => {},  // no-op in server component
      },
    }
  );

  const { data: { user } = {} } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const introSeen = cookieStore.get("intro_seen")?.value === "1";
  if (!introSeen) redirect("/welcome");

  redirect("/login");
}