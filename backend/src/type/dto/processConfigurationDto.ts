import { ProcessTypeCategory } from "@prisma/client";

export interface ProcessDocumentRequirementInput {
  code: string;
  name: string;
  description?: string | null;
  required?: boolean;
  allowsMultiple?: boolean;
  acceptedFormats?: string | null;
  maxSizeMb?: number | null;
  sortOrder?: number;
  active?: boolean;
}

export interface SaveProcessTypeVersionDto {
  code?: string;
  name: string;
  category: ProcessTypeCategory;
  requiresScoring?: boolean;
  requiresCommittee?: boolean;
  requiresGecc?: boolean;
  defaultDestination?: string | null;
  validFrom?: Date;
  validUntil?: Date | null;
  active?: boolean;
  requirements?: ProcessDocumentRequirementInput[];
}

export interface UpdateProcessTypeStatusDto {
  active: boolean;
}
