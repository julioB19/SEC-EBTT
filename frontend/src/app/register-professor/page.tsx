"use client"
import { FormSelect } from "@/components/ui/FormControls"

import BackButton from "@/components/ui/BackButton"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import { useEffect, useState } from "react"
import { validCpf } from "@/utils/inputValidation"
import { useRouter } from "next/navigation"
import Modal from "@/components/Modal"
import { translateBackendError } from "@/utils/translateBackendError"

function onlyDigits(input: string) {
  let out = ""
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") out += ch
  }
  return out
}

function validateCPFBasic(v: string) {
  const digits = onlyDigits(v)
  return validCpf(digits)
}

function validatePhoneBasic(v: string) {
  const digits = onlyDigits(v)
  return digits.length >= 10 && digits.length <= 11
}

function formatPhoneBR(raw: string) {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 10) {
    const p1 = d.slice(0, 2)
    const p2 = d.slice(2, 6)
    const p3 = d.slice(6, 10)
    return [p1 && `(${p1}`, p1 && ")", p2 && ` ${p2}`, p3 && `-${p3}`]
      .filter(Boolean)
      .join("")
  } else {
    const p1 = d.slice(0, 2)
    const p2 = d.slice(2, 7)
    const p3 = d.slice(7, 11)
    return [p1 && `(${p1}`, p1 && ")", p2 && ` ${p2}`, p3 && `-${p3}`]
      .filter(Boolean)
      .join("")
  }
}

const CLASS_LEVEL_OPTIONS = [
  { value: "A1", label: "Classe A - Nível 1" },
  { value: "B1", label: "Classe B - Nível 1" },
  { value: "B2", label: "Classe B - Nível 2" },
  { value: "B3", label: "Classe B - Nível 3" },
  { value: "B4", label: "Classe B - Nível 4" },
  { value: "C1", label: "Classe C - Nível 1" },
  { value: "C2", label: "Classe C - Nível 2" },
  { value: "C3", label: "Classe C - Nível 3" },
  { value: "C4", label: "Classe C - Nível 4" },
  { value: "D1", label: "Classe D - Titular" }
]

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO",
  "MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO"
]

type ModalVariant = "success" | "error" | "info"

type ModalState = {
  open: boolean
  title: string
  message: string
  variant: ModalVariant
}

