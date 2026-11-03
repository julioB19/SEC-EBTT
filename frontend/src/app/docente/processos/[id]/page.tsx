"use client"
import { FormSelect } from "@/components/ui/FormControls"

import ProcessSteps from "@/components/ProcessSteps"
import { useFeedbackState } from "@/hooks/useFeedbackState"
import { clientFetch as fetch } from "@/lib/clientFetch"
import FormInput from "@/components/ui/FormInput"
import ActionButton from "@/components/ui/ActionButton"
import { formatProcessTypeLabel } from "@/utils/processTypeLabels"
import CaseCompliancePanel from "@/components/CaseCompliancePanel";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/Modal";
import ConfirmModal from "@/components/ConfirmModal";
import FullProfessorProcedurePanel from "@/components/FullProfessorProcedurePanel";
import SpecificProcessDocuments, {
  FullProfessorProcessDetails,
  RscProcessDetails,
} from "./SpecificProcessDocuments";
import ConfiguredProcessDocuments, {
  ConfiguredDocumentRequirement,
  ConfiguredProcessDocument,
} from "./ConfiguredProcessDocuments";

type ProcessType = "PROGRESSAO" | "PROMOCAO";
type ProcessTypeCategory =
  | "CAREER"
  | "RSC"
  | "FULL_PROFESSOR"
  | "OTHER";

type ProcessStatus =
  | "DRAFT"
  | "DOCUMENTATION_PENDING"
  | "SUBMITTED"
  | "AWAITING_EVALUATOR_ACCEPTANCE"
  | "AWAITING_ORDINANCE"
  | "UNDER_REVIEW"
  | "IN_EVALUATION"
  | "RETURNED"
  | "APPROVED"
  | "REJECTED"
  | "FINALIZED";

type Processo = {
  processId: number;
  type: ProcessType | null;
  processTypeId: number | null;
  processTypeCode: string;
  processTypeName: string;
  processTypeCategory: ProcessTypeCategory | null;
  processTypeConfig: {
    idProcessType: number;
    code: string;
    name: string;
    category: ProcessTypeCategory;
    requiresScoring: boolean;
    requiresCommittee: boolean;
    documentRequirements: ConfiguredDocumentRequirement[];
  } | null;
  status: ProcessStatus;
  scoringTableId: number | null;
  scoringTable: {
    idScoringTable: number;
    name: string;
    purpose: string;
    minRequiredPoints: string | null;
  } | null;
  createdAt: string;
  submittedAt: string | null;
  userId: number;
  campus: string;
  cidadeUF: string;
  externalNumber: string | null;
  intersticeStart: string | null;
  intersticeEnd: string | null;
  classeOrigem: string | null;
  nivelOrigem: string | null;
  classeDestino: string | null;
  nivelDestino: string | null;
  rscDetails: RscProcessDetails | null;
  configuredDocuments: ConfiguredProcessDocument[];
  fullProfessorDetails: FullProfessorProcessDetails | null;
};

type ApiResponse<T> = {
  status: string;
  message: string;
  data: T | null;
};

type ModalVariant = "success" | "error" | "info";

type ModalState = {
  open: boolean;
  title: string;
  message: string;
  variant: ModalVariant;
};

