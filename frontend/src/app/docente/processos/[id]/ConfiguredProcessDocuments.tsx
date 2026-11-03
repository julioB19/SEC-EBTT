"use client"

import { clientFetch as fetch } from "@/lib/clientFetch"
import ActionButton from "@/components/ui/ActionButton"
import FormInput from "@/components/ui/FormInput"

import { useState } from "react";

export type ConfiguredDocumentRequirement = {
  idDocumentRequirement: number;
  code: string;
  name: string;
  description: string | null;
  required: boolean;
  allowsMultiple: boolean;
  acceptedFormats: string | null;
  maxSizeMb: number | null;
  sortOrder: number;
};

export type ConfiguredProcessDocument = {
  idDocumentProcess: number;
  documentType: string;
  nature: string | null;
  checked: boolean;
  receivedAt: string | null;
  file: {
    idEvidenceFile: number;
    originalName: string;
    mimeType: string | null;
    sizeBytes: number | null;
    uploadedAt: string;
  } | null;
};

type Props<TProcess> = {
  processId: number;
  requirements: ConfiguredDocumentRequirement[];
  documents: ConfiguredProcessDocument[];
  editable: boolean;
  onUpdated: (process: TProcess) => void;
  notify: (payload: {
    title: string;
    message: string;
    variant: "success" | "error" | "info";
  }) => void;
};

const ACCEPT_BY_FORMAT: Record<string, string> = {
  pdf: ".pdf,application/pdf",
  jpg: ".jpg,.jpeg,image/jpeg",
  jpeg: ".jpg,.jpeg,image/jpeg",
  png: ".png,image/png",
  doc: ".doc,application/msword",
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: ".xls,application/vnd.ms-excel",
  xlsx: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  odt: ".odt,application/vnd.oasis.opendocument.text",
  ods: ".ods,application/vnd.oasis.opendocument.spreadsheet",
};

function formatFileSize(size: number | null) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function acceptedFileTypes(formats: string | null) {
  if (!formats) return Object.values(ACCEPT_BY_FORMAT).join(",");

  return formats
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean)
    .flatMap((value) => (ACCEPT_BY_FORMAT[value] ?? `.${value}`).split(","))
    .join(",");
}

function requirementDescription(requirement: ConfiguredDocumentRequirement) {
  const formats = requirement.acceptedFormats
    ? requirement.acceptedFormats.toUpperCase().replace(/[;,]+/g, ", ")
    : "formatos permitidos pelo sistema";
  const maxSize = requirement.maxSizeMb ?? 100;
  return `${formats}, até ${maxSize} MB`;
}

