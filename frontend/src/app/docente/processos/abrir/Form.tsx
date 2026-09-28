"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Modal from "@/components/Modal"

type LegacyProcessType = "PROGRESSAO" | "PROMOCAO"

type ProcessTypeCode =
  | "PROGRESSION"
  | "PROMOTION"
  | "RSC"
  | "FULL_PROFESSOR"
  | string

type ApiResponse<T> = {
  status: string
  message: string
  data: T | null
}

type CreatedProcess = {
  processId: number
}

type ConfiguredProcessType = {
  idProcessType: number
  code: ProcessTypeCode
  name: string
  category: string
  requiresScoring: boolean
  requiresCommittee: boolean
  requiresGecc: boolean
  active: boolean
}

type ModalVariant = "success" | "error" | "info"

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

type DocenteProfileMe = {
  siape: string
  classLevel: string
  startInterstice: string
  educationLevel: string
  assignment?: string | null
}

type UserMe = {
  name: string
  email: string
  phone: string | null
  city: string | null
  uf: string | null
  docenteProfile: DocenteProfileMe | null
}

const PROGRESSAO_MOVES = [
  { fromClass: "B", fromLevel: "1", toClass: "B", toLevel: "2", label: "B2" },
  { fromClass: "B", fromLevel: "2", toClass: "B", toLevel: "3", label: "B3" },
  { fromClass: "B", fromLevel: "3", toClass: "B", toLevel: "4", label: "B4" },
  { fromClass: "C", fromLevel: "1", toClass: "C", toLevel: "2", label: "C2" },
  { fromClass: "C", fromLevel: "2", toClass: "C", toLevel: "3", label: "C3" },
  { fromClass: "C", fromLevel: "3", toClass: "C", toLevel: "4", label: "C4" }
]

const PROMOCAO_MOVES = [
  { fromClass: "A", fromLevel: "1", toClass: "B", toLevel: "1", label: "B1" },
  { fromClass: "B", fromLevel: "4", toClass: "C", toLevel: "1", label: "C1" },
  { fromClass: "C", fromLevel: "4", toClass: "D", toLevel: "1", label: "D1" }
]

const ORIGENS_PROGRESSAO = new Set(["B1", "B2", "B3", "C1", "C2", "C3"])
const ORIGENS_PROMOCAO = new Set(["A1", "B4", "C4"])

const FALLBACK_PROCESS_TYPES: ConfiguredProcessType[] = [
  {
    idProcessType: 1,
    code: "PROGRESSION",
    name: "Progression",
    category: "CAREER",
    requiresScoring: true,
    requiresCommittee: false,
    requiresGecc: false,
    active: true
  },
  {
    idProcessType: 2,
    code: "PROMOTION",
    name: "Promotion",
    category: "CAREER",
    requiresScoring: true,
    requiresCommittee: false,
    requiresGecc: false,
    active: true
  }
]

const PROCESS_TYPE_LABELS: Record<string, string> = {
  PROGRESSION: "Progressão",
  PROMOTION: "Promoção",
  RSC: "RSC",
  FULL_PROFESSOR: "Professor Titular",
  TRAINING_LEAVE: "Afastamento",
  QUALIFICATION_PAY: "Retribuição por Titulação",
  IN_SERVICE_DEVELOPMENT: "Desenvolvimento em Serviço"
}

function mapLegacyTypeToProcessTypeCode(type: LegacyProcessType): ProcessTypeCode {
  return type === "PROMOCAO" ? "PROMOTION" : "PROGRESSION"
}

function mapProcessTypeCodeToLegacy(code: ProcessTypeCode): LegacyProcessType | null {
  if (code === "PROGRESSION") return "PROGRESSAO"
  if (code === "PROMOTION") return "PROMOCAO"
  return null
}

function getProcessTypeLabel(processType: ConfiguredProcessType) {
  return PROCESS_TYPE_LABELS[processType.code] ?? processType.name
}

