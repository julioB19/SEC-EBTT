export default function DocentePage() {
  return (
    <main className="min-h-[60vh]">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Cabeçalho */}
        <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Módulo do Docente
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Gerencie seus processos de progressão e promoção.
            </p>
          </div>
        </header>

        {/* Cards / Conteúdo */}
        <section className="space-y-6">

          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                          rounded-2xl shadow-sm p-6 space-y-2">
            <p className="text-[var(--text-primary)]">
              Bem-vindo ao módulo do Docente! Aqui você pode abrir novos processos
              de progressão/promoção e acompanhar o andamento dos processos em andamento.
            </p>
          </div>

          {/* Atalhos rápidos */}
          <div className="grid sm:grid-cols-2 gap-4">

            <a
              href="/docente/processos"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Meus processos
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Acompanhe o andamento, visualize detalhes e edite processos em rascunho.
              </p>
            </a>

            <a
              href="/docente/processos/abrir"
              className="block bg-[var(--surface-bg)] border border-[var(--border-subtle)]
                         hover:border-[var(--border-strong)] transition
                         rounded-2xl p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Abrir novo processo
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Inicie um novo processo de progressão ou promoção.
              </p>
            </a>

          </div>
        </section>

      </div>
    </main>
  )
}
