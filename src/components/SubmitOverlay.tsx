"use client"
import { useFormStatus } from "react-dom"
import { LoadingScreen } from "./BrandLoader"

/** Drop inside a <form>: covers the screen with the brand loader while it submits. */
export default function SubmitOverlay({ label }: { label?: string }) {
  const { pending } = useFormStatus()
  return pending ? <LoadingScreen overlay label={label} /> : null
}