export default function Form() {
  const router = useRouter()

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [siape, setSiape] = useState("")
  const [classLevel, setClassLevel] = useState("")
  const [educationLevel, setEducationLevel] = useState("")
  const [cidade, setCidade] = useState("")
  const [estado, setEstado] = useState("")

  const [selectedProcessTypeCode, setSelectedProcessTypeCode] =
    useState<ProcessTypeCode>("PROGRESSION")
  const [processTypes, setProcessTypes] = useState<ConfiguredProcessType[]>(FALLBACK_PROCESS_TYPES)
  const [loadingProcessTypes, setLoadingProcessTypes] = useState(true)
  const [campus, setCampus] = useState("")
  const [intersticioInicio, setIntersticioInicio] = useState("")
  const [intersticioFim, setIntersticioFim] = useState("")

  const [classeOrigem, setClasseOrigem] = useState("")
  const [nivelOrigem, setNivelOrigem] = useState("")
  const [classeDestino, setClasseDestino] = useState("")
  const [nivelDestino, setNivelDestino] = useState("")
  const [externalNumber, setExternalNumber] = useState("")
  const [rscTargetLevel, setRscTargetLevel] = useState("")
  const [simecReference, setSimecReference] = useState("")
  const [fullProfessorEvaluationMode, setFullProfessorEvaluationMode] =
    useState<"MEMORIAL" | "THESIS">("MEMORIAL")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  const cidadeUF = useMemo(
    () => (cidade && estado ? `${cidade} - ${estado}` : ""),
    [cidade, estado]
  )

  const selectedProcessType = useMemo(
    () => processTypes.find(item => item.code === selectedProcessTypeCode) ?? null,
    [processTypes, selectedProcessTypeCode]
  )

  const isCareerProcess = selectedProcessType?.category === "CAREER"
  const isRscProcess = selectedProcessType?.category === "RSC"
  const isFullProfessorProcess = selectedProcessType?.category === "FULL_PROFESSOR"

  function openModal(payload: Omit<ModalState, "open">) {
    setModal({
      open: true,
      ...payload
    })
  }

  function closeModal() {
    setModal(prev => ({
      ...prev,
      open: false
    }))
  }

  function splitClassLevel(code: string | null | undefined) {
    if (!code || code.length < 2) return { classe: "", nivel: "" }
    const upper = code.toUpperCase()
    return {
      classe: upper.slice(0, 1),
      nivel: upper.slice(1)
    }
  }

  function inferTipoByOrigem(code: string): LegacyProcessType | null {
    if (ORIGENS_PROGRESSAO.has(code)) return "PROGRESSAO"
    if (ORIGENS_PROMOCAO.has(code)) return "PROMOCAO"
    return null
  }

  const moves = useMemo(
    () => (selectedProcessTypeCode === "PROGRESSION" ? PROGRESSAO_MOVES : PROMOCAO_MOVES),
    [selectedProcessTypeCode]
  )

  const origemCode = useMemo(
    () => (classeOrigem && nivelOrigem ? `${classeOrigem}${nivelOrigem}` : ""),
    [classeOrigem, nivelOrigem]
  )

  const origemOptions = useMemo(() => {
    const set = new Set<string>()
    const result: { code: string; label: string }[] = []

    for (const m of moves) {
      const code = `${m.fromClass}${m.fromLevel}`
      if (!set.has(code)) {
        set.add(code)
        result.push({ code, label: code })
      }
    }

    return result
  }, [moves])

  const destinoOptions = useMemo(() => {
    if (!origemCode) return []
    return moves
      .filter(m => `${m.fromClass}${m.fromLevel}` === origemCode)
      .map(m => ({
        code: `${m.toClass}${m.toLevel}`,
        label: m.label
      }))
  }, [moves, origemCode])

  useEffect(() => {
    let cancelled = false

    async function loadProcessTypes() {
      setLoadingProcessTypes(true)

      try {
        const r = await fetch("/api/processos/tipos", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        })

        const json: ApiResponse<ConfiguredProcessType[]> = await r.json().catch(() => ({
          status: "error",
          message: "Falha ao ler resposta",
          data: null
        }))

        if (cancelled) return

        if (r.ok && Array.isArray(json?.data) && json.data.length) {
          setProcessTypes(json.data)
        }
      } catch {
      } finally {
        if (!cancelled) {
          setLoadingProcessTypes(false)
        }
      }
    }

    loadProcessTypes()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadMe() {
      try {
        const r = await fetch("/api/me", {
          method: "GET"
        })

        if (!r.ok) return

        const json: ApiResponse<UserMe> = await r.json().catch(() => ({
          status: "error",
          message: "Falha ao ler resposta",
          data: null
        }))

        const user = json?.data
        if (!user || cancelled) return

        setNome(user.name ?? "")
        setEmail(user.email ?? "")
        setTelefone(user.phone ?? "")

        if (user.city) setCidade(user.city)
        if (user.uf) setEstado(user.uf)

        if (user.docenteProfile) {
          setSiape(user.docenteProfile.siape ?? "")
          setClassLevel(user.docenteProfile.classLevel ?? "")
          setEducationLevel(user.docenteProfile.educationLevel ?? "")

          if (user.docenteProfile.startInterstice) {
            const d = new Date(user.docenteProfile.startInterstice)
            const iso = d.toISOString().slice(0, 10)
            setIntersticioInicio(iso)
          }

          if (user.docenteProfile.classLevel) {
            const { classe, nivel } = splitClassLevel(user.docenteProfile.classLevel)
            setClasseOrigem(classe)
            setNivelOrigem(nivel)

            const currentCode = `${classe}${nivel}`
            const inferred = inferTipoByOrigem(currentCode)
            if (inferred) {
              setSelectedProcessTypeCode(mapLegacyTypeToProcessTypeCode(inferred))
            }
          }

          if (user.docenteProfile.assignment) {
            setCampus(user.docenteProfile.assignment)
          }
        }
      } catch {
      }
    }

    loadMe()
    return () => {
      cancelled = true
    }
  }, [])

  function handleChangeOrigem(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value
    if (!code) {
      setClasseOrigem("")
      setNivelOrigem("")
      setClasseDestino("")
      setNivelDestino("")
      return
    }

    const classe = code.slice(0, 1)
    const nivel = code.slice(1)

    setClasseOrigem(classe)
    setNivelOrigem(nivel)

    const possible = moves.filter(
      m => `${m.fromClass}${m.fromLevel}` === code
    )
    const hasCurrentDest = possible.some(
      m => m.toClass === classeDestino && m.toLevel === nivelDestino
    )

    if (!hasCurrentDest) {
      setClasseDestino("")
      setNivelDestino("")
    }
  }

  function handleChangeDestino(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value
    if (!code) {
      setClasseDestino("")
      setNivelDestino("")
      return
    }

    const classe = code.slice(0, 1)
    const nivel = code.slice(1)

    setClasseDestino(classe)
    setNivelDestino(nivel)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const classLevelFinal =
        (classeOrigem && nivelOrigem
          ? `${classeOrigem}${nivelOrigem}`
          : classLevel) || ""

      const hasDocentePatch =
        siape || classLevelFinal || educationLevel || intersticioInicio || campus

      const patchUsuario = {
        name: nome || undefined,
        email: email || undefined,
        phone: telefone || undefined,
        city: cidade || undefined,
        uf: estado || undefined,
        docenteProfile: hasDocentePatch
          ? {
            siape: siape || undefined,
            classLevel: classLevelFinal || undefined,
            startInterstice: intersticioInicio || undefined,
            educationLevel: educationLevel || undefined,
            assignment: campus || undefined
          }
          : undefined
      }

      const payload = {
        patchUsuario,
        processo: {
          tipo:
            mapProcessTypeCodeToLegacy(selectedProcessTypeCode) ??
            selectedProcessTypeCode,
          processTypeCode: selectedProcessTypeCode,
          campus,
          cidadeUF,
          externalNumber: externalNumber.trim() || null,
          dataEmissaoISO: new Date().toISOString(),
          intersticioInicioISO: isCareerProcess ? intersticioInicio : undefined,
          intersticioFimISO: isCareerProcess ? intersticioFim : undefined,
          classeOrigem: isCareerProcess ? classeOrigem : undefined,
          nivelOrigem: isCareerProcess ? nivelOrigem : undefined,
          classeDestino: isCareerProcess ? classeDestino : undefined,
          nivelDestino: isCareerProcess ? nivelDestino : undefined,
          rscDetails: isRscProcess
            ? {
                targetLevel: rscTargetLevel,
                simecReference: simecReference.trim() || null
              }
            : undefined,
          fullProfessorDetails: isFullProfessorProcess
            ? {
                evaluationMode: fullProfessorEvaluationMode
              }
            : undefined
        }
      }

      const r = await fetch("/api/processos/abrir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      })

      const json = (await r.json().catch(() => null)) as ApiResponse<CreatedProcess>

      if (!r.ok) {
        setError(json?.message || "Erro ao abrir processo")
        return
      }

      const processId = (json?.data as any)?.processId

      if (processId) {
        openModal({
          title: "Processo aberto",
          message: `Processo nº ${processId} aberto com sucesso. Complete os dados, a pontuação e os documentos exigidos para enviá-lo à CPPD.`,
          variant: "success"
        })

        setTimeout(() => {
          router.push(`/docente/processos/${processId}`)
        }, 600)
      } else {
        openModal({
          title: "Processo aberto",
          message: "Processo aberto com sucesso.",
          variant: "success"
        })
        setTimeout(() => {
          router.push("/docente/processos")
        }, 600)
      }
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao abrir o processo.",
        variant: "error"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    "border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm " +
    "bg-[var(--input-bg)] text-[var(--text-primary)] " +
    "focus:outline-none focus:border-[var(--input-border-focus)]"

  const selectClass = inputClass + " pr-8"

  return (
    <>
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Abrir novo processo
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Revise seus dados e informe os detalhes necessários para iniciar o processo.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--state-danger-bg)] text-[var(--state-danger-text)] text-sm p-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Dados do docente
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 text-sm">
                <label className="font-medium text-[var(--text-primary)]">
                  Nome
                </label>
                <input
                  className={inputClass}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <label className="font-medium text-[var(--text-primary)]">
                  E-mail
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <label className="font-medium text-[var(--text-primary)]">
                  Telefone / Celular
                </label>
                <input
                  className={inputClass}
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <label className="font-medium text-[var(--text-primary)]">
                  SIAPE
                </label>
                <input
                  className={inputClass}
                  value={siape}
                  onChange={e => setSiape(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Tipo de processo
              </label>
              <select
                className={selectClass}
                value={selectedProcessTypeCode}
                onChange={e => {
                  setSelectedProcessTypeCode(e.target.value)
                  setClasseDestino("")
                  setNivelDestino("")
                }}
                disabled={loadingProcessTypes}
              >
                {processTypes.map(processType => {
                  const label = getProcessTypeLabel(processType)

                  return (
                    <option
                      key={processType.idProcessType}
                      value={processType.code}
                    >
                      {label}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Campus
              </label>
              <input
                className={inputClass}
                value={campus}
                onChange={e => setCampus(e.target.value)}
              />
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Cidade
              </label>
              <input
                className={inputClass}
                value={cidade}
                onChange={e => setCidade(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                UF
              </label>
              <input
                className={inputClass}
                value={estado}
                maxLength={2}
                onChange={e => setEstado(e.target.value.toUpperCase())}
              />
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-[var(--text-primary)]">
                Número do processo externo (opcional)
              </label>
              <input
                className={inputClass}
                value={externalNumber}
                onChange={e => setExternalNumber(e.target.value)}
                maxLength={120}
              />
            </div>
          </section>

          {isCareerProcess && (
            <>
              <section className="grid md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 text-sm">
                  <label className="font-medium text-[var(--text-primary)]">
                    Início do interstício
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={intersticioInicio}
                    onChange={e => setIntersticioInicio(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="font-medium text-[var(--text-primary)]">
                    Fim do interstício
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={intersticioFim}
                    onChange={e => setIntersticioFim(e.target.value)}
                    required
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Movimentação na carreira
                </h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1 text-sm">
                    <label className="text-[var(--text-primary)]">
                      Classe / nível de origem
                    </label>
                    <select
                      className={selectClass}
                      value={origemCode}
                      onChange={handleChangeOrigem}
                      required
                    >
                      <option value="">Selecione a origem...</option>
                      {origemOptions.map(opt => (
                        <option key={opt.code} value={opt.code}>
                          {opt.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 text-sm">
                    <label className="text-[var(--text-primary)]">
                      Classe / nível de destino
                    </label>
                    <select
                      className={selectClass}
                      value={classeDestino && nivelDestino ? `${classeDestino}${nivelDestino}` : ""}
                      onChange={handleChangeDestino}
                      disabled={!origemCode}
                      required
                    >
                      <option value="">
                        {origemCode ? "Selecione o destino..." : "Escolha primeiro a origem"}
                      </option>
                      {destinoOptions.map(opt => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            </>
          )}

          {isRscProcess && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Dados do RSC
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 text-sm">
                  <label className="font-medium text-[var(--text-primary)]">
                    Nível pretendido
                  </label>
                  <select
                    className={selectClass}
                    value={rscTargetLevel}
                    onChange={e => setRscTargetLevel(e.target.value)}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="RSC_I">RSC I</option>
                    <option value="RSC_II">RSC II</option>
                    <option value="RSC_III">RSC III</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <label className="font-medium text-[var(--text-primary)]">
                    Referência SIMEC (opcional)
                  </label>
                  <input
                    className={inputClass}
                    value={simecReference}
                    onChange={e => setSimecReference(e.target.value)}
                    maxLength={120}
                  />
                </div>
              </div>
            </section>
          )}

          {isFullProfessorProcess && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Dados da Classe Titular
              </h2>
              <div className="max-w-sm flex flex-col gap-1 text-sm">
                <label className="font-medium text-[var(--text-primary)]">
                  Modalidade de avaliação
                </label>
                <select
                  className={selectClass}
                  value={fullProfessorEvaluationMode}
                  onChange={e =>
                    setFullProfessorEvaluationMode(
                      e.target.value as "MEMORIAL" | "THESIS"
                    )
                  }
                >
                  <option value="MEMORIAL">Memorial</option>
                  <option value="THESIS">Tese acadêmica inédita</option>
                </select>
              </div>
            </section>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-full text-sm font-medium
                         bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                         hover:bg-[var(--btn-primary-hover-bg)]
                         disabled:opacity-50 transition"
            >
              {submitting ? "Abrindo processo..." : "Abrir processo"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
