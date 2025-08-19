// src/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true, // useful in dev
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async jwt({ token, account, profile }) {
      // attach provider info if needed
      if (account?.provider) token.provider = account.provider;
      return token;
    },
    async session({ session, token }) {
      // expose email & provider
      (session as any).provider = token.provider;
      return session;
    },
  },
});