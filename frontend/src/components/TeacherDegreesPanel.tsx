"use client"
import { fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/systemStyles"
import { FormEvent, useEffect, useState } from "react"
type Degree = { idTeacherDegree: number; degreeType: string; course: string; institution: string; conclusionDate: string; countryCode: string; evidenceFileId?: number; recognitionFileId?: number }
const field = fieldClass
export default function TeacherDegreesPanel() {
  const [degrees, setDegrees] = useState<Degree[]>([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  async function request(path: string, body?: unknown) {
    const response = await fetch(`/api/sec-ebtt/teacher/${path}`, { method: body ? "POST" : "GET", headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined })
    const json = await response.json(); if (!response.ok) throw new Error(json.message || "Falha na operação"); return json.data
  }
  useEffect(() => { request("degrees").then(setDegrees).catch(error => setMessage(error.message)) }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f=new FormData(event.currentTarget); const form=event.currentTarget; setBusy(true); setMessage("")
    try {
      const upload=new FormData(); upload.set("file", f.get("file")!); const evidence=await request("evidence",upload)
      const recognition=f.get("recognition") as File; let recognitionFileId: number | undefined
      if (recognition?.size) { const other=new FormData(); other.set("file",recognition); recognitionFileId=(await request("evidence",other)).idEvidenceFile }
      setDegrees(await request("degrees",{ degreeType:f.get("degreeType"), course:f.get("course"), institution:f.get("institution"), conclusionDate:f.get("conclusionDate"), countryCode:f.get("countryCode"), evidenceFileId:evidence.idEvidenceFile, recognitionFileId }))
      form.reset();setMessage("Titulação salva. O diploma pode ser reutilizado nos processos.")
    } catch(error) {setMessage(error instanceof Error?error.message:"Falha ao salvar")} finally {setBusy(false)}
  }
  return <section className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 text-sm"><h2 className="text-base font-semibold">Titulações e diplomas</h2>{message&&<p role="status">{message}</p>}<ul>{degrees.map(d=><li className="my-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted-bg)] p-4 leading-relaxed break-words" key={d.idTeacherDegree}>{d.course} · {d.institution} · conclusão em {new Date(d.conclusionDate).toLocaleDateString("pt-BR",{timeZone:"UTC"})} · {d.countryCode}{d.evidenceFileId && <> · <a className="underline" href={`/api/evidencias/${d.evidenceFileId}/conteudo`} target="_blank" rel="noreferrer">Abrir diploma</a></>}{d.recognitionFileId && <> · <a className="underline" href={`/api/evidencias/${d.recognitionFileId}/conteudo`} target="_blank" rel="noreferrer">Abrir reconhecimento</a></>}</li>)}</ul><details><summary className={`${secondaryButtonClass} cursor-pointer`}>Cadastrar titulação</summary><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
    <label className="block space-y-1 text-sm">Titulação<select name="degreeType" className={field}><option value="GRADUATION">Graduação</option><option value="SPECIALIZATION">Especialização</option><option value="MASTERS">Mestrado</option><option value="DOCTORATE">Doutorado</option></select></label>
    <label className="block space-y-1 text-sm">Curso<input name="course" required className={field}/></label><label className="block space-y-1 text-sm">Instituição<input name="institution" required className={field}/></label><label className="block space-y-1 text-sm">Data de conclusão<input name="conclusionDate" type="date" required className={field}/></label><label className="block space-y-1 text-sm">País de obtenção, código de duas letras<input name="countryCode" defaultValue="BR" pattern="[A-Za-z]{2}" maxLength={2} required className={field}/></label><label className="block space-y-1 text-sm">Diploma em PDF<input name="file" type="file" accept="application/pdf" required className={field}/></label><label className="block space-y-1 text-sm">Reconhecimento nacional, obrigatório para diploma estrangeiro<input name="recognition" type="file" accept="application/pdf" className={field}/></label><button className={primaryButtonClass} disabled={busy}>Salvar titulação</button>
    </form></details></section>
}
