"use client"
import ErrorView from "@/components/ErrorView"

// Inside the app shell: the sidebar and top bar stay usable.
export default function DashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorView error={error} retry={unstable_retry} />
}
