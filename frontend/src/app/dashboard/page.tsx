// src/app/dashboard/page.tsx
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { LogoutButton } from "@/components/LogoutButton"
import RoleSwitcherServer from "@/components/RoleSwitcherServer"

export default async function DashboardPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) redirect("/login")

  return (
    <main className="p-6 flex flex-col min-h-screen bg-gray-50">
      <header className="flex justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <RoleSwitcherServer />
          <LogoutButton />
        </div>
      </header>

      <section>
        <p className="mt-2">Conteúdo protegido</p>
      </section>
    </main>
  )
}
