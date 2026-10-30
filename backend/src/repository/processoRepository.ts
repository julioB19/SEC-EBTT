import { auditActor } from "../util/requestActor";
import { prisma } from "../infra/prismaClient";
import {
  FullProfessorEvaluationMode,
  ProcessStatus,
  ProcessType,
} from "@prisma/client";
import { AberturaProcessoDto } from "../type/dto/processoDto";

export type ProcessDocumentFileInput = {
  originalName: string;
  storedName: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

const processTypeConfigInclude = {
  include: {
    documentRequirements: {
      where: { active: true, deletedDate: null },
      orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
    },
  },
};

const processDetailsInclude = {
  progressionDetail: true,
  rscDetail: {
    include: {
      reportFile: true,
      generatedSpreadsheetFile: true,
    },
  },
  compliance: true,
  nominees: true,
  fullProfessorDetail: {
    include: {
      memorialFile: true,
      thesisFile: true,
      doctorateDegree: {
        include: {
          evidenceFile: true,
        },
      },
    },
  },
  documents: {
    where: {
      deletedDate: null,
      purpose: "PROCESS_REQUIREMENT",
    },
    include: { evidenceFile: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

export class ProcessRepository {
  async create(
    userId: number,
    scoringTableId: number | null,
    processType: ProcessType | null,
    dto: AberturaProcessoDto,
    processTypeId: number,
    processTypeCode: string,
  ) {
    console.log("ProcessRepository.create =>", {
      userId,
      scoringTableId,
      processType,
    });

    const docente = await prisma.docenteProfile.findFirst({
      where: { userId, deletedDate: null },
      select: { campusId: true },
    });

    return prisma.careerProcess.create({
      data: {
        userId,
        campusId: docente?.campusId ?? null,
        processTypeId,
        scoringTableId,
        type: processType,
        status: ProcessStatus.DRAFT,

        campus: dto.campus,
        cidadeUF: dto.cidadeUF,
        externalNumber: dto.externalNumber?.trim() || null,
        intersticeStart: dto.intersticioInicioISO
          ? new Date(dto.intersticioInicioISO)
          : null,
        intersticeEnd: dto.intersticioFimISO
          ? new Date(dto.intersticioFimISO)
          : null,
        classeOrigem: dto.classeOrigem?.trim() || null,
        nivelOrigem: dto.nivelOrigem?.trim() || null,
        classeDestino: dto.classeDestino?.trim() || null,
        nivelDestino: dto.nivelDestino?.trim() || null,
        progressionDetail: processType
          ? {
              create: {
                originClass: dto.classeOrigem?.trim() || null,
                originLevel: dto.nivelOrigem?.trim() || null,
                targetClass: dto.classeDestino?.trim() || null,
                targetLevel: dto.nivelDestino?.trim() || null,
                intersticeStart: dto.intersticioInicioISO
                  ? new Date(dto.intersticioInicioISO)
                  : null,
                intersticeEnd: dto.intersticioFimISO
                  ? new Date(dto.intersticioFimISO)
                  : null,
              },
            }
          : undefined,
        rscDetail:
          processTypeCode === "RSC"
            ? {
                create: {
                  targetLevel: dto.rscDetails?.targetLevel?.trim() || null,
                  careerEntryDate: dto.rscDetails?.careerEntryDateISO
                    ? new Date(dto.rscDetails.careerEntryDateISO)
                    : null,
                  previousRscGrantedAt: dto.rscDetails
                    ?.previousRscGrantedAtISO
                    ? new Date(dto.rscDetails.previousRscGrantedAtISO)
                    : null,
                  activityPeriodStart: dto.rscDetails?.activityPeriodStartISO
                    ? new Date(dto.rscDetails.activityPeriodStartISO)
                    : null,
                  activityPeriodEnd: dto.rscDetails?.activityPeriodEndISO
                    ? new Date(dto.rscDetails.activityPeriodEndISO)
                    : null,
                  truthDeclarationAcceptedAt: dto.rscDetails
                    ?.truthDeclarationAccepted
                    ? new Date()
                    : null,
                },
              }
            : undefined,
        fullProfessorDetail:
          processTypeCode === "FULL_PROFESSOR"
            ? {
                create: {
                  evaluationMode: dto.fullProfessorDetails?.evaluationMode
                    ? (String(
                        dto.fullProfessorDetails.evaluationMode,
                      ) as FullProfessorEvaluationMode)
                    : null,
                  doctorateDegreeId:
                    dto.fullProfessorDetails?.doctorateDegreeId ?? null,
                  finalReferenceDate: null,
                },
              }
            : undefined,
      },
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async findActiveProcessTypeConfigByCode(code: string) {
    const now = new Date();
    return prisma.processTypeConfig.findFirst({
      where: {
        code,
        active: true,
        deletedDate: null,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: { version: "desc" },
    });
  }

  async findActiveProcessTypeConfigById(idProcessType: number) {
    const now = new Date();
    return prisma.processTypeConfig.findFirst({
      where: {
        idProcessType,
        active: true,
        deletedDate: null,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
    });
  }

  async listActiveProcessTypeConfigs() {
    const now = new Date();
    return prisma.processTypeConfig.findMany({
      where: {
        active: true,
        deletedDate: null,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: [{ category: "asc" }, { name: "asc" }, { version: "desc" }],
    });
  }

  async findById(idProcess: number) {
    return prisma.careerProcess.findUnique({
      where: {
        idProcess,
      },
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async findByIdForScoreSpreadsheet(idProcess: number) {
    return prisma.careerProcess.findUnique({
      where: {
        idProcess,
      },
      include: {
        user: { include: { docente: true } },
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async updateStatus(
    idProcess: number,
    status: ProcessStatus,
    changedById: number,
    note?: string | null,
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.careerProcess.findUnique({
        where: { idProcess },
      });
      if (!current) return null;

      const updated = await tx.careerProcess.update({
        where: { idProcess },
        data: {
          status,
          ...(status === ProcessStatus.SUBMITTED
            ? { submittedAt: new Date() }
            : {}),
        },
        include: {
          user: true,
          processTypeConfig: processTypeConfigInclude,
          table: true,
          ...processDetailsInclude,
        },
      });

      await tx.processStatusHistory.create({
        data: {
          processId: idProcess,
          fromStatus: current.status,
          toStatus: status,
          changedById,
          note: note?.trim() || null,
        },
      });

      return updated;
    });
  }

  async attachRscReport(
    processId: number,
    userId: number,
    file: ProcessDocumentFileInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const previous = await tx.rscProcessDetail.findUnique({ where: { processId } });
      const evidence = await tx.evidenceFile.create({
        data: {
          userId,
          usageType: "RSC_REPORT",
          originalName: file.originalName,
          storedName: file.storedName,
          url: file.url,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes !== null ? BigInt(file.sizeBytes) : null,
        },
      });

      await tx.rscProcessDetail.update({
        where: { processId },
        data: { reportFileId: evidence.idEvidenceFile },
      });

      await tx.processAudit.create({ data: { processId, actorId: userId, action: "SPECIFIC_DOCUMENT_CHANGED", details: { previous: JSON.parse(JSON.stringify(previous)), fileId: evidence.idEvidenceFile } } });
      return tx.careerProcess.findUnique({
        where: { idProcess: processId },
        include: {
          user: true,
          processTypeConfig: processTypeConfigInclude,
          table: true,
          ...processDetailsInclude,
        },
      });
    });
  }

  async attachFullProfessorDocument(
    processId: number,
    userId: number,
    kind: "FULL_PROFESSOR_MEMORIAL" | "FULL_PROFESSOR_THESIS",
    file: ProcessDocumentFileInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const previous = await tx.fullProfessorProcessDetail.findUnique({ where: { processId } });
      const evidence = await tx.evidenceFile.create({
        data: {
          userId,
          usageType: kind,
          originalName: file.originalName,
          storedName: file.storedName,
          url: file.url,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes !== null ? BigInt(file.sizeBytes) : null,
        },
      });

      await tx.fullProfessorProcessDetail.update({
        where: { processId },
        data:
          kind === "FULL_PROFESSOR_MEMORIAL"
            ? { memorialFileId: evidence.idEvidenceFile }
            : { thesisFileId: evidence.idEvidenceFile },
      });

      await tx.processAudit.create({ data: { processId, actorId: userId, action: "SPECIFIC_DOCUMENT_CHANGED", details: { previous: JSON.parse(JSON.stringify(previous)), fileId: evidence.idEvidenceFile } } });
      if (kind === "FULL_PROFESSOR_THESIS") await tx.processCompliance.upsert({ where: { processId }, create: { processId }, update: { thesisOriginalityDeclaredAt: null } });
      return tx.careerProcess.findUnique({
        where: { idProcess: processId },
        include: {
          user: true,
          processTypeConfig: processTypeConfigInclude,
          table: true,
          ...processDetailsInclude,
        },
      });
    });
  }

  async attachDoctorateDegree(params: {
    processId: number;
    userId: number;
    teacherId: number;
    existingDegreeId?: number | null;
    course: string;
    institution: string;
    conclusionDate: Date;
    file: ProcessDocumentFileInput;
  }) {
    return prisma.$transaction(async (tx) => {
      const evidence = await tx.evidenceFile.create({
        data: {
          userId: params.userId,
          usageType: "DOCTORATE_DEGREE",
          originalName: params.file.originalName,
          storedName: params.file.storedName,
          url: params.file.url,
          mimeType: params.file.mimeType?.slice(0, 60) ?? null,
          sizeBytes:
            params.file.sizeBytes !== null
              ? BigInt(params.file.sizeBytes)
              : null,
        },
      });

      const degree = await tx.teacherDegree.create({ data: {
        teacherId: params.teacherId, degreeType: "DOCTORATE", course: params.course,
        institution: params.institution, conclusionDate: params.conclusionDate,
        evidenceFileId: evidence.idEvidenceFile,
      } });
      const degreeId = degree.idTeacherDegree;
      await tx.processAudit.create({ data: { processId: params.processId, actorId: params.userId,
        action: "DOCTORATE_VERSION_CREATED", details: { previousDegreeId: params.existingDegreeId ?? null, degreeId, fileId: evidence.idEvidenceFile } } });

      await tx.fullProfessorProcessDetail.update({
        where: { processId: params.processId },
        data: { doctorateDegreeId: degreeId },
      });

      await tx.processCompliance.upsert({ where: { processId: params.processId }, create: { processId: params.processId }, update: { doctorateValidatedAt: null } });
      return tx.careerProcess.findUnique({
        where: { idProcess: params.processId },
        include: {
          user: true,
          processTypeConfig: processTypeConfigInclude,
          table: true,
          ...processDetailsInclude,
        },
      });
    });
  }

  async attachConfiguredDocument(params: {
    processId: number;
    userId: number;
    requirementCode: string;
    required: boolean;
    allowsMultiple: boolean;
    file: ProcessDocumentFileInput;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = params.allowsMultiple
        ? null
        : await tx.documentProcess.findFirst({
            where: {
              processId: params.processId,
              documentType: params.requirementCode,
              purpose: "PROCESS_REQUIREMENT",
              deletedDate: null,
            },
            include: { evidenceFile: true },
            orderBy: { createdAt: "desc" },
          });

      const evidence = await tx.evidenceFile.create({
        data: {
          userId: params.userId,
          usageType: "PROCESS_REQUIREMENT",
          originalName: params.file.originalName,
          storedName: params.file.storedName,
          url: params.file.url,
          mimeType: params.file.mimeType?.slice(0, 60) ?? null,
          sizeBytes:
            params.file.sizeBytes !== null
              ? BigInt(params.file.sizeBytes)
              : null,
        },
      });

      if (existing) await tx.documentProcess.update({ where: { idDocumentProcess: existing.idDocumentProcess }, data: { deletedDate: new Date() } });
      const document = await tx.documentProcess.create({ data: {
        processId: params.processId, documentType: params.requirementCode,
        nature: params.required ? "REQUIRED" : "OPTIONAL", format: "PDF", receivedAt: new Date(),
        checked: false, evidenceFileId: evidence.idEvidenceFile, generatedById: params.userId, purpose: "PROCESS_REQUIREMENT"
      } });
      await tx.processAudit.create({ data: { processId: params.processId, actorId: params.userId, action: "DOCUMENT_VERSION_CREATED", details: { kind: params.requirementCode, previousDocumentId: existing?.idDocumentProcess ?? null, previousFileId: existing?.evidenceFileId ?? null, documentId: document.idDocumentProcess, fileId: evidence.idEvidenceFile } } });

      const process = await tx.careerProcess.findUnique({ where: { idProcess: params.processId }, include: { user: true, processTypeConfig: processTypeConfigInclude, table: true, ...processDetailsInclude } });
      return {
        process,
        replacedFileUrl: existing?.evidenceFile?.url ?? null,
      };
    });
  }

  async removeConfiguredDocument(processId: number, documentId: number) {
    return prisma.$transaction(async (tx) => {
      const document = await tx.documentProcess.findFirst({
        where: {
          idDocumentProcess: documentId,
          processId,
          purpose: "PROCESS_REQUIREMENT",
          deletedDate: null,
        },
        include: { evidenceFile: true },
      });
      if (!document) return null;

      const deletedAt = new Date();
      await tx.documentProcess.update({
        where: { idDocumentProcess: document.idDocumentProcess },
        data: { deletedDate: deletedAt },
      });

      await tx.processAudit.create({ data: { processId, actorId: auditActor(0), action: "DOCUMENT_REMOVED", details: { documentId, fileId: document.evidenceFileId } } });

      const process = await tx.careerProcess.findUnique({ where: { idProcess: processId }, include: { user: true, processTypeConfig: processTypeConfigInclude, table: true, ...processDetailsInclude } });
      return {
        process,
        removedFileUrl: document.evidenceFile?.url ?? null,
      };
    });
  }

  async findAnyActiveProcessForUser(userId: number, processTypeId?: number) {
    const activeStatuses: ProcessStatus[] = [
      ProcessStatus.DRAFT,
      ProcessStatus.DOCUMENTATION_PENDING,
      ProcessStatus.SUBMITTED,
      ProcessStatus.AWAITING_EVALUATOR_ACCEPTANCE,
      ProcessStatus.AWAITING_ORDINANCE,
      ProcessStatus.UNDER_REVIEW,
      ProcessStatus.IN_EVALUATION,
      ProcessStatus.RETURNED,
    ];

    const type = processTypeId ? await prisma.processTypeConfig.findUnique({ where: { idProcessType: processTypeId } }) : null;
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        ...(type ? { processTypeConfig: { code: type.code } } : processTypeId ? { processTypeId } : {}),
        status: {
          in: activeStatuses,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findLastApprovedProcessForUser(userId: number) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
      },
      orderBy: {
        intersticeEnd: "desc",
      },
    });
  }

  async findApprovedByProcessTypeId(userId: number, processTypeId: number) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        processTypeId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findApprovedByInterstice(
    userId: number,
    intersticeStart: Date,
    intersticeEnd: Date,
    ignoreProcessId?: number,
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
        intersticeStart,
        intersticeEnd,
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId,
              },
            }
          : {}),
      },
    });
  }

  async findApprovedByMovement(
    userId: number,
    processType: ProcessType,
    classeOrigem: string,
    nivelOrigem: string,
    classeDestino: string,
    nivelDestino: string,
    ignoreProcessId?: number,
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        status: ProcessStatus.APPROVED,
        type: processType,
        classeOrigem,
        nivelOrigem,
        classeDestino,
        nivelDestino,
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId,
              },
            }
          : {}),
      },
    });
  }

  async findByUserAndInterstice(
    userId: number,
    intersticeStart: Date,
    intersticeEnd: Date,
    ignoreProcessId?: number,
  ) {
    return prisma.careerProcess.findFirst({
      where: {
        userId,
        deletedDate: null,
        intersticeStart: {
          lte: intersticeEnd,
        },
        intersticeEnd: {
          gte: intersticeStart,
        },
        ...(ignoreProcessId
          ? {
              idProcess: {
                not: ignoreProcessId,
              },
            }
          : {}),
      },
    });
  }

  async softDelete(idProcess: number) {
    return prisma.careerProcess.update({
      where: {
        idProcess,
      },
      data: {
        deletedDate: new Date(),
      },
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async updateProcess(
    idProcess: number,
    data: {
      campus?: string;
      cidadeUF?: string;
      externalNumber?: string | null;
      intersticeStart?: Date | null;
      intersticeEnd?: Date | null;
      classeOrigem?: string | null;
      nivelOrigem?: string | null;
      classeDestino?: string | null;
      nivelDestino?: string | null;
    },
  ) {
    return prisma.careerProcess.update({
      where: {
        idProcess,
      },
      data,
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async updateRscProcess(
    idProcess: number,
    data: {
      campus?: string;
      cidadeUF?: string;
      externalNumber?: string | null;
      targetLevel?: string;
      careerEntryDate?: Date;
      previousRscGrantedAt?: Date | null;
      activityPeriodStart?: Date;
      activityPeriodEnd?: Date;
      truthDeclarationAccepted?: boolean;
    },
  ) {
    return prisma.careerProcess.update({
      where: { idProcess },
      data: {
        ...(data.campus !== undefined ? { campus: data.campus } : {}),
        ...(data.cidadeUF !== undefined ? { cidadeUF: data.cidadeUF } : {}),
        ...(data.externalNumber !== undefined
          ? { externalNumber: data.externalNumber }
          : {}),
        rscDetail: {
          upsert: {
            create: {
              targetLevel: data.targetLevel ?? null,
              careerEntryDate: data.careerEntryDate ?? null,
              previousRscGrantedAt: data.previousRscGrantedAt ?? null,
              activityPeriodStart: data.activityPeriodStart ?? null,
              activityPeriodEnd: data.activityPeriodEnd ?? null,
              truthDeclarationAcceptedAt: data.truthDeclarationAccepted
                ? new Date()
                : null,
            },
            update: {
              ...(data.targetLevel !== undefined
                ? { targetLevel: data.targetLevel }
                : {}),
              ...(data.careerEntryDate !== undefined
                ? { careerEntryDate: data.careerEntryDate }
                : {}),
              ...(data.previousRscGrantedAt !== undefined
                ? { previousRscGrantedAt: data.previousRscGrantedAt }
                : {}),
              ...(data.activityPeriodStart !== undefined
                ? { activityPeriodStart: data.activityPeriodStart }
                : {}),
              ...(data.activityPeriodEnd !== undefined
                ? { activityPeriodEnd: data.activityPeriodEnd }
                : {}),
              ...(data.truthDeclarationAccepted === true
                ? { truthDeclarationAcceptedAt: new Date() }
                : {}),
            },
          },
        },
      },
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async updateFullProfessorProcess(
    idProcess: number,
    data: {
      campus?: string;
      cidadeUF?: string;
      externalNumber?: string | null;
      evaluationMode?: FullProfessorEvaluationMode;
      doctorateDegreeId?: number | null;
      finalReferenceDate?: Date | null;
    },
  ) {
    return prisma.careerProcess.update({
      where: { idProcess },
      data: {
        ...(data.campus !== undefined ? { campus: data.campus } : {}),
        ...(data.cidadeUF !== undefined ? { cidadeUF: data.cidadeUF } : {}),
        ...(data.externalNumber !== undefined
          ? { externalNumber: data.externalNumber }
          : {}),
        fullProfessorDetail: {
          upsert: {
            create: {
              evaluationMode: data.evaluationMode ?? null,
              doctorateDegreeId: data.doctorateDegreeId ?? null,
              finalReferenceDate: data.finalReferenceDate ?? null,
            },
            update: {
              ...(data.evaluationMode !== undefined
                ? { evaluationMode: data.evaluationMode }
                : {}),
              ...(data.doctorateDegreeId !== undefined
                ? { doctorateDegreeId: data.doctorateDegreeId }
                : {}),
              ...(data.finalReferenceDate !== undefined
                ? { finalReferenceDate: data.finalReferenceDate }
                : {}),
            },
          },
        },
      },
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async listByUser(userId: number, statuses?: ProcessStatus[]) {
    return prisma.careerProcess.findMany({
      where: {
        userId,
        deletedDate: null,
        ...(statuses && statuses.length
          ? {
              status: {
                in: statuses,
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: true,
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async listarParaCppdPorStatus(
    statuses: ProcessStatus[],
    campusIds: number[] | null = null,
  ) {
    return prisma.careerProcess.findMany({
      where: {
        deletedDate: null,
        status: { in: statuses },
        ...(campusIds === null ? {} : { campusId: { in: campusIds } }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        user: { include: { docente: true } },
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
      },
    });
  }

  async obterParaCppdPorId(processId: number) {
    return prisma.careerProcess.findFirst({
      where: {
        idProcess: processId,
        deletedDate: null,
      },
      include: {
        user: { include: { docente: true } },
        processTypeConfig: processTypeConfigInclude,
        table: true,
        ...processDetailsInclude,
        ProcessStatusHistory: {
          where: { deletedDate: null },
          orderBy: { createdAt: "asc" },
          include: { changedBy: true },
        },
      },
    });
  }
}
