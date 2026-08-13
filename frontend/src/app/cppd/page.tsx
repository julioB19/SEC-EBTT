import { redirect } from "next/navigation"
import { cookies } from "next/headers"

export default async function CppdPage() {
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
              Módulo CPPD
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Acompanhe, analise e registre pareceres sobre os processos dos docentes.
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
              Bem-vindo ao módulo da CPPD! Aqui você pode consultar os processos
              submetidos, acompanhar o fluxo de análise e registrar decisões sobre
              progressão e promoção na carreira docente EBTT.
            </p>
          </div>

          {/* Atalhos rápidos */}
          <div className="grid sm:grid-cols-2 gap-4">

            <a
              href="/cppd/processos"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Processos
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Visualize processos em rascunho, submetidos, em análise, aprovados,
                devolvidos ou indeferidos.
              </p>
            </a>

            <a
              href="/cppd/tabelas"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Tabela de pontuação vigente
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Consulte a tabela vigente (blocos e itens) utilizada na avaliação
                dos processos.
              </p>
            </a>

            <a
              href="/cppd/usuarios"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Docentes
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Consulte os docentes cadastrados, visualize seus dados,
                edite o email e envie link para redefinição de senha.
              </p>
            </a>

          </div>
        </section>

      </div>
    </main>
  )
}