type Evidence = {
  evidenceFileId: number;
  originalName: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

type CurrentScore = {
  processScoreId: number;
  quantity: number;
  awardedPoints: string;
  evidences: Evidence[];
};

type ScoringItem = {
  itemId: number;
  description: string;
  unit: string | null;
  points: string | number;
  hasMaxPoints: boolean;
  maxPoints?: string | number | null;
  active: boolean;
  formulaKey: string | null;
  currentScore: CurrentScore | null;
};

type BlockNode = {
  nodeId: number;
  name: string;
  code: string | null;
  parentId: number | null;
  sortOrder: number;
  items: ScoringItem[];
  hasFormula: boolean;
  formulaExpression: string | null;
  totalPoints: number | null;
};

type EstruturaPontuacao = {
  processId: number;
  scoringTableId: number;
  type: ProcessType;
  status: ProcessStatus;
  blocks: BlockNode[];
};

type TreeNode = {
  nodeId: number;
  name: string;
  code: string | null;
  parentId: number | null;
  sortOrder: number;
  items: ScoringItem[];
  children: TreeNode[];
  hasFormula: boolean;
  formulaExpression: string | null;
  totalPoints: number | null;
};

function normalizeYMD(value: string | null | undefined) {
  if (!value) return "";

  const s = value.toString();
  const base = s.length >= 10 ? s.slice(0, 10) : s;

  const [year, month, day] = base.split("-");
  if (!year || !month || !day) return "";

  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toISODateInput(value: string | null | undefined) {
  return normalizeYMD(value);
}

function formatDate(value: string | null | undefined) {
  const ymd = normalizeYMD(value);
  if (!ymd) return "";
  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

function statusLabel(status: ProcessStatus) {
  switch (status) {
    case "DRAFT":
      return "Rascunho";
    case "DOCUMENTATION_PENDING":
      return "Documentação pendente";
    case "SUBMITTED":
      return "Submetido";
    case "AWAITING_EVALUATOR_ACCEPTANCE":
      return "Aguardando aceite dos avaliadores";
    case "AWAITING_ORDINANCE":
      return "Aguardando portaria";
    case "UNDER_REVIEW":
      return "Em análise";
    case "IN_EVALUATION":
      return "Em avaliação";
    case "RETURNED":
      return "Devolvido";
    case "APPROVED":
      return "Aprovado";
    case "REJECTED":
      return "Indeferido";
    case "FINALIZED":
      return "Finalizado";
    default:
      return status;
  }
}

function badgeColor(status: ProcessStatus) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (status === "REJECTED") return "bg-red-100 text-red-800";
  if (status === "RETURNED") return "bg-amber-100 text-amber-800";
  if (status === "DOCUMENTATION_PENDING") return "bg-amber-100 text-amber-800";
  if (status === "UNDER_REVIEW" || status === "IN_EVALUATION") {
    return "bg-blue-100 text-blue-800";
  }
  if (
    status === "SUBMITTED" ||
    status === "AWAITING_EVALUATOR_ACCEPTANCE" ||
    status === "AWAITING_ORDINANCE"
  ) {
    return "bg-slate-100 text-slate-800";
  }
  return "bg-gray-100 text-gray-700";
}

function formatPoints(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "0,00";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function processTypeLabel(process: Processo) {
  return formatProcessTypeLabel(process.processTypeCode, process.processTypeName)
}

function buildTreeFromBlocks(blocks: BlockNode[]): TreeNode[] {
  const map = new Map<number, TreeNode>();

  blocks.forEach((b) => {
    map.set(b.nodeId, {
      nodeId: b.nodeId,
      name: b.name,
      code: b.code,
      parentId: b.parentId,
      sortOrder: b.sortOrder,
      items: b.items,
      children: [],
      hasFormula: b.hasFormula,
      formulaExpression: b.formulaExpression,
      totalPoints: b.totalPoints,
    });
  });

  const roots: TreeNode[] = [];

  map.forEach((node) => {
    if (node.parentId === null || node.parentId === undefined) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortTree(n.children));
  };

  sortTree(roots);
  return roots;
}

function computeNodeTotal(node: TreeNode): number {
  const baseSum = node.items.reduce((acc, item) => {
    const pts = item.currentScore ? Number(item.currentScore.awardedPoints) : 0;
    return acc + (Number.isNaN(pts) ? 0 : pts);
  }, 0);

  let selfTotal = baseSum;

  if (node.hasFormula && node.formulaExpression) {
    const vars: Record<string, number> = {};

    node.items.forEach((item) => {
      if (!item.formulaKey) return;
      const val = item.currentScore ? Number(item.currentScore.quantity) : 0;
      vars[item.formulaKey] = Number.isNaN(val) ? 0 : val;
    });

    try {
      const argNames = Object.keys(vars);
      const argValues = Object.values(vars);

      if (argNames.length > 0) {
        const fn = new Function(
          ...argNames,
          `return ${node.formulaExpression};`,
        ) as (...args: number[]) => number;

        const result = fn(...argValues);
        const num = Number(result);

        selfTotal = Number.isFinite(num) ? num : baseSum;
      } else {
        selfTotal = baseSum;
      }
    } catch (e) {
      console.error("Erro avaliando fórmula do bloco", node.nodeId, e);
      selfTotal = baseSum;
    }
  }

  const childrenSum = node.children.reduce(
    (acc, child) => acc + computeNodeTotal(child),
    0,
  );

  return selfTotal + childrenSum;
}

const PROGRESSAO_MOVES = [
  { from: "B1", to: "B2" },
  { from: "B2", to: "B3" },
  { from: "B3", to: "B4" },
  { from: "C1", to: "C2" },
  { from: "C2", to: "C3" },
  { from: "C3", to: "C4" },
];

const PROMOCAO_MOVES = [
  { from: "A1", to: "B1" },
  { from: "B4", to: "C1" },

];

function isAllowedMove(type: ProcessType, origem: string, destino: string) {
  const from = (origem || "").toUpperCase();
  const to = (destino || "").toUpperCase();

  const list = type === "PROGRESSAO" ? PROGRESSAO_MOVES : PROMOCAO_MOVES;
  return list.some((m) => m.from === from && m.to === to);
}

function getAllowedMoveHint(type: ProcessType) {
  const list = type === "PROGRESSAO" ? PROGRESSAO_MOVES : PROMOCAO_MOVES;
  return list.map((m) => `${m.from} → ${m.to}`).join(", ");
}

export default function ProcessoDetalhePage() {
  const params = useParams();
  const id = (params as any)?.id as string | undefined;

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useFeedbackState<string | null>(null, "error");

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingSheet, setDownloadingSheet] = useState(false);
  const [downloadingEvidence, setDownloadingEvidence] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);

  const [formCampus, setFormCampus] = useState("");
  const [formCidadeUF, setFormCidadeUF] = useState("");
  const [formExternalNumber, setFormExternalNumber] = useState("");
  const [formIntersticioInicio, setFormIntersticioInicio] = useState("");
  const [formIntersticioFim, setFormIntersticioFim] = useState("");
  const [formClasseOrigem, setFormClasseOrigem] = useState("");
  const [formNivelOrigem, setFormNivelOrigem] = useState("");
  const [formClasseDestino, setFormClasseDestino] = useState("");
  const [formNivelDestino, setFormNivelDestino] = useState("");
  const [formRscTargetLevel, setFormRscTargetLevel] = useState("");
  const [formEvaluationMode, setFormEvaluationMode] = useState<
    "MEMORIAL" | "THESIS"
  >("MEMORIAL");
  const [formFinalReferenceDate, setFormFinalReferenceDate] = useState("");

  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    message: "",
    variant: "info",
  });

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const [loadingScores, setLoadingScores] = useState(true);
  const [totalProcessPoints, setTotalProcessPoints] = useState(0);

  const isRejectedFinal = !!processo && processo.status === "REJECTED";
  const isCareerProcess =
    !!processo &&
    (processo.processTypeCategory === "CAREER" || !!processo.type);
  const requiresScoring =
    !!processo &&
    (processo.processTypeConfig?.requiresScoring ?? isCareerProcess);
  const minimumPoints =
    processo?.scoringTable?.minRequiredPoints !== null &&
    processo?.scoringTable?.minRequiredPoints !== undefined
      ? Number(processo.scoringTable.minRequiredPoints)
      : processo?.processTypeCategory === "RSC"
        ? 60
        : 120;

  const isEditable =
    !!processo &&
    !isRejectedFinal &&
    (processo.status === "DRAFT" || processo.status === "RETURNED");

  const canDelete =
    !!processo && !isRejectedFinal && processo.status === "DRAFT";
  const canFillScores = isEditable && requiresScoring;

  const hasMinimumPoints =
    !requiresScoring || totalProcessPoints >= minimumPoints;
  const hasConfiguredDocuments =
    !!processo &&
    (processo.processTypeConfig?.documentRequirements ?? []).every(
      (requirement) =>
        !requirement.required ||
        (processo.configuredDocuments ?? []).some(
          (document) =>
            document.documentType === requirement.code && document.file,
        ),
    );
  const hasSpecificRequiredDocuments = !processo
    ? false
    : processo.processTypeCategory === "RSC"
      ? !!processo.rscDetails?.reportFile
      : processo.processTypeCategory === "FULL_PROFESSOR"
        ? !!(
            (processo.fullProfessorDetails?.evaluationMode === "MEMORIAL"
              ? processo.fullProfessorDetails.memorialFile
              : processo.fullProfessorDetails?.thesisFile) &&
            processo.fullProfessorDetails?.doctorateDegree?.conclusionDate &&
            processo.fullProfessorDetails?.doctorateDegree?.evidenceFile
          )
        : true;
  const hasRequiredDocuments =
    hasConfiguredDocuments && hasSpecificRequiredDocuments;

  const canSendForReview =
    !!processo &&
    !isRejectedFinal &&
    hasMinimumPoints &&
    hasRequiredDocuments &&
    (processo.status === "DRAFT" || processo.status === "RETURNED");

  const canGenerateDocuments =
    !!processo &&
    !isRejectedFinal &&
    isCareerProcess &&
    (processo.status === "SUBMITTED" ||
      processo.status === "UNDER_REVIEW" ||
      processo.status === "APPROVED");

  const movementOrigem = useMemo(() => {
    const c = (formClasseOrigem || "").toUpperCase();
    const n = (formNivelOrigem || "").toUpperCase();
    return c && n ? `${c}${n}` : "";
  }, [formClasseOrigem, formNivelOrigem]);

  const movementDestino = useMemo(() => {
    const c = (formClasseDestino || "").toUpperCase();
    const n = (formNivelDestino || "").toUpperCase();
    return c && n ? `${c}${n}` : "";
  }, [formClasseDestino, formNivelDestino]);

  const isMovementValid = useMemo(() => {
    if (!processo) return true;
    if (!isCareerProcess || !processo.type) return true;
    if (!movementOrigem || !movementDestino) return true;
    return isAllowedMove(processo.type, movementOrigem, movementDestino);
  }, [processo, isCareerProcess, movementOrigem, movementDestino]);

  const showAnyAction =
    (id && canFillScores) ||
    canGenerateDocuments ||
    canSendForReview ||
    canDelete;

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const r = await fetch(`/api/processos/${id}`, {
          method: "GET",
          credentials: "include",
        });

        const json = (await r
          .json()
          .catch(() => null)) as ApiResponse<Processo>;

        if (!r.ok) {
          setError(json?.message || "Erro ao carregar processo");
          setProcesso(null);
          return;
        }

        if (!json?.data) {
          setError("Processo não encontrado");
          setProcesso(null);
          return;
        }

        setProcesso(json.data);
        resetFormFromProcess(json.data);
      } catch (e: any) {
        setError(e?.message || "Erro inesperado ao carregar processo");
        setProcesso(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  useEffect(() => {
    async function loadScores() {
      if (!id || !processo) return;
      if (!requiresScoring) {
        setTotalProcessPoints(0);
        setLoadingScores(false);
        return;
      }
      setLoadingScores(true);

      try {
        const r = await fetch(`/api/processos/${id}/pontuacao/estrutura`, {
          method: "GET",
          credentials: "include",
        });

        const json = (await r
          .json()
          .catch(() => null)) as ApiResponse<EstruturaPontuacao>;

        if (!r.ok || !json?.data) {
          setTotalProcessPoints(0);
          return;
        }

        const data = json.data;
        const treeRoots = buildTreeFromBlocks(data.blocks);
        const sum = treeRoots.reduce(
          (acc, node) => acc + computeNodeTotal(node),
          0,
        );

        setTotalProcessPoints(sum);
      } catch (e) {
        setTotalProcessPoints(0);
      } finally {
        setLoadingScores(false);
      }
    }

    loadScores();
  }, [id, processo?.processId, requiresScoring]);

  function openModal(payload: Omit<ModalState, "open">) {
    setModal({
      open: true,
      ...payload,
    });
  }

  function closeModal() {
    setModal((prev) => ({ ...prev, open: false }));
  }

  function resetFormFromProcess(p: Processo | null) {
    if (!p) return;
    setFormCampus(p.campus ?? "");
    setFormCidadeUF(p.cidadeUF ?? "");
    setFormExternalNumber(p.externalNumber ?? "");
    setFormIntersticioInicio(toISODateInput(p.intersticeStart));
    setFormIntersticioFim(toISODateInput(p.intersticeEnd));
    setFormClasseOrigem(p.classeOrigem ?? "");
    setFormNivelOrigem(p.nivelOrigem ?? "");
    setFormClasseDestino(p.classeDestino ?? "");
    setFormNivelDestino(p.nivelDestino ?? "");
    setFormRscTargetLevel(p.rscDetails?.targetLevel ?? "");
    setFormEvaluationMode(p.fullProfessorDetails?.evaluationMode ?? "MEMORIAL");
    setFormFinalReferenceDate(
      toISODateInput(p.fullProfessorDetails?.finalReferenceDate),
    );
  }

  async function refreshComplianceDetails() {
    const response = await fetch(`/api/processos/${id}`, { credentials: "include", cache: "no-store" });
    const payload = await response.json().catch(() => null) as ApiResponse<Processo>;
    if (!response.ok || !payload?.data) throw new Error("Registro salvo; atualize a página para conferir os detalhes do processo.");
    setProcesso(payload.data);
  }

  async function handleGerarRequerimento() {
    if (!id) return;
    setDownloading(true);
    setError(null);

    try {
      const r = await fetch(`/api/processos/requerimento/${id}`, {
        method: "POST",
        credentials: "include",
      });

      if (!r.ok) {
        const json = await r.json().catch(() => null as any);
        const message =
          json?.message ||
          "Erro ao gerar requerimento. Verifique as regras do processo.";
        openModal({
          title: "Erro ao gerar requerimento",
          message,
          variant: "error",
        });
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const suggested =
        (r.headers.get("Content-Disposition") ||
          r.headers.get("content-disposition") ||
          "") ??
        "";

      let filename = `requerimento-processo-${id}.pdf`;
      const match = suggested.match(/filename="?([^"]+)"?/i);
      if (match && match[1]) filename = match[1];

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao gerar o requerimento.",
        variant: "error",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleGerarPlanilha() {
    if (!id) return;
    setDownloadingSheet(true);

    try {
      const r = await fetch(`/api/processos/${id}/pontuacao/planilha`, {
        method: "GET",
        credentials: "include",
      });

      if (!r.ok) {
        const json = await r.json().catch(() => null as any);
        openModal({
          title: "Erro ao gerar planilha",
          message:
            json?.message ||
            "Não foi possível gerar a planilha de pontuação para este processo.",
          variant: "error",
        });
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      let filename = `pontuacao-processo-${id}.pdf`;

      const suggested =
        (r.headers.get("Content-Disposition") ||
          r.headers.get("content-disposition") ||
          "") ??
        "";

      const match = suggested.match(/filename="?([^"]+)"?/i);
      if (match && match[1]) filename = match[1];

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message:
          e?.message || "Ocorreu um erro ao gerar a planilha de pontuação.",
        variant: "error",
      });
    } finally {
      setDownloadingSheet(false);
    }
  }

  async function handleBaixarComprovantes() {
    if (!id) return;
    setDownloadingEvidence(true);

    try {
      const r = await fetch(`/api/processos/${id}/pontuacao/comprovantes`, {
        method: "GET",
        credentials: "include",
      });

      if (!r.ok) {
        const json = await r.json().catch(() => null as any);
        openModal({
          title: "Erro ao gerar comprovantes",
          message:
            json?.message ||
            "Não foi possível gerar o PDF com os comprovantes deste processo.",
          variant: "error",
        });
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      let filename = `comprovantes-processo-${id}.pdf`;

      const suggested =
        (r.headers.get("Content-Disposition") ||
          r.headers.get("content-disposition") ||
          "") ??
        "";

      const match = suggested.match(/filename="?([^"]+)"?/i);
      if (match && match[1]) filename = match[1];

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao gerar os comprovantes.",
        variant: "error",
      });
    } finally {
      setDownloadingEvidence(false);
    }
  }

  async function handleEnviarProcesso() {
    if (!id || !processo) return;
    setSending(true);

    try {
      const r = await fetch(`/api/processos/${id}/enviar`, {
        method: "POST",
        credentials: "include",
      });

      const json = (await r.json().catch(() => null)) as ApiResponse<{
        processId: number;
        status: ProcessStatus;
        totalPoints: number;
      }>;

      if (!r.ok) {
        openModal({
          title: "Não foi possível enviar o processo",
          message:
            json?.message ||
            "Ocorreu um erro ao enviar o processo para avaliação da CPPD.",
          variant: "error",
        });
        return;
      }

      if (json?.data) {
        setProcesso((prev) =>
          prev
            ? {
                ...prev,
                status: json.data!.status,
              }
            : prev,
        );
        if (typeof json.data.totalPoints === "number") {
          setTotalProcessPoints(json.data.totalPoints);
        }
      }

      openModal({
        title: "Processo enviado",
        message:
          "O processo foi enviado para avaliação da CPPD com sucesso. A partir de agora não é mais possível editar os dados ou documentos.",
        variant: "success",
      });
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message:
          e?.message ||
          "Ocorreu um erro inesperado ao enviar o processo para avaliação.",
        variant: "error",
      });
    } finally {
      setSending(false);
      setConfirmSendOpen(false);
    }
  }

  async function handleSaveEdit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!id || !processo) return;

    if (!isMovementValid && processo.type) {
      openModal({
        title: "Movimentação inválida",
        message:
          `Para ${processo.type === "PROGRESSAO" ? "Progressão" : "Promoção"}, ` +
          `as combinações permitidas são: ${getAllowedMoveHint(processo.type)}.`,
        variant: "error",
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const processoPayload: any = {};

      if (formCampus !== processo.campus) {
        processoPayload.campus = formCampus;
      }

      if (formCidadeUF !== processo.cidadeUF) {
        processoPayload.cidadeUF = formCidadeUF;
      }

      if (formExternalNumber !== (processo.externalNumber ?? "")) {
        processoPayload.externalNumber = formExternalNumber;
      }

      if (isCareerProcess) {
        const originalInicio = toISODateInput(processo.intersticeStart);
        const originalFim = toISODateInput(processo.intersticeEnd);

        if (formIntersticioInicio && formIntersticioInicio !== originalInicio) {
          processoPayload.intersticioInicioISO = formIntersticioInicio;
        }

        if (formIntersticioFim && formIntersticioFim !== originalFim) {
          processoPayload.intersticioFimISO = formIntersticioFim;
        }

        if (formClasseOrigem && formClasseOrigem !== processo.classeOrigem) {
          processoPayload.classeOrigem = formClasseOrigem;
        }

        if (formNivelOrigem && formNivelOrigem !== processo.nivelOrigem) {
          processoPayload.nivelOrigem = formNivelOrigem;
        }

        if (formClasseDestino && formClasseDestino !== processo.classeDestino) {
          processoPayload.classeDestino = formClasseDestino;
        }

        if (formNivelDestino && formNivelDestino !== processo.nivelDestino) {
          processoPayload.nivelDestino = formNivelDestino;
        }
      } else if (processo.processTypeCategory === "RSC") {
        if (formRscTargetLevel !== (processo.rscDetails?.targetLevel ?? "")) {
          processoPayload.rscDetails = {
            targetLevel: formRscTargetLevel,
          };
        }
      } else if (processo.processTypeCategory === "FULL_PROFESSOR") {
        if (
          formEvaluationMode !==
            processo.fullProfessorDetails?.evaluationMode ||
          formFinalReferenceDate !==
            toISODateInput(processo.fullProfessorDetails?.finalReferenceDate)
        ) {
          processoPayload.fullProfessorDetails = {
            evaluationMode: formEvaluationMode,
            finalReferenceDateISO: formFinalReferenceDate || null,
          };
        }
      }

      const hasChanges = Object.keys(processoPayload).length > 0;

      if (!hasChanges) {
        setEditMode(false);
        return;
      }

      const payload = {
        processo: processoPayload,
      };

      const r = await fetch(`/api/processos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = (await r.json().catch(() => null)) as ApiResponse<Processo>;

      if (!r.ok) {
        const message = json?.message || "Erro ao salvar alterações.";
        openModal({
          title: "Erro ao salvar",
          message,
          variant: "error",
        });
        return;
      }

      if (!json?.data) {
        openModal({
          title: "Erro",
          message: "Resposta inválida do servidor ao salvar processo.",
          variant: "error",
        });
        return;
      }

      setProcesso(json.data);
      resetFormFromProcess(json.data);
      setEditMode(false);
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao salvar as alterações.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick() {
    if (!processo) return;
    if (!canDelete) return;

    setConfirmDeleteOpen(true);
  }

  async function handleDeleteConfirmed() {
    if (!id || !processo) return;
    if (!canDelete) return;

    setConfirmDeleteOpen(false);
    setDeleting(true);
    setError(null);

    try {
      const r = await fetch(`/api/processos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = (await r.json().catch(() => null)) as ApiResponse<any>;

      if (!r.ok) {
        const message = json?.message || "Erro ao excluir processo.";
        openModal({
          title: "Erro ao excluir",
          message,
          variant: "error",
        });
        return;
      }

      openModal({
        title: "Processo excluído",
        message: "Processo excluído com sucesso.",
        variant: "success",
      });

      setTimeout(() => {
        window.location.href = "/docente/processos";
      }, 600);
    } catch (e: any) {
      openModal({
        title: "Erro inesperado",
        message: e?.message || "Ocorreu um erro ao excluir o processo.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  const movementErrorText =
    processo?.type && movementOrigem && movementDestino && !isMovementValid
      ? `Movimentação inválida para ${processo.type === "PROGRESSAO" ? "Progressão" : "Promoção"}. ` +
        `Permitidas: ${getAllowedMoveHint(processo.type)}.`
      : null;

  return (
    <main className="min-h-[60vh]">
      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        onClose={closeModal}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Confirmar exclusão"
        description={
          processo
            ? `Tem certeza que deseja excluir o processo nº ${processo.processId}?`
            : "Tem certeza que deseja excluir este processo?"
        }
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        loading={deleting}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmModal
        open={confirmSendOpen}
        title="Confirmar envio do processo"
        description={
          "Tem certeza que deseja enviar este processo para análise da CPPD? " +
          "Após o envio você não poderá mais editar os dados, a pontuação ou os documentos."
        }
        confirmText={sending ? "Enviando..." : "Enviar processo"}
        cancelText="Cancelar"
        loading={sending}
        onConfirm={handleEnviarProcesso}
        onCancel={() => setConfirmSendOpen(false)}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Detalhes do Processo {id ? `#${id}` : ""}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Visualize as informações, edite os dados permitidos e acompanhe a
              documentação e o andamento do processo.
            </p>
          </div>
          <div className="flex gap-3">
            <></>
          </div>
        </header>
<ProcessSteps steps={[{"title":"Revisar os dados","description":"Confira as informações gerais e use Editar quando o processo permitir."},{"title":"Preencher e comprovar","description":"Preencha a pontuação e anexe os documentos e comprovantes solicitados."},{"title":"Revisar e enviar","description":"Confira os requisitos e envie à CPPD. Depois, acompanhe o resultado nesta tela."}]} />

        {loading && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando processo...
            </p>
          </div>
        )}

        {!loading && error && (
          null
        )}

        {!loading && !error && !processo && (
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">
              Processo não encontrado.
            </p>
          </div>
        )}

        {!loading && !error && processo && (
          <div className="space-y-6">
            <section className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Informações gerais
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                      badgeColor(processo.status)
                    }
                  >
                    {statusLabel(processo.status)}
                  </span>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!editMode) resetFormFromProcess(processo);
                        setEditMode(true);
                      }}
                      className="px-3 py-1.5 rounded-full border border-[var(--btn-secondary-border)]
                                 text-xs text-[var(--btn-secondary-text)]
                                 hover:bg-[var(--btn-secondary-hover-bg)] transition"
                    >
                      Editar dados
                    </button>
                  )}
                </div>
              </div>

              {!editMode && (
                <div className="text-sm space-y-1 text-[var(--text-secondary)]">
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Número:
                    </span>{" "}
                    {processo.processId}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Tipo:
                    </span>{" "}
                    {processTypeLabel(processo)}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Situação:
                    </span>{" "}
                    {statusLabel(processo.status)}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Campus:
                    </span>{" "}
                    {processo.campus}
                  </div>
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      Cidade/UF:
                    </span>{" "}
                    {processo.cidadeUF}
                  </div>
                  {processo.externalNumber && (
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">
                        Número externo:
                      </span>{" "}
                      {processo.externalNumber}
                    </div>
                  )}
                  {isCareerProcess && (
                    <>
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">
                          Interstício:
                        </span>{" "}
                        {formatDate(processo.intersticeStart)}{" "}
                        <span className="text-[var(--text-muted)]">→</span>{" "}
                        {formatDate(processo.intersticeEnd)}
                      </div>
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">
                          Origem:
                        </span>{" "}
                        {processo.classeOrigem}
                        {processo.nivelOrigem}
                      </div>
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">
                          Destino:
                        </span>{" "}
                        {processo.classeDestino}
                        {processo.nivelDestino}
                      </div>
                    </>
                  )}
                  {processo.processTypeCategory === "RSC" && (
                    <>
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">
                          Nível pretendido:
                        </span>{" "}
                        {processo.rscDetails?.targetLevel?.replace("_", " ")}
                      </div>
                    </>
                  )}
            {processo.processTypeCategory === "FULL_PROFESSOR" && (
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">
                        Modalidade:
                      </span>{" "}
                      {processo.fullProfessorDetails?.evaluationMode ===
                      "THESIS"
                        ? "Tese acadêmica inédita"
                        : "Memorial"}
                    </div>
                  )}
                </div>
              )}

              <CaseCompliancePanel processId={processo.processId} actor="DOCENTE" onChanged={refreshComplianceDetails} />
              {editMode && (
                <form
                  onSubmit={handleSaveEdit}
                  className="space-y-4 mt-3 border-t border-[var(--border-subtle)] pt-4"
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Campus
                      </label>
                      <FormInput
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formCampus}
                        onChange={(e) => setFormCampus(e.target.value)}
                       aria-label="Campus" />
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <label className="text-[var(--text-secondary)]">
                        Cidade/UF
                      </label>
                      <FormInput
                        className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                        value={formCidadeUF}
                        onChange={(e) => setFormCidadeUF(e.target.value)}
                       aria-label="Cidade/UF" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-sm">
                    <label className="text-[var(--text-secondary)]">
                      Número do processo externo
                    </label>
                    <FormInput
                      className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                 bg-[var(--input-bg)] text-[var(--text-primary)]
                                 placeholder:text-[var(--input-placeholder)]
                                 focus:outline-none focus:border-[var(--input-border-focus)]"
                      value={formExternalNumber}
                      onChange={(e) => setFormExternalNumber(e.target.value)}
                     aria-label="Número do processo externo" />
                  </div>

                  {isCareerProcess && (
                    <>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-[var(--text-secondary)]">
                            Início do interstício
                          </label>
                          <FormInput
                            type="date"
                            className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                            value={formIntersticioInicio}
                            onChange={(e) =>
                              setFormIntersticioInicio(e.target.value)
                            }
                           aria-label="Início do interstício" />
                        </div>
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-[var(--text-secondary)]">
                            Fim do interstício
                          </label>
                          <FormInput
                            type="date"
                            className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                            value={formIntersticioFim}
                            onChange={(e) =>
                              setFormIntersticioFim(e.target.value)
                            }
                           aria-label="Fim do interstício" />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-[var(--text-secondary)]">
                            Classe de origem
                          </label>
                          <FormInput
                            className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                            value={formClasseOrigem}
                            onChange={(e) =>
                              setFormClasseOrigem(e.target.value.toUpperCase())
                            }
                           aria-label="Classe de origem" />
                        </div>
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-[var(--text-secondary)]">
                            Nível de origem
                          </label>
                          <FormInput
                            className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                            value={formNivelOrigem}
                            onChange={(e) => setFormNivelOrigem(e.target.value)}
                           aria-label="Nível de origem" />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-[var(--text-secondary)]">
                            Classe de destino
                          </label>
                          <FormInput
                            className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                            value={formClasseDestino}
                            onChange={(e) =>
                              setFormClasseDestino(e.target.value.toUpperCase())
                            }
                           aria-label="Classe de destino" />
                        </div>
                        <div className="flex flex-col gap-1 text-sm">
                          <label className="text-[var(--text-secondary)]">
                            Nível de destino
                          </label>
                          <FormInput
                            className="border border-[var(--input-border)] rounded-xl p-2 text-sm
                                   bg-[var(--input-bg)] text-[var(--text-primary)]
                                   placeholder:text-[var(--input-placeholder)]
                                   focus:outline-none focus:border-[var(--input-border-focus)]"
                            value={formNivelDestino}
                            onChange={(e) =>
                              setFormNivelDestino(e.target.value)
                            }
                           aria-label="Nível de destino" />
                        </div>
                      </div>

                      {movementErrorText && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                          {movementErrorText}
                        </div>
                      )}
                    </>
                  )}

                  {processo.processTypeCategory === "RSC" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
                        Nível pretendido
                        <FormSelect
                          value={formRscTargetLevel}
                          onChange={(e) =>
                            setFormRscTargetLevel(e.target.value)
                          }
                          className="border border-[var(--input-border)] rounded-xl p-2 text-sm bg-[var(--input-bg)] text-[var(--text-primary)]"
                         aria-label="Nível pretendido" >
                          <option value="RSC_I">RSC I</option>
                          <option value="RSC_II">RSC II</option>
                          <option value="RSC_III">RSC III</option>
                        </FormSelect>
                      </label>
                    </div>
                  )}

                  {processo.processTypeCategory === "FULL_PROFESSOR" && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
                        Modalidade de avaliação
                        <FormSelect
                          value={formEvaluationMode}
                          onChange={(e) =>
                            setFormEvaluationMode(
                              e.target.value as "MEMORIAL" | "THESIS",
                            )
                          }
                          className="border border-[var(--input-border)] rounded-xl p-2 text-sm bg-[var(--input-bg)] text-[var(--text-primary)]"
                         aria-label="Modalidade de avaliação" >
                          <option value="MEMORIAL">Memorial</option>
                          <option value="THESIS">Tese acadêmica inédita</option>
                        </FormSelect>
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
                        Data de referência final, calculada pelo sistema
                        <FormInput
                          type="date"
                          disabled
                          value={formFinalReferenceDate}
                          onChange={(e) =>
                            setFormFinalReferenceDate(e.target.value)
                          }
                          className="border border-[var(--input-border)] rounded-xl p-2 text-sm bg-[var(--input-bg)] text-[var(--text-primary)]"
                         disabledReason={"Este dado é apenas para consulta neste perfil. A alteração deve ser feita pelo administrador ou pelo titular do cadastro."}  aria-label="Data de referência final, calculada pelo sistema" />
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false);
                        resetFormFromProcess(processo);
                      }}
                      className="px-3 py-1.5 rounded-full border border-[var(--btn-secondary-border)]
                                 text-xs text-[var(--btn-secondary-text)]
                                 hover:bg-[var(--btn-secondary-hover-bg)] transition"
                    >
                      Cancelar
                    </button>
                    <ActionButton
                      type="submit"
                      disabled={saving}
                      className="px-3 py-1.5 rounded-full text-xs font-medium
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-50 transition"
                     disabledReason={(saving) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                      {saving ? "Salvando..." : "Salvar alterações"}
                    </ActionButton>
                  </div>
                </form>
              )}
            </section>

            <ConfiguredProcessDocuments<Processo>
              processId={processo.processId}
              requirements={
                processo.processTypeConfig?.documentRequirements ?? []
              }
              documents={processo.configuredDocuments ?? []}
              editable={isEditable}
              onUpdated={(updated) => {
                setProcesso(updated);
                resetFormFromProcess(updated);
              }}
              notify={openModal}
            />

            <SpecificProcessDocuments<Processo>
              processId={processo.processId}
              category={processo.processTypeCategory}
              editable={isEditable}
              rscDetails={processo.rscDetails}
              fullProfessorDetails={processo.fullProfessorDetails}
              onUpdated={(updated) => {
                setProcesso(updated);
                resetFormFromProcess(updated);
              }}
              notify={openModal}
            />

            {processo.processTypeCategory === "FULL_PROFESSOR" && (
              <FullProfessorProcedurePanel
                processId={processo.processId}
                actor="TEACHER"
              />
            )}

            <section className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-sm">
              {requiresScoring && (
                <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                  <div className="font-semibold text-[var(--text-primary)]">
                    Resumo de pontuação
                  </div>

                  {loadingScores && (
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Carregando resumo de pontuação...
                    </div>
                  )}

                  {!loadingScores && (
                    <>
                      <div>
                        Pontuação total do processo:{" "}
                        <span className="font-bold text-[var(--text-primary)]">
                          {formatPoints(totalProcessPoints)} pontos
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        É necessário atingir pelo menos{" "}
                        <span className="font-medium">
                          {formatPoints(minimumPoints)} pontos
                        </span>{" "}
                        para enviar o processo para avaliação da CPPD.
                      </div>

                      {!hasMinimumPoints && (
                        <div className="text-[11px] text-red-600 mt-1">
                          Pontuação mínima ainda não alcançada. Continue
                          preenchendo a planilha para atingir os{" "}
                          {formatPoints(minimumPoints)} pontos necessários.
                        </div>
                      )}

                      {processo.status !== "DRAFT" &&
                        processo.status !== "RETURNED" && (
                          <div className="text-[11px] text-[var(--text-muted)] mt-1">
                            O processo só pode ser enviado enquanto estiver nos
                            status <span className="font-medium">Rascunho</span>{" "}
                            ou <span className="font-medium">Devolvido</span>.
                          </div>
                        )}
                    </>
                  )}
                </div>
              )}

              {showAnyAction && (
                <div className="flex flex-wrap gap-3 items-center">
                  {id && canFillScores && (
                    <Link
                      href={`/docente/processos/${id}/pontuacao`}
                      className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                    >
                      Preencher pontuação
                    </Link>
                  )}

                  {canSendForReview && (
                    <ActionButton
                      type="button"
                      onClick={() => setConfirmSendOpen(true)}
                      disabled={sending}
                      className="px-4 py-2 rounded-full text-sm font-medium
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-50 disabled:cursor-not-allowed transition"
                     disabledReason={(sending) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                      Enviar processo para análise
                    </ActionButton>
                  )}

                  {canGenerateDocuments && (
                    <ActionButton
                      type="button"
                      onClick={handleGerarRequerimento}
                      disabled={downloading}
                      className="px-4 py-2 rounded-full text-sm font-medium
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-50 disabled:cursor-not-allowed transition"
                     disabledReason={(downloading) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                      {downloading
                        ? "Gerando requerimento..."
                        : "Gerar requerimento"}
                    </ActionButton>
                  )}

                  {canGenerateDocuments && (
                    <ActionButton
                      type="button"
                      onClick={handleGerarPlanilha}
                      disabled={downloadingSheet}
                      className="px-4 py-2 rounded-full text-sm font-medium
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-50 disabled:cursor-not-allowed transition"
                     disabledReason={(downloadingSheet) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                      {downloadingSheet
                        ? "Gerando planilha..."
                        : "Gerar planilha de pontuação"}
                    </ActionButton>
                  )}

                  {canGenerateDocuments && (
                    <ActionButton
                      type="button"
                      onClick={handleBaixarComprovantes}
                      disabled={downloadingEvidence}
                      className="px-4 py-2 rounded-full text-sm font-medium
                                 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]
                                 hover:bg-[var(--btn-primary-hover-bg)]
                                 disabled:opacity-50 disabled:cursor-not-allowed transition"
                     disabledReason={(downloadingEvidence) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                      {downloadingEvidence
                        ? "Gerando comprovantes..."
                        : "Baixar comprovantes"}
                    </ActionButton>
                  )}

                  {canDelete && (
                    <ActionButton
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={deleting}
                      className="px-4 py-2 rounded-full border border-red-300 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                     disabledReason={(deleting) ? "Aguarde a operação em andamento terminar." : "Este controle está indisponível na etapa atual."} >
                      {deleting ? "Excluindo..." : "Excluir processo"}
                    </ActionButton>
                  )}
                </div>
              )}

              <div className="space-y-1 text-[11px] text-[var(--text-muted)]">
                {isRejectedFinal && (
                  <p className="text-red-600">
                    Este processo foi indeferido e não permite novas ações.
                  </p>
                )}

                {processo &&
                  (processo.status === "DRAFT" ||
                    processo.status === "RETURNED") && (
                    <p>
                      Antes de enviar, revise cuidadosamente as informações
                      preenchidas e os documentos anexados. Após o envio, você
                      não poderá mais alterá-los.
                    </p>
                  )}

                {isEditable && !hasRequiredDocuments && (
                  <p className="text-amber-700">
                    Anexe todos os documentos obrigatórios para liberar o envio.
                  </p>
                )}

                <p>
                  A exclusão só é permitida para processos no status{" "}
                  <span className="font-medium">RASCUNHO</span>.
                </p>

                {canGenerateDocuments && (
                  <>
                    <p>
                      Gere o requerimento e a planilha de pontuação para
                      encaminhar no SIPAC e oficializar o pedido.
                    </p>
                    <p>
                      Após a CPPD ser comunicada do seu processo, ela irá
                      realizar a análise do processo.
                    </p>
                  </>
                )}

                {requiresScoring && !canFillScores && !isRejectedFinal && (
                  <p>
                    O preenchimento da pontuação só é permitido para processos
                    nos status <span className="font-medium">RASCUNHO</span> ou{" "}
                    <span className="font-medium">DEVOLVIDO</span>.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
