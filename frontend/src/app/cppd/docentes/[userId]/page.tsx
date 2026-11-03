"use client"

import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ApiResponse<T = any> = {
  status: "success" | "error";
  message: string;
  data: T | null;
  details?: any;
};

type Docente = {
  idUser: number;
  name: string;
  email: string;
  cpf: string;
  docenteProfile: null | { siape: string };
};

function inputClass() {
  return "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)]";
}

export default function CppdEditDocentePage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useFeedbackState<string | null>(null, "error");
  const [ok, setOk] = useFeedbackState<string | null>(null, "success");

  const [docente, setDocente] = useState<Docente | null>(null);
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [siape, setSiape] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/cppd/docentes/${userId}`, {
          method: "GET",
          credentials: "include",
        });
        const payload = (await r
          .json()
          .catch(() => null)) as ApiResponse<Docente> | null;

        if (!alive) return;

        if (!payload || !r.ok || payload.status === "error" || !payload.data) {
          setErr(payload?.message || "Falha ao carregar docente");
          setDocente(null);
          return;
        }

        setDocente(payload.data);
        setEmail(payload.data.email ?? "");
        setCpf(payload.data.cpf ?? "");
        setSiape(payload.data.docenteProfile?.siape ?? "");
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Erro ao carregar docente");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (Number.isFinite(userId) && userId > 0) load();
    else setLoading(false);

    return () => {
      alive = false;
    };
  }, [userId]);

  async function onSave() {
    setSaving(true);
    setErr(null);
    setOk(null);

    try {
      const r = await fetch(`/api/cppd/docentes/${userId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cpf, siape }),
      });

      const payload = (await r
        .json()
        .catch(() => null)) as ApiResponse<any> | null;
      if (!payload || !r.ok || payload.status === "error") {
        setErr(payload?.message || "Falha ao salvar");
        return;
      }

      setOk("Atualizado com sucesso");
    } catch (e: any) {
      setErr(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[60vh]">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Editar docente
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            CPPD pode editar apenas <b>email</b>, <b>CPF</b> e <b>SIAPE</b>.
          </p>
        </header>

        {loading && (
          <p className="text-sm text-[var(--text-secondary)]">Carregando...</p>
        )}
        {err && (
          null
        )}
        {ok && (
          null
        )}

        {!loading && docente && (
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                Nome (somente leitura)
              </label>
              <FormInput className={inputClass()} value={docente.name} disabled  disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Nome (somente leitura)" />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Email
                </label>
                <FormInput
                  className={inputClass()}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                 fieldKind={"email"}  aria-label="Email" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  CPF
                </label>
                <FormInput
                  className={inputClass()}
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                 fieldKind={"cpf"}  aria-label="CPF" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  SIAPE
                </label>
                <FormInput
                  className={inputClass()}
                  value={siape}
                  onChange={(e) => setSiape(e.target.value)}
                 fieldKind={"siape"}  aria-label="SIAPE" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">


              <ActionButton
                type="button"
                disabled={saving}
                onClick={onSave}
                className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wide
                           bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                           hover:bg-[var(--btn-primary-hover-bg)] transition-[background] disabled:opacity-60"
               disabledReason={(saving) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                {saving ? "Salvando..." : "Salvar"}
              </ActionButton>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
