import { FullProfessorProcedureOutcome } from "@prisma/client"

export type FullProfessorProcedureAction =
  | "REQUEST_REASSESSMENT"
  | "SCHEDULE_ORAL_DEFENSE"
  | "RECORD_ORAL_DEFENSE"
  | "SUBMIT_APPEAL"
  | "DECIDE_APPEAL"
  | "CLOSE_EXPIRED_PERIOD"

export interface FullProfessorProcedureActionDto {
  action: FullProfessorProcedureAction
  reason?: string
  scheduledAt?: string
  accessUrl?: string
  heldAt?: string
  recordingUrl?: string
  notes?: string
  outcome?: FullProfessorProcedureOutcome
  decisionText?: string
}
