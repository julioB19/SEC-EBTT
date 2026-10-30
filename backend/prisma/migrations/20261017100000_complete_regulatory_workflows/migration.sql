-- AlterTable
ALTER TABLE `process` ADD COLUMN `financialEffectsAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `teacher_degree` ADD COLUMN `countryCode` VARCHAR(2) NOT NULL DEFAULT 'BR',
    ADD COLUMN `recognitionFileId` INTEGER NULL;

-- CreateTable
CREATE TABLE `process_compliance` (
    `deletedDate` DATETIME(3) NULL,
    `nomineesValidatedAt` DATETIME(3) NULL,
    `processId` INTEGER NOT NULL,
    `claimedPerformancePoints` DECIMAL(10, 2) NULL,
    `performanceFileId` INTEGER NULL,
    `performancePoints` DECIMAL(10, 2) NULL,
    `performanceApprovedAt` DATETIME(3) NULL,
    `performanceRequirementsMetAt` DATETIME(3) NULL,
    `doctorateValidatedAt` DATETIME(3) NULL,
    `validatedById` INTEGER NULL,
    `performanceOpinion` TEXT NULL,
    `thesisOriginalityDeclaredAt` DATETIME(3) NULL,
    `simecReference` VARCHAR(120) NULL,
    `simecSelectionReference` VARCHAR(500) NULL,
    `interlocutorUserId` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`processId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_nominee` (
    `deletedDate` DATETIME(3) NULL,
    `idNominee` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `origin` ENUM('INTERNAL', 'EXTERNAL') NOT NULL,
    `membership` ENUM('PRIMARY', 'SUBSTITUTE') NOT NULL,
    `doctorateTitle` VARCHAR(180) NOT NULL,
    `institution` VARCHAR(180) NOT NULL,
    `federalInstitution` BOOLEAN NOT NULL,
    `careerLevel` VARCHAR(80) NOT NULL,
    `knowledgeArea` VARCHAR(180) NOT NULL,
    `relatedAreaJustification` VARCHAR(500) NULL,
    `priorConsentAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `process_nominee_processId_email_key`(`processId`, `email`),
    PRIMARY KEY (`idNominee`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_calendar_period` (
    `deletedDate` DATETIME(3) NULL,
    `idPeriod` INTEGER NOT NULL AUTO_INCREMENT,
    `campusId` INTEGER NULL,
    `kind` VARCHAR(20) NOT NULL,
    `description` VARCHAR(180) NOT NULL,
    `startsOn` DATETIME(3) NOT NULL,
    `endsOn` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `academic_calendar_period_campusId_startsOn_endsOn_idx`(`campusId`, `startsOn`, `endsOn`),
    PRIMARY KEY (`idPeriod`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signed_process_artifact` (
    `deletedDate` DATETIME(3) NULL,
    `idArtifact` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `documentKind` VARCHAR(80) NOT NULL,
    `memberId` INTEGER NULL,
    `version` INTEGER NOT NULL,
    `evidenceFileId` INTEGER NOT NULL,
    `signer` VARCHAR(180) NOT NULL,
    `provider` VARCHAR(80) NOT NULL,
    `signedAt` DATETIME(3) NOT NULL,
    `contentSha256` VARCHAR(64) NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `validationNote` TEXT NULL,
    `rejectedAt` DATETIME(3) NULL,

    INDEX `signed_process_artifact_processId_documentKind_version_idx`(`processId`, `documentKind`, `version`),
    UNIQUE INDEX `signed_process_artifact_processId_documentKind_memberId_vers_key`(`processId`, `documentKind`, `memberId`, `version`),
    PRIMARY KEY (`idArtifact`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_audit` (
    `deletedDate` DATETIME(3) NULL,
    `idAudit` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `details` JSON NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `process_audit_processId_occurredAt_idx`(`processId`, `occurredAt`),
    PRIMARY KEY (`idAudit`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rsc_appeal` (
    `deletedDate` DATETIME(3) NULL,
    `idAppeal` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `stage` VARCHAR(20) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    `reason` TEXT NOT NULL,
    `submittedById` INTEGER NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deadlineAt` DATETIME(3) NOT NULL,
    `originalCommissionId` INTEGER NULL,
    `newCommissionId` INTEGER NULL,
    `evidenceSnapshot` JSON NOT NULL,
    `decision` VARCHAR(20) NULL,
    `decisionText` TEXT NULL,
    `decidedById` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `externalReference` VARCHAR(180) NULL,

    UNIQUE INDEX `rsc_appeal_processId_stage_key`(`processId`, `stage`),
    PRIMARY KEY (`idAppeal`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `teacher_degree` ADD CONSTRAINT `teacher_degree_recognitionFileId_fkey` FOREIGN KEY (`recognitionFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_compliance` ADD CONSTRAINT `process_compliance_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_compliance` ADD CONSTRAINT `process_compliance_performanceFileId_fkey` FOREIGN KEY (`performanceFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_nominee` ADD CONSTRAINT `process_nominee_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signed_process_artifact` ADD CONSTRAINT `signed_process_artifact_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `signed_process_artifact` ADD CONSTRAINT `signed_process_artifact_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_audit` ADD CONSTRAINT `process_audit_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rsc_appeal` ADD CONSTRAINT `rsc_appeal_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE RESTRICT ON UPDATE CASCADE;

