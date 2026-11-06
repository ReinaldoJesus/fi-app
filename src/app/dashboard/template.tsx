// Re-mounts on every dashboard navigation, so each screen eases in.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-page-in">{children}</div>
}
