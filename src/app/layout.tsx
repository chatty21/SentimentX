import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Providers from "./providers";
import UserMenu from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "SentimentX",
  description: "Live Market Sentiment Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#0a1020] text-slate-100 min-h-screen flex flex-col font-sans">
        <Providers>
          <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0a1020]/80 backdrop-blur">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <Link
                href="/"
                className="text-2xl font-extrabold tracking-tight text-blue-300 hover:text-blue-200 transition-colors"
              >
                SentimentX
              </Link>
              <nav className="flex items-center gap-6 text-sm font-medium">
                <Link href="/" className="text-slate-300 hover:text-blue-300 transition-colors">
                  Dashboard
                </Link>
                <Link href="/about" className="text-slate-300 hover:text-blue-300 transition-colors">
                  About
                </Link>
                <Link href="/portfolio" className="text-slate-300 hover:text-blue-300 transition-colors">
                  Portfolio
                </Link>
                <UserMenu />
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} <span className="font-semibold text-slate-300">SentimentX</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}