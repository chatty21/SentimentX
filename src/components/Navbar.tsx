import Link from "next/link";
import UserMenu from "@/components/UserMenu";

export default function Navbar() {
  return (
    <header className="w-full border-b border-zinc-900 bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="font-semibold text-white">
          SentimentX
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <Link href="/dashboard" className="text-zinc-300 hover:text-white">
            Dashboard
          </Link>
          <Link href="/about" className="text-zinc-300 hover:text-white">
            About
          </Link>
          <Link href="/portfolio" className="text-zinc-300 hover:text-white">
            Portfolio
          </Link>

          {/* Dropdown email + logout */}
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}