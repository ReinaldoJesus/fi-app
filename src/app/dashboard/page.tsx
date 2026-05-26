import { auth } from "@/auth"
import { logout } from "@/app/actions/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Bienvenido, {session.user?.name ?? session.user?.email}</h1>
        <p className="text-gray-400 mb-6">Dashboard en construcción 🚧</p>
        <form action={logout}>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm border border-gray-700 transition"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
