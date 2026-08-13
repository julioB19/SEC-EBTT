import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export default async function AdminPage() {
  const jar = await cookies()
  const access = jar.get("accessToken")?.value
  if (!access) redirect("/login")

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Cabeçalho */}
        <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Módulo Administrador
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Gerencie usuários, configurações e tabelas do sistema.
            </p>
          </div>
        </header>

        {/* Cards / Conteúdo */}
        <section className="space-y-6">
          <div
            className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                       rounded-2xl shadow-sm p-6 space-y-2"
          >
            <p className="text-[var(--text-primary)]">
              Bem-vindo ao módulo de administração! Aqui você pode manter cadastros,
              revisar configurações gerais e gerenciar as tabelas de pontuação.
            </p>
          </div>

          {/* Atalhos rápidos */}
          <div className="grid sm:grid-cols-2 gap-4">
            <a
              href="/admin/usuarios"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Usuários
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Cadastre, edite, ative/inative e gerencie permissões de acesso.
              </p>
            </a>

            <a
              href="/admin/tabelas-pontuacao"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Tabelas de Pontuação
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Crie e gerencie as tabelas de atividades, pesos e critérios do sistema.
              </p>
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
