import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      /** Sign-in method of this session: "google", "github" or "credentials". */
      provider?: string
    } & DefaultSession["user"]
  }
}
