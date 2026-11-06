import { redirect } from "next/navigation"

// The proxy sends signed-out users to /login, so "/" only needs to forward to the app.
export default function Home() {
  redirect("/dashboard")
}
