import Link from "next/link"
import RoleSwitcherServer from "@/components/RoleSwitcherServer"
import { ProfileMenuShell } from "@/components/ProfileMenuShell"
import { logoutAction } from "@/utils/logoutAction"

export function ProfileMenu() {
  return (
    <ProfileMenuShell>
      <Link
        href="/perfil"
        className="block px-4 py-2 text-xs font-semibold uppercase tracking-wide
                   hover:bg-[var(--gray-800)]"
      >
        Editar perfil
      </Link>

      <RoleSwitcherServer />

      <button
        type="button"
        onClick={logoutAction}
        className="mt-2 block w-full text-left px-4 py-2 text-xs font-semibold uppercase
                   tracking-wide text-[#fca5a5] hover:bg-[var(--gray-800)]"
      >
        Sair
      </button>
    </ProfileMenuShell>
  )
}
