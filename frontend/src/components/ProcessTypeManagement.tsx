"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ApiResponse<T> = { status: string; message: string; data: T | null };
type ProcessCategory = "CAREER" | "RSC" | "FULL_PROFESSOR" | "SIMPLE" | "OTHER";

type DocumentRequirement = {
  idDocumentRequirement?: number;
  code: string;
  name: string;
  description: string | null;
  required: boolean;
  allowsMultiple: boolean;
  acceptedFormats: string | null;
  maxSizeMb: number | null;
  sortOrder: number;
  active: boolean;
};

type ProcessTypeVersion = {
  idProcessType: number;
  code: string;
  name: string;
  category: ProcessCategory;
  version: number;
  requiresScoring: boolean;
  requiresCommittee: boolean;
  requiresGecc: boolean;
  defaultDestination: string | null;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  documentRequirements: DocumentRequirement[];
};

type RequirementForm = {
  code: string;
  name: string;
  description: string;
  required: boolean;
  allowsMultiple: boolean;
  acceptedFormats: string;
  maxSizeMb: string;
  active: boolean;
};

type ProcessTypeForm = {
  code: string;
  name: string;
  category: ProcessCategory;
  requiresScoring: boolean;
  requiresCommittee: boolean;
  requiresGecc: boolean;
  defaultDestination: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
  requirements: RequirementForm[];
};

const CATEGORY_LABELS: Record<ProcessCategory, string> = {
  CAREER: "Carreira",
  RSC: "RSC",
  FULL_PROFESSOR: "Classe Titular",
  SIMPLE: "Processo simples",
  OTHER: "Outro",
};

const inputClass =
  "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--brand)]";
const primaryButton =
  "rounded-md bg-[var(--btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50";
const secondaryButton =
  "rounded-md border border-[var(--btn-secondary-border)] px-4 py-2 text-sm font-semibold text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)] disabled:opacity-50";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowInput() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function emptyRequirement(): RequirementForm {
  return {
    code: "",
    name: "",
    description: "",
    required: true,
    allowsMultiple: false,
    acceptedFormats: "pdf",
    maxSizeMb: "10",
    active: true,
  };
}

function emptyForm(): ProcessTypeForm {
  return {
    code: "",
    name: "",
    category: "SIMPLE",
    requiresScoring: false,
    requiresCommittee: false,
    requiresGecc: false,
    defaultDestination: "",
    validFrom: todayInput(),
    validUntil: "",
    active: true,
    requirements: [],
  };
}

function toInputDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null) {
  if (!value) return "Sem término";
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function ProcessTypeManagement() {
  const [versions, setVersions] = useState<ProcessTypeVersion[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessTypeForm>(emptyForm);
  const [mode, setMode] = useState<"create" | "version" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const latestVersions = useMemo(() => {
    const latest = new Map<string, ProcessTypeVersion>();
    for (const item of versions) {
      const current = latest.get(item.code);
      if (!current || item.version > current.version)
        latest.set(item.code, item);
    }
    return [...latest.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [versions]);

  const selected = useMemo(
    () => latestVersions.find((item) => item.code === selectedCode) ?? null,
    [latestVersions, selectedCode],
  );

  const selectedHistory = useMemo(
    () =>
      versions
        .filter((item) => item.code === selectedCode)
        .sort((a, b) => b.version - a.version),
    [versions, selectedCode],
  );

  async function request<T>(path: string, init?: RequestInit) {
    const response = await fetch(`/api/process-configuration/${path}`, {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<T> | null;
    if (!response.ok || !payload?.data) {
      throw new Error(
        payload?.message || "Não foi possível concluir a operação",
      );
    }
    return payload.data;
  }

  async function load(preferredCode?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const data = await request<ProcessTypeVersion[]>("process-types");
      setVersions(data);
      setSelectedCode((current) => {
        const preferred = preferredCode ?? current;
        if (preferred && data.some((item) => item.code === preferred))
          return preferred;
        return data[0]?.code ?? null;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar os tipos de processo",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function beginCreate() {
    setMode("create");
    setForm(emptyForm());
    setError(null);
    setNotice(null);
  }

  function beginVersion(item: ProcessTypeVersion) {
    setMode("version");
    setForm({
      code: item.code,
      name: item.name,
      category: item.category,
      requiresScoring: item.requiresScoring,
      requiresCommittee: item.requiresCommittee,
      requiresGecc: item.requiresGecc,
      defaultDestination: item.defaultDestination ?? "",
      validFrom: tomorrowInput(),
      validUntil: "",
      active: true,
      requirements: item.documentRequirements.map((requirement) => ({
        code: requirement.code,
        name: requirement.name,
        description: requirement.description ?? "",
        required: requirement.required,
        allowsMultiple: requirement.allowsMultiple,
        acceptedFormats: requirement.acceptedFormats ?? "",
        maxSizeMb: requirement.maxSizeMb?.toString() ?? "",
        active: requirement.active,
      })),
    });
    setError(null);
    setNotice(null);
  }

  function updateRequirement(index: number, patch: Partial<RequirementForm>) {
    setForm((current) => ({
      ...current,
      requirements: current.requirements.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mode) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        ...(mode === "create" ? { code: form.code } : {}),
        name: form.name,
        category: form.category,
        requiresScoring: form.requiresScoring,
        requiresCommittee: form.requiresCommittee,
        requiresGecc: form.requiresGecc,
        defaultDestination: form.defaultDestination || null,
        validFrom: form.validFrom,
        validUntil: form.validUntil || null,
        active: form.active,
        requirements: form.requirements.map((item, index) => ({
          code: item.code,
          name: item.name,
          description: item.description || null,
          required: item.required,
          allowsMultiple: item.allowsMultiple,
          acceptedFormats: item.acceptedFormats || null,
          maxSizeMb: item.maxSizeMb ? Number(item.maxSizeMb) : null,
          sortOrder: index,
          active: item.active,
        })),
      };
      const path =
        mode === "create"
          ? "process-types"
          : `process-types/${selected!.idProcessType}/versions`;
      const created = await request<ProcessTypeVersion>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMode(null);
      setNotice(
        mode === "create"
          ? "Tipo de processo criado."
          : `Versão ${created.version} criada.`,
      );
      await load(created.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ProcessTypeVersion) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await request<ProcessTypeVersion>(
        `process-types/${item.idProcessType}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !item.active }),
        },
      );
      setNotice(item.active ? "Tipo inativado." : "Tipo reativado.");
      await load(item.code);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar o status",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Tipos de processo
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Configure regras e documentos por versão, preservando processos já
            abertos.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className={secondaryButton}>
            Voltar
          </Link>
          <button type="button" onClick={beginCreate} className={primaryButton}>
            Novo tipo
          </button>
        </div>
      </header>

      {error && (
        <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="border-l-4 border-green-700 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-r border-[var(--border-subtle)] pr-0 lg:pr-6">
          <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--text-secondary)]">
            Tipos cadastrados
          </h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando...
            </p>
          ) : latestVersions.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Nenhum tipo cadastrado.
            </p>
          ) : (
            <div className="space-y-1">
              {latestVersions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setSelectedCode(item.code);
                    setMode(null);
                    setNotice(null);
                  }}
                  className={`w-full border-l-4 px-3 py-3 text-left transition ${selectedCode === item.code ? "border-[var(--brand)] bg-[var(--surface-muted-bg)]" : "border-transparent hover:bg-[var(--surface-muted-bg)]"}`}
                >
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    {item.name}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                    {item.code} · v{item.version} ·{" "}
                    {item.active ? "Ativo" : "Inativo"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="min-w-0">
          {mode ? (
            <form onSubmit={submit} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {mode === "create"
                      ? "Novo tipo de processo"
                      : `Nova versão de ${selected?.name}`}
                  </h2>
                  {mode === "version" && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      A versão anterior será encerrada no início desta vigência.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className={secondaryButton}
                >
                  Cancelar
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Código
                  <input
                    required
                    disabled={mode === "version"}
                    className={inputClass}
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_]/g, "_"),
                      }))
                    }
                  />
                </label>
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Nome
                  <input
                    required
                    className={inputClass}
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Categoria
                  <select
                    className={inputClass}
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as ProcessCategory,
                      }))
                    }
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Destino padrão
                  <input
                    placeholder="Ex.: CPPD, CGP, SIPAC"
                    className={inputClass}
                    value={form.defaultDestination}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        defaultDestination: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    Início da vigência
                    <input
                      required
                      type="date"
                      className={inputClass}
                      value={form.validFrom}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          validFrom: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm font-medium text-[var(--text-primary)]">
                    Fim da vigência
                    <input
                      type="date"
                      className={inputClass}
                      value={form.validUntil}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          validUntil: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <fieldset className="border-y border-[var(--border-subtle)] py-4">
                <legend className="px-2 text-sm font-semibold text-[var(--text-primary)]">
                  Regras do fluxo
                </legend>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {[
                    ["requiresScoring", "Exige pontuação"],
                    ["requiresCommittee", "Exige comissão especial"],
                    ["requiresGecc", "Exige GECC"],
                    ["active", "Versão ativa"],
                  ].map(([field, label]) => (
                    <label
                      key={field}
                      className="flex items-center gap-2 text-sm text-[var(--text-primary)]"
                    >
                      <input
                        type="checkbox"
                        checked={
                          form[field as keyof ProcessTypeForm] as boolean
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [field]: event.target.checked,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">
                      Documentos do processo
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Use códigos estáveis em inglês e nomes visíveis em
                      português.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        requirements: [
                          ...current.requirements,
                          emptyRequirement(),
                        ],
                      }))
                    }
                  >
                    Adicionar documento
                  </button>
                </div>

                {form.requirements.length === 0 && (
                  <p className="border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">
                    Nenhum documento configurado para esta versão.
                  </p>
                )}
                {form.requirements.map((item, index) => (
                  <div
                    key={index}
                    className="border-b border-[var(--border-subtle)] pb-5 last:border-b-0"
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-sm font-medium text-[var(--text-primary)]">
                        Código
                        <input
                          required
                          className={inputClass}
                          value={item.code}
                          onChange={(event) =>
                            updateRequirement(index, {
                              code: event.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9_]/g, "_"),
                            })
                          }
                        />
                      </label>
                      <label className="text-sm font-medium text-[var(--text-primary)]">
                        Nome
                        <input
                          required
                          className={inputClass}
                          value={item.name}
                          onChange={(event) =>
                            updateRequirement(index, {
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="text-sm font-medium text-[var(--text-primary)]">
                        Formatos aceitos
                        <input
                          placeholder="pdf, docx"
                          className={inputClass}
                          value={item.acceptedFormats}
                          onChange={(event) =>
                            updateRequirement(index, {
                              acceptedFormats: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="text-sm font-medium text-[var(--text-primary)]">
                        Tamanho máximo (MB)
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className={inputClass}
                          value={item.maxSizeMb}
                          onChange={(event) =>
                            updateRequirement(index, {
                              maxSizeMb: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-sm font-medium text-[var(--text-primary)]">
                      Descrição
                      <input
                        className={inputClass}
                        value={item.description}
                        onChange={(event) =>
                          updateRequirement(index, {
                            description: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-5">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.required}
                          onChange={(event) =>
                            updateRequirement(index, {
                              required: event.target.checked,
                            })
                          }
                        />
                        Obrigatório
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.allowsMultiple}
                          onChange={(event) =>
                            updateRequirement(index, {
                              allowsMultiple: event.target.checked,
                            })
                          }
                        />
                        Permite vários arquivos
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={(event) =>
                            updateRequirement(index, {
                              active: event.target.checked,
                            })
                          }
                        />
                        Ativo
                      </label>
                      <button
                        type="button"
                        className="ml-auto text-sm font-semibold text-red-700 hover:underline"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            requirements: current.requirements.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          }))
                        }
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </section>

              <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
                <button disabled={saving} className={primaryButton}>
                  {saving
                    ? "Salvando..."
                    : mode === "create"
                      ? "Criar tipo"
                      : "Criar nova versão"}
                </button>
              </div>
            </form>
          ) : selected ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                    {selected.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {selected.code} · versão {selected.version} ·{" "}
                    {CATEGORY_LABELS[selected.category]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleActive(selected)}
                    className={secondaryButton}
                  >
                    {selected.active ? "Inativar" : "Reativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => beginVersion(selected)}
                    className={primaryButton}
                  >
                    Nova versão
                  </button>
                </div>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <dt className="text-xs uppercase text-[var(--text-secondary)]">
                    Vigência
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {formatDate(selected.validFrom)} a{" "}
                    {formatDate(selected.validUntil)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-[var(--text-secondary)]">
                    Destino padrão
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {selected.defaultDestination || "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-[var(--text-secondary)]">
                    Pontuação
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {selected.requiresScoring ? "Obrigatória" : "Não exigida"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-[var(--text-secondary)]">
                    Comissão especial
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {selected.requiresCommittee ? "Obrigatória" : "Não exigida"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-[var(--text-secondary)]">
                    GECC
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {selected.requiresGecc ? "Obrigatório" : "Não exigido"}
                  </dd>
                </div>
              </dl>

              <section>
                <h3 className="mb-3 font-semibold text-[var(--text-primary)]">
                  Documentos configurados
                </h3>
                {selected.documentRequirements.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Nenhum documento configurado.
                  </p>
                ) : (
                  <div className="overflow-x-auto border-y border-[var(--border-subtle)]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--surface-muted-bg)] text-xs uppercase text-[var(--text-secondary)]">
                        <tr>
                          <th className="px-3 py-2">Documento</th>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Formatos</th>
                          <th className="px-3 py-2">Limite</th>
                          <th className="px-3 py-2">Regra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.documentRequirements.map((item) => (
                          <tr
                            key={item.code}
                            className="border-t border-[var(--border-subtle)]"
                          >
                            <td className="px-3 py-3 font-medium">
                              {item.name}
                            </td>
                            <td className="px-3 py-3 text-[var(--text-secondary)]">
                              {item.code}
                            </td>
                            <td className="px-3 py-3">
                              {item.acceptedFormats || "Qualquer"}
                            </td>
                            <td className="px-3 py-3">
                              {item.maxSizeMb
                                ? `${item.maxSizeMb} MB`
                                : "Sem limite"}
                            </td>
                            <td className="px-3 py-3">
                              {item.required ? "Obrigatório" : "Opcional"}
                              {item.allowsMultiple ? " · múltiplo" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 font-semibold text-[var(--text-primary)]">
                  Histórico de versões
                </h3>
                <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                  {selectedHistory.map((item) => (
                    <div
                      key={item.idProcessType}
                      className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                    >
                      <span className="font-medium">Versão {item.version}</span>
                      <span className="text-[var(--text-secondary)]">
                        {formatDate(item.validFrom)} a{" "}
                        {formatDate(item.validUntil)} ·{" "}
                        {item.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              Selecione um tipo ou crie o primeiro cadastro.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
