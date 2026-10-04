-- AlterTable
ALTER TABLE `full_professor_process_detail`
    ADD COLUMN `procedureStage` ENUM('INITIAL_EVALUATION', 'AWAITING_REASSESSMENT', 'REASSESSMENT_REQUESTED', 'ORAL_DEFENSE_SCHEDULED', 'THESIS_DEFENSE_RECORDED', 'AWAITING_APPEAL', 'APPEAL_SUBMITTED', 'COMPLETED') NOT NULL DEFAULT 'INITIAL_EVALUATION',
    ADD COLUMN `currentOutcome` ENUM('APPROVED', 'REJECTED') NULL,
    ADD COLUMN `evaluationDeadlineAt` DATETIME(3) NULL,
    ADD COLUMN `initialOpinionAt` DATETIME(3) NULL,
    ADD COLUMN `reassessmentDeadlineAt` DATETIME(3) NULL,
    ADD COLUMN `reassessmentRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `reassessmentReason` TEXT NULL,
    ADD COLUMN `oralDefenseDeadlineAt` DATETIME(3) NULL,
    ADD COLUMN `oralDefenseScheduledAt` DATETIME(3) NULL,
    ADD COLUMN `oralDefenseAccessUrl` VARCHAR(500) NULL,
    ADD COLUMN `oralDefenseHeldAt` DATETIME(3) NULL,
    ADD COLUMN `oralDefenseRecordingUrl` VARCHAR(500) NULL,
    ADD COLUMN `oralDefenseNotes` TEXT NULL,
    ADD COLUMN `appealDeadlineAt` DATETIME(3) NULL,
    ADD COLUMN `appealSubmittedAt` DATETIME(3) NULL,
    ADD COLUMN `appealReason` TEXT NULL,
    ADD COLUMN `appealDecidedAt` DATETIME(3) NULL,
    ADD COLUMN `appealDecisionText` TEXT NULL;

-- AlterTable
ALTER TABLE `special_commission`
    ADD COLUMN `evaluationDeadlineAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `full_professor_procedure_event` (
    `idFullProfessorProcedureEvent` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `type` ENUM('INITIAL_OUTCOME_RECORDED', 'REASSESSMENT_REQUESTED', 'ORAL_DEFENSE_SCHEDULED', 'ORAL_DEFENSE_RECORDED', 'APPEAL_SUBMITTED', 'APPEAL_DECIDED', 'DEADLINE_EXPIRED') NOT NULL,
    `actorId` INTEGER NOT NULL,
    `details` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,

    INDEX `full_professor_procedure_event_processId_occurredAt_idx`(`processId`, `occurredAt`),
    INDEX `full_professor_procedure_event_actorId_idx`(`actorId`),
    PRIMARY KEY (`idFullProfessorProcedureEvent`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `full_professor_procedure_event` ADD CONSTRAINT `full_professor_procedure_event_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `full_professor_process_detail`(`processId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `full_professor_procedure_event` ADD CONSTRAINT `full_professor_procedure_event_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;
