"use client"

import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import { useEffect, useState } from "react"

export type ProcessEvidenceFile = {
  idEvidenceFile: number
  originalName: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedAt: string
}

export type RscProcessDetails = {
  targetLevel: string | null
  reportFile: ProcessEvidenceFile | null
}

export type FullProfessorProcessDetails = {
  evaluationMode: "MEMORIAL" | "THESIS" | null
  finalReferenceDate: string | null
  memorialFile: ProcessEvidenceFile | null
  thesisFile: ProcessEvidenceFile | null
  doctorateDegree: {
    idTeacherDegree: number
    degreeType: string
    course: string | null
    institution: string | null
    conclusionDate: string | null
    evidenceFile: ProcessEvidenceFile | null
  } | null
}

type Props<TProcess> = {
  processId: number
  category: string | null
  editable: boolean
  rscDetails: RscProcessDetails | null
  fullProfessorDetails: FullProfessorProcessDetails | null
  onUpdated: (process: TProcess) => void
  notify: (payload: {
    title: string
    message: string
    variant: "success" | "error" | "info"
  }) => void
}

type DocumentKind =
  | "RSC_REPORT"
  | "FULL_PROFESSOR_MEMORIAL"
  | "FULL_PROFESSOR_THESIS"
  | "DOCTORATE_DEGREE"

function formatFileSize(size: number | null) {
  if (!size) return ""
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}

function FileLink({ file }: { file: ProcessEvidenceFile | null }) {
  if (!file) {
    return <span className="text-xs text-[var(--text-muted)]">Nenhum arquivo anexado.</span>
  }

  return (
    <a
      href={`/api/evidencias/${file.idEvidenceFile}/conteudo`}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-medium text-emerald-700 hover:underline break-all"
    >
      {file.originalName}
      {file.sizeBytes ? ` (${formatFileSize(file.sizeBytes)})` : ""}
    </a>
  )
}