export default function ConfiguredProcessDocuments<TProcess>({
  processId,
  requirements,
  documents,
  editable,
  onUpdated,
  notify,
}: Props<TProcess>) {
  const [selectedFiles, setSelectedFiles] = useState<
    Record<string, File | undefined>
  >({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (requirements.length === 0) return null;

  async function upload(requirement: ConfiguredDocumentRequirement) {
    const file = selectedFiles[requirement.code];
    if (!file) {
      notify({
        title: "Selecione um arquivo",
        message: `Escolha o arquivo de ${requirement.name} antes de anexar.`,
        variant: "error",
      });
      return;
    }

    const maxSizeMb = requirement.maxSizeMb ?? 100;
    if (file.size > maxSizeMb * 1024 * 1024) {
      notify({
        title: "Arquivo muito grande",
        message: `O limite para ${requirement.name} é ${maxSizeMb} MB.`,
        variant: "error",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setBusyKey(`upload:${requirement.code}`);

    try {
      const response = await fetch(
        `/api/processos/${processId}/documentos-configurados/${encodeURIComponent(requirement.code)}`,
        { method: "POST", credentials: "include", body: formData },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        notify({
          title: "Não foi possível anexar",
          message: body?.message || "Verifique o arquivo e tente novamente.",
          variant: "error",
        });
        return;
      }

      onUpdated(body.data as TProcess);
      setSelectedFiles((current) => ({
        ...current,
        [requirement.code]: undefined,
      }));
      notify({
        title: "Documento anexado",
        message: `${requirement.name} foi vinculado ao processo.`,
        variant: "success",
      });
    } catch (error: any) {
      notify({
        title: "Erro inesperado",
        message: error?.message || "Não foi possível anexar o documento.",
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function remove(document: ConfiguredProcessDocument) {
    setBusyKey(`remove:${document.idDocumentProcess}`);
    try {
      const response = await fetch(
        `/api/processos/${processId}/documentos-configurados/${document.idDocumentProcess}`,
        { method: "DELETE", credentials: "include" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) {
        notify({
          title: "Não foi possível remover",
          message: body?.message || "Tente novamente.",
          variant: "error",
        });
        return;
      }

      onUpdated(body.data as TProcess);
      notify({
        title: "Documento removido",
        message: "O arquivo foi removido do processo.",
        variant: "success",
      });
    } catch (error: any) {
      notify({
        title: "Erro inesperado",
        message: error?.message || "Não foi possível remover o documento.",
        variant: "error",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Documentos exigidos
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          A lista corresponde à versão do tipo de processo selecionada na
          abertura.
        </p>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {requirements.map((requirement) => {
          const currentDocuments = documents.filter(
            (document) =>
              document.documentType === requirement.code && document.file,
          );
          const selectedFile = selectedFiles[requirement.code];
          const isUploading = busyKey === `upload:${requirement.code}`;

          return (
            <div
              key={requirement.idDocumentRequirement}
              className="space-y-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {requirement.name}
                  </div>
                  {requirement.description && (
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {requirement.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {requirementDescription(requirement)}
                    {requirement.allowsMultiple
                      ? "; aceita vários arquivos"
                      : ""}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-[11px] font-medium ${
                    requirement.required
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {requirement.required ? "Obrigatório" : "Opcional"}
                </span>
              </div>

              {currentDocuments.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Nenhum arquivo anexado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {currentDocuments.map((document) => (
                    <li
                      key={document.idDocumentProcess}
                      className="flex min-w-0 items-center justify-between gap-3 rounded border border-[var(--border-subtle)] px-3 py-2"
                    >
                      <a
                        href={`/api/evidencias/${document.file!.idEvidenceFile}/conteudo`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 break-all text-sm font-medium text-emerald-700 hover:underline"
                      >
                        {document.file!.originalName}
                        {document.file!.sizeBytes
                          ? ` (${formatFileSize(document.file!.sizeBytes)})`
                          : ""}
                      </a>
                      {editable && (
                        <ActionButton
                          type="button"
                          onClick={() => remove(document)}
                          disabled={busyKey !== null}
                          className="shrink-0 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                         disabledReason={(busyKey !== null) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                          {busyKey === `remove:${document.idDocumentProcess}`
                            ? "Removendo..."
                            : "Remover"}
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {editable && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <FormInput
                    key={`${requirement.code}:${currentDocuments
                      .map((document) => document.file?.idEvidenceFile)
                      .join(",")}`}
                    type="file"
                    accept={acceptedFileTypes(requirement.acceptedFormats)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSelectedFiles((current) => ({
                        ...current,
                        [requirement.code]: file,
                      }));
                    }}
                    className="min-w-0 flex-1 text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--btn-secondary-border)] file:bg-[var(--surface-bg)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--btn-secondary-text)]"
                  />
                  <ActionButton
                    type="button"
                    onClick={() => upload(requirement)}
                    disabled={busyKey !== null || !selectedFile}
                    className="shrink-0 rounded-md bg-[var(--btn-primary-bg)] px-3 py-2 text-xs font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-50"
                   disabledReason={(busyKey !== null) ? "Aguarde a operação em andamento terminar." : (!selectedFile) ? "Selecione o arquivo que deseja anexar antes de continuar." : "Este controle está indisponível na etapa atual."} >
                    {isUploading
                      ? "Enviando..."
                      : !requirement.allowsMultiple &&
                          currentDocuments.length > 0
                        ? "Substituir"
                        : "Anexar"}
                  </ActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
