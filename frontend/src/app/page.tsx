import Link from "next/link"

export default function Home() {
  return (
    <main
      className="
        min-h-screen
        flex flex-col items-center justify-center
        p-6
        bg-[var(--surface-muted)]
      "
    >
      {/* Nome do sistema */}
      <h1 className="text-3xl font-semibold text-[var(--text-primary)] mb-8">
        SEC-EBTT
      </h1>

      {/* Card principal */}
      <div
        className="
          bg-[var(--surface-card)]
          border border-[var(--border-subtle)]
          shadow-sm
          rounded-2xl
          p-6
          w-full max-w-md
          text-center
        "
      >
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Bem-vindo
        </h2>

        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Acesse sua conta ou realize seu cadastro como docente.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="
              w-full px-4 py-2 rounded-xl text-sm font-medium
              bg-[var(--btn-primary-bg)]
              text-[var(--btn-primary-text)]
              hover:bg-[var(--btn-primary-hover-bg)]
              transition
            "
          >
            Entrar
          </Link>

          <Link
            href="/register-professor"
            className="
              w-full px-4 py-2 rounded-xl text-sm font-medium
              border border-[var(--border-subtle)]
              bg-[var(--surface-card)]
              text-[var(--text-primary)]
              hover:bg-[var(--surface-muted)]
              transition
            "
          >
            Cadastrar Professor
          </Link>
        </div>
      </div>
    </main>
  )
}
