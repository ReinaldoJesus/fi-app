import type { Metadata } from "next"
import SignupWizard from "./SignupWizard"

export const metadata: Metadata = { title: "Crea tu Clarifi" }

/** Step-by-step signup: people build their Clarifi first, the login comes last. */
export default function SignupPage() {
  return <SignupWizard />
}