export default function SpecificProcessDocuments<TProcess>({
  processId,
  category,
  editable,
  rscDetails,
  fullProfessorDetails,
  onUpdated,
  notify
}: Props<TProcess>) {
  const [files, setFiles] = useState<Partial<Record<DocumentKind, File>>>({})
  const [uploading, setUploading] = useState<DocumentKind | null>(null)
  const [course, setCourse] = useState("")
  const [institution, setInstitution] = useState("")
  const [conclusionDate, setConclusionDate] = useState("")

  useEffect(() => {
    const degree = fullProfessorDetails?.doctorateDegree
    setCourse(degree?.course ?? "")
    setInstitution(degree?.institution ?? "")
    setConclusionDate(degree?.conclusionDate?.slice(0, 10) ?? "")
  }, [fullProfessorDetails?.doctorateDegree])

  if (category !== "RSC" && category !== "FULL_PROFESSOR") return null

  async function uploadDocument(kind: DocumentKind) {
    const file = files[kind]
    if (!file) {
      notify({
        title: "Selecione um arquivo",
        message: "Escolha um arquivo PDF antes de anexar.",
        variant: "error"
      })
      return
    }

    if (
      kind === "DOCTORATE_DEGREE" &&
      (!course.trim() || !institution.trim() || !conclusionDate)
    ) {
      notify({
        title: "Dados incompletos",
        message: "Informe o curso, a instituição e a data de conclusão do doutorado.",
        variant: "error"
      })
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    if (kind === "DOCTORATE_DEGREE") {
      formData.append("course", course.trim())
      formData.append("institution", institution.trim())
      formData.append("conclusionDate", conclusionDate)
    }

    setUploading(kind)
    try {
      const response = await fetch(
        `/api/processos/${processId}/documentos/${kind}`,
        { method: "POST", credentials: "include", body: formData }
      )
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.data) {
        notify({
          title: "Não foi possível anexar",
          message: body?.message || "Verifique o arquivo e tente novamente.",
          variant: "error"
        })
        return
      }

      onUpdated(body.data as TProcess)
      setFiles(current => ({ ...current, [kind]: undefined }))
      notify({
        title: "Documento anexado",
        message: "O documento foi vinculado ao processo com sucesso.",
        variant: "success"
      })
    } catch (error: any) {
      notify({
        title: "Erro inesperado",
        message: error?.message || "Não foi possível anexar o documento.",
        variant: "error"
      })
    } finally {
      setUploading(null)
    }
  }

  function UploadControl({
    kind,
    label,
    currentFile
  }: {
    kind: DocumentKind
    label: string
    currentFile: ProcessEvidenceFile | null
  }) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
        <FileLink file={currentFile} />
        {editable && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <FormInput
              type="file"
              accept=".pdf,application/pdf"
              onChange={event => {
                const selected = event.target.files?.[0]
                setFiles(current => ({ ...current, [kind]: selected }))
              }}
              className="min-w-0 flex-1 text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--btn-secondary-border)] file:bg-[var(--surface-bg)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--btn-secondary-text)]"
            />
            <ActionButton
              type="button"
              onClick={() => uploadDocument(kind)}
              disabled={uploading !== null || !files[kind]}
              className="shrink-0 rounded-md bg-[var(--btn-primary-bg)] px-3 py-2 text-xs font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50"
             disabledReason={(uploading !== null) ? "Aguarde a operação em andamento terminar." : (!files[kind]) ? "Selecione o arquivo que deseja anexar antes de continuar." : "Este controle está indisponível na etapa atual."} >
              {uploading === kind ? "Enviando..." : currentFile ? "Substituir" : "Anexar"}
            </ActionButton>
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Documentação específica
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Arquivos permitidos: PDF, com até 5 MB.
        </p>
      </div>

      {category === "RSC" && (
        <UploadControl
          kind="RSC_REPORT"
          label="Relatório descritivo ou memorial do RSC"
          currentFile={rscDetails?.reportFile ?? null}
        />
      )}

      {category === "FULL_PROFESSOR" && fullProfessorDetails && (
        <div className="space-y-5">
          <UploadControl
            kind={
              fullProfessorDetails.evaluationMode === "THESIS"
                ? "FULL_PROFESSOR_THESIS"
                : "FULL_PROFESSOR_MEMORIAL"
            }
            label={
              fullProfessorDetails.evaluationMode === "THESIS"
                ? "Tese acadêmica inédita"
                : "Memorial"
            }
            currentFile={
              fullProfessorDetails.evaluationMode === "THESIS"
                ? fullProfessorDetails.thesisFile
                : fullProfessorDetails.memorialFile
            }
          />

          <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                Doutorado
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                O diploma e a data de conclusão são obrigatórios para o envio.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                Curso
                <FormInput
                  value={course}
                  onChange={event => setCourse(event.target.value)}
                  disabled={!editable}
                  className="rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                 disabledReason={(!editable) ? "Os dados só podem ser alterados enquanto o processo estiver em rascunho ou devolvido." : "Este controle está indisponível na etapa atual."}  aria-label="Curso" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                Instituição
                <FormInput
                  value={institution}
                  onChange={event => setInstitution(event.target.value)}
                  disabled={!editable}
                  className="rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                 disabledReason={(!editable) ? "Os dados só podem ser alterados enquanto o processo estiver em rascunho ou devolvido." : "Este controle está indisponível na etapa atual."}  aria-label="Instituição" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                Conclusão
                <FormInput
                  type="date"
                  value={conclusionDate}
                  onChange={event => setConclusionDate(event.target.value)}
                  disabled={!editable}
                  className="rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm text-[var(--text-primary)] disabled:opacity-70"
                 disabledReason={(!editable) ? "Os dados só podem ser alterados enquanto o processo estiver em rascunho ou devolvido." : "Este controle está indisponível na etapa atual."}  aria-label="Conclusão" />
              </label>
            </div>
            <UploadControl
              kind="DOCTORATE_DEGREE"
              label="Diploma de doutorado"
              currentFile={fullProfessorDetails.doctorateDegree?.evidenceFile ?? null}
            />
          </div>
        </div>
      )}
    </section>
  )
}