export default function RegisterProfessorPage() {
  const router = useRouter()

  const [campusId, setCampusId] = useState("")
  const [campuses, setCampuses] = useState<{ idCampus: number; name: string }[]>([])
  useEffect(() => { void fetch("/api/acesso/campuses", { cache: "no-store" }).then(response => response.json()).then(json => { if (Array.isArray(json.data)) { setCampuses(json.data); if (json.data.length === 1) setCampusId(String(json.data[0].idCampus)) } }).catch(() => {}) }, [])
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cpf, setCpf] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [uf, setUf] = useState("")

  const [siape, setSiape] = useState("")
  const [classLevel, setClassLevel] = useState("")
  const [startInterstice, setStartInterstice] = useState("")
  const [educationLevel, setEducationLevel] = useState("")

  const [improvement, setImprovement] = useState<string | "">("")
  const [specialization, setSpecialization] = useState<string | "">("")
  const [mastersDegree, setMastersDegree] = useState<string | "">("")
  const [doctorate, setDoctorate] = useState<string | "">("")
  const [assignment, setAssignment] = useState<string | "">("")
  const [department, setDepartment] = useState<string | "">("")
  const [division, setDivision] = useState<string | "">("")
  const [role, setRole] = useState<string | "">("")
  const [immediateSupervisor, setImmediateSupervisor] = useState<string | "">("")

  const [loading, setLoading] = useState(false)

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  })

  const [redirectOnClose, setRedirectOnClose] = useState(false)

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

    if (redirectOnClose) {
      router.push("/login")
    }
  }


  function onPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhoneBR(e.target.value)
    setPhone(formatted)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    setRedirectOnClose(false)

    if (!name || !email || !cpf || !password || !phone || !city || !uf) {
      openModal({
        title: "Dados obrigatórios",
        message: "Preencha nome, e-mail, CPF, telefone, cidade, UF e senha.",
        variant: "error"
      })
      return
    }
    if (!validateCPFBasic(cpf)) {
      openModal({
        title: "CPF inválido",
        message: "Informe um CPF válido com 11 dígitos, incluindo os dígitos verificadores.",
        variant: "error"
      })
      return
    }
    if (!validatePhoneBasic(phone)) {
      openModal({
        title: "Telefone inválido",
        message: "Telefone inválido. Use 10 ou 11 dígitos (fixo ou celular).",
        variant: "error"
      })
      return
    }
    if (!siape || !classLevel || !startInterstice || !educationLevel) {
      openModal({
        title: "Perfil docente incompleto",
        message: "Preencha os campos obrigatórios do perfil docente.",
        variant: "error"
      })
      return
    }

    const payload = {
      name,
      email,
      cpf,
      password,
      phone,
      city,
      uf,
      docenteProfile: {
          campusId: Number(campusId),
        siape,
        classLevel,
        startInterstice: new Date(startInterstice),
        educationLevel,
        improvement: improvement || null,
        specialization: specialization || null,
        mastersDegree: mastersDegree || null,
        doctorate: doctorate || null,
        assignment: assignment || null,
        department: department || null,
        division: division || null,
        role: role || null,
        immediateSupervisor: immediateSupervisor || null
      }
    }

    setLoading(true)
    try {
      const r = await fetch("/api/public/register-professor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const json = await r.json().catch(() => ({}))

      if (!r.ok) {
        const friendlyMessage = translateBackendError(json, "register")

        openModal({
          title: "Falha no cadastro",
          message: friendlyMessage,
          variant: "error"
        })

        setLoading(false)
        setRedirectOnClose(false)
        return
      }

      openModal({
        title: "Cadastro realizado",
        message: "Cadastro realizado com sucesso! Você já pode fazer login.",
        variant: "success"
      })

      setRedirectOnClose(true)

      clearForm()
      setLoading(false)
    } catch {
      openModal({
        title: "Erro de conexão",
        message: "Não foi possível conectar com o servidor. Tente novamente em instantes.",
        variant: "error"
      })
      setLoading(false)
      setRedirectOnClose(false)
    }
  }

  function clearForm() {
    setName("")
    setEmail("")
    setCpf("")
    setPassword("")
    setPhone("")
    setCity("")
    setUf("")
    setSiape("")
    setClassLevel("")
    setStartInterstice("")
    setEducationLevel("")
    setImprovement("")
    setSpecialization("")
    setMastersDegree("")
    setDoctorate("")
    setAssignment("")
    setDepartment("")
    setDivision("")
    setRole("")
    setImmediateSupervisor("")
  }

  const inputClass =
    "w-full border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-sm " +
    "bg-[var(--surface-card)] text-[var(--text-primary)] " +
    "placeholder:text-[var(--text-secondary)] outline-none " +
    "focus:ring-2 focus:ring-[var(--brand)]"

  return (
    <>
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      <div className="min-h-screen bg-[var(--surface-muted)] flex items-center justify-center p-4">
        <form
          onSubmit={onSubmit}
          className="
            w-full max-w-3xl
            bg-[var(--surface-card)]
            rounded-2xl shadow-sm
            border border-[var(--border-subtle)]
            p-6 space-y-4
          "
        >
          <label className="block text-sm">Campus<FormSelect aria-label="Campus" className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-sm" value={campusId} onChange={event => setCampusId(event.target.value)} required><option value="">Selecione o campus</option>{campuses.map(campus => <option key={campus.idCampus} value={campus.idCampus}>{campus.name}</option>)}</FormSelect></label>
          <h1 className="text-2xl font-semibold mb-2 text-[var(--text-primary)]">
            Cadastro de Docente
          </h1>
<BackButton />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <h2 className="text-lg font-medium mb-2 text-[var(--text-primary)]">
                Dados pessoais
              </h2>
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Nome completo *
              </label>
              <FormInput
                className={inputClass}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
               aria-label="Nome completo *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                E-mail *
              </label>
              <FormInput
                type="email"
                className={inputClass}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
               fieldKind={"email"}  aria-label="E-mail *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                CPF *
              </label>
              <FormInput
                className={inputClass}
                value={cpf}
                onChange={e => setCpf(e.target.value)}
                placeholder="000.000.000-00"
               fieldKind={"cpf"}  aria-label="CPF *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Senha *
              </label>
              <FormInput
                type="password"
                className={inputClass}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
               aria-label="Senha *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Telefone *
              </label>
              <FormInput
                className={inputClass}
                value={phone}
                onChange={onPhoneChange}
                placeholder="(11) 91234-5678"
                inputMode="tel"
               fieldKind={"phone"}  aria-label="Telefone *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Cidade *
              </label>
              <FormInput
                className={inputClass}
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Ex.: Santa Maria"
               aria-label="Cidade *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                UF *
              </label>
              <FormSelect
                className={inputClass}
                value={uf}
                onChange={e => setUf(e.target.value)}
               aria-label="UF *" >
                <option value="">Selecione...</option>
                {UF_OPTIONS.map(sigla => (
                  <option key={sigla} value={sigla}>
                    {sigla}
                  </option>
                ))}
              </FormSelect>
            </div>

            <div className="md:col-span-2 mt-4">
              <h2 className="text-lg font-medium mb-2 text-[var(--text-primary)]">
                Perfil do Docente
              </h2>
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                SIAPE *
              </label>
              <FormInput
                className={inputClass}
                value={siape}
                onChange={e => setSiape(e.target.value)}
                placeholder="SIAPE"
               fieldKind={"siape"}  aria-label="SIAPE *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Classe / Nível *
              </label>
              <FormSelect
                className={inputClass}
                value={classLevel}
                onChange={e => setClassLevel(e.target.value)}
               aria-label="Classe / Nível *" >
                <option value="">Selecione...</option>
                {CLASS_LEVEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </FormSelect>
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Início do Interstício *
              </label>
              <FormInput
                type="date"
                className={inputClass}
                value={startInterstice}
                onChange={e => setStartInterstice(e.target.value)}
               aria-label="Início do Interstício *" />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                Escolaridade *
              </label>
              <FormInput
                className={inputClass}
                value={educationLevel}
                onChange={e => setEducationLevel(e.target.value)}
                placeholder="Graduação, Mestrado, Doutorado..."
               aria-label="Escolaridade *" />
            </div>

            <div className="md:col-span-2 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Aperfeiçoamento
                </label>
                <FormInput
                  className={inputClass}
                  value={improvement}
                  onChange={e => setImprovement(e.target.value)}
                 aria-label="Aperfeiçoamento" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Especialização
                </label>
                <FormInput
                  className={inputClass}
                  value={specialization}
                  onChange={e => setSpecialization(e.target.value)}
                 aria-label="Especialização" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Mestrado
                </label>
                <FormInput
                  className={inputClass}
                  value={mastersDegree}
                  onChange={e => setMastersDegree(e.target.value)}
                 aria-label="Mestrado" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Doutorado
                </label>
                <FormInput
                  className={inputClass}
                  value={doctorate}
                  onChange={e => setDoctorate(e.target.value)}
                 aria-label="Doutorado" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Lotação / Atuação
                </label>
                <FormInput
                  className={inputClass}
                  value={assignment}
                  onChange={e => setAssignment(e.target.value)}
                  placeholder="Ex.: Campus X"
                 aria-label="Lotação / Atuação" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Departamento
                </label>
                <FormInput
                  className={inputClass}
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                 aria-label="Departamento" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Divisão
                </label>
                <FormInput
                  className={inputClass}
                  value={division}
                  onChange={e => setDivision(e.target.value)}
                 aria-label="Divisão" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Função
                </label>
                <FormInput
                  className={inputClass}
                  value={role}
                  onChange={e => setRole(e.target.value)}
                 aria-label="Função" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-[var(--text-secondary)]">
                  Chefia imediata
                </label>
                <FormInput
                  className={inputClass}
                  value={immediateSupervisor}
                  onChange={e => setImmediateSupervisor(e.target.value)}
                 aria-label="Chefia imediata" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <ActionButton
              type="submit"
              disabled={loading}
              className="
                px-4 py-2 rounded-xl text-sm font-medium
                bg-[var(--btn-primary-bg)]
                text-[var(--btn-primary-text)]
                hover:bg-[var(--btn-primary-hover-bg)]
                disabled:opacity-50
              "
             disabledReason={(loading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
              {loading ? "Enviando..." : "Cadastrar"}
            </ActionButton>

            <button
              type="button"
              onClick={clearForm}
              className="
                px-4 py-2 rounded-xl text-sm
                border border-[var(--border-subtle)]
                text-[var(--text-secondary)]
                hover:bg-[var(--surface-muted)]
              "
            >
              Limpar
            </button>

            <a
              href="/login"
              className="ml-auto text-sm text-[var(--brand)] hover:underline"
            >
              Já tenho conta
            </a>
          </div>

          <p className="text-xs text-[var(--text-secondary)] mt-3">
            Campos com * são obrigatórios
          </p>
        </form>
      </div>
    </>
  )
}
