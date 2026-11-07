"use client"
import ErrorView from "@/components/ErrorView"

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <div className="bg-[#f2f2f7] dark:bg-black"><ErrorView error={error} retry={unstable_retry} fullScreen /></div>
}
