import type { ReactNode } from "react"
export type ProcessStep = { title: string; description: string; status?: "done" | "current" | "pending" }
export default function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return <section aria-label="Etapas do preenchimento" className="my-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5">
    <h2 className="text-base font-semibold text-[var(--text-primary)]">Como proceder</h2>
    <ol className="mt-4 grid gap-4 md:grid-cols-3">{steps.map((step, index) => <li key={step.title} aria-current={step.status === "current" ? "step" : undefined} className="flex gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${step.status === "done" ? "bg-emerald-50 text-emerald-800" : step.status === "current" ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]" : "bg-slate-100 text-slate-700"}`}>{step.status === "done" ? <span aria-label="Concluído">✓</span> : index + 1}</span>
      <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{step.description}</p></div>
    </li>)}</ol>
  </section>
}

export function ProcessSection({ number, title, description, children }: { number: number; title: string; description: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5"><h2 className="text-base font-semibold">{number}. {title}</h2><p className="text-sm text-[var(--text-secondary)]">{description}</p>{children}</section>
}
