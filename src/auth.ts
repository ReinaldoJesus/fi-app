import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { CredentialsSignin } from "next-auth"
import { clientIp, hit, resetRateLimit, RULES } from "@/server/rateLimit"

/** Raised by authorize() when an account or connection is over its login attempts. */
export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited"
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma as any),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Brute-force protection: per account and per connection.
        const emailKey = `login:email:${String(credentials.email).trim().toLowerCase()}`
        const [byIp, byEmail] = await Promise.all([
          hit(`login:ip:${await clientIp()}`, RULES.loginIp),
          hit(emailKey, RULES.loginEmail),
        ])
        if (!byIp.allowed || !byEmail.allowed) throw new TooManyAttempts()

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user?.password) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (valid) await resetRateLimit(emailKey)

        return valid ? user : null
      },
    }),
    // Google verifies email ownership, so a Google sign-in may attach to an
    // existing Clarifi account with the same email instead of failing with
    // OAuthAccountNotLinked.
    Google({ allowDangerousEmailAccountLinking: true }),
    GitHub,
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user, account }) {
      if (user) token.id = user.id
      // Remember how this session signed in, to badge the avatar.
      if (account) token.provider = account.provider
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      if (token.provider) session.user.provider = token.provider as string
      return session
    },
  },
})
