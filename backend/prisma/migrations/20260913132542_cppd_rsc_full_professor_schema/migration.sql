-- AlterTable
ALTER TABLE `docente_profile` ADD COLUMN `campusId` INTEGER NULL;

-- AlterTable
ALTER TABLE `evidence_file` ADD COLUMN `usageType` VARCHAR(60) NULL;

-- AlterTable
ALTER TABLE `process` ADD COLUMN `campusId` INTEGER NULL,
    ADD COLUMN `processTypeId` INTEGER NULL,
    MODIFY `status` ENUM('DRAFT', 'DOCUMENTATION_PENDING', 'SUBMITTED', 'AWAITING_EVALUATOR_ACCEPTANCE', 'AWAITING_ORDINANCE', 'UNDER_REVIEW', 'IN_EVALUATION', 'AWAITING_GECC', 'APPROVED', 'REJECTED', 'RETURNED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `process_status_history` MODIFY `fromStatus` ENUM('DRAFT', 'DOCUMENTATION_PENDING', 'SUBMITTED', 'AWAITING_EVALUATOR_ACCEPTANCE', 'AWAITING_ORDINANCE', 'UNDER_REVIEW', 'IN_EVALUATION', 'AWAITING_GECC', 'APPROVED', 'REJECTED', 'RETURNED', 'FINALIZED') NULL,
    MODIFY `toStatus` ENUM('DRAFT', 'DOCUMENTATION_PENDING', 'SUBMITTED', 'AWAITING_EVALUATOR_ACCEPTANCE', 'AWAITING_ORDINANCE', 'UNDER_REVIEW', 'IN_EVALUATION', 'AWAITING_GECC', 'APPROVED', 'REJECTED', 'RETURNED', 'FINALIZED') NOT NULL;

-- NormalizeRoleEnum
ALTER TABLE `role` MODIFY `name` ENUM('ADMIN', 'CPPD_CENTRAL', 'CPPD_MEMBER', 'DOCENTE', 'AVALIADOR_EXTERNO', 'EXTERNAL_EVALUATOR') NOT NULL;
UPDATE `role` SET `name` = 'EXTERNAL_EVALUATOR' WHERE `name` = 'AVALIADOR_EXTERNO';

-- AlterTable
ALTER TABLE `role` MODIFY `name` ENUM('ADMIN', 'CPPD_CENTRAL', 'CPPD_MEMBER', 'DOCENTE', 'EXTERNAL_EVALUATOR') NOT NULL;

-- AlterTable
ALTER TABLE `scoring_item` ADD COLUMN `factor` DECIMAL(10, 2) NULL,
    ADD COLUMN `weight` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `scoring_table` ADD COLUMN `purpose` ENUM('PROGRESSION_PROMOTION', 'RSC', 'FULL_PROFESSOR_EVALUATION', 'OTHER') NOT NULL DEFAULT 'PROGRESSION_PROMOTION';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `cpfEncrypted` VARCHAR(255) NULL,
    ADD COLUMN `cpfHash` VARCHAR(64) NULL,
    ADD COLUMN `personId` INTEGER NULL,
    MODIFY `cpf` VARCHAR(14) NOT NULL,
    MODIFY `passwordHash` VARCHAR(200) NOT NULL;

-- CreateTable
CREATE TABLE `campus` (
    `idCampus` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `acronym` VARCHAR(20) NULL,
    `cppdEmail` VARCHAR(180) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `campus_acronym_key`(`acronym`),
    PRIMARY KEY (`idCampus`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `person` (
    `idPerson` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(180) NULL,
    `phone` VARCHAR(20) NULL,
    `cpfEncrypted` VARCHAR(255) NULL,
    `cpfHash` VARCHAR(64) NULL,
    `type` ENUM('TEACHER', 'CPPD_MEMBER', 'EXTERNAL_EVALUATOR', 'GECC_INTERESTED', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `person_email_key`(`email`),
    UNIQUE INDEX `person_cpfHash_key`(`cpfHash`),
    INDEX `person_type_active_idx`(`type`, `active`),
    PRIMARY KEY (`idPerson`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_type_config` (
    `idProcessType` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` ENUM('CAREER', 'RSC', 'FULL_PROFESSOR', 'SIMPLE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `requiresScoring` BOOLEAN NOT NULL DEFAULT false,
    `requiresCommittee` BOOLEAN NOT NULL DEFAULT false,
    `requiresGecc` BOOLEAN NOT NULL DEFAULT false,
    `opinionTemplateId` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `process_type_config_code_key`(`code`),
    INDEX `process_type_config_category_active_idx`(`category`, `active`),
    INDEX `process_type_config_opinionTemplateId_idx`(`opinionTemplateId`),
    PRIMARY KEY (`idProcessType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_degree` (
    `idTeacherDegree` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `degreeType` VARCHAR(80) NOT NULL,
    `course` VARCHAR(180) NULL,
    `institution` VARCHAR(180) NULL,
    `conclusionDate` DATETIME(3) NULL,
    `evidenceFileId` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `teacher_degree_teacherId_idx`(`teacherId`),
    INDEX `teacher_degree_evidenceFileId_idx`(`evidenceFileId`),
    PRIMARY KEY (`idTeacherDegree`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `progression_process_detail` (
    `processId` INTEGER NOT NULL,
    `originClass` VARCHAR(20) NULL,
    `originLevel` VARCHAR(20) NULL,
    `targetClass` VARCHAR(20) NULL,
    `targetLevel` VARCHAR(20) NULL,
    `intersticeStart` DATETIME(3) NULL,
    `intersticeEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    PRIMARY KEY (`processId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rsc_process_detail` (
    `processId` INTEGER NOT NULL,
    `targetLevel` VARCHAR(20) NULL,
    `reportFileId` INTEGER NULL,
    `generatedSpreadsheetFileId` INTEGER NULL,
    `simecReference` VARCHAR(120) NULL,
    `finalResult` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `rsc_process_detail_reportFileId_idx`(`reportFileId`),
    INDEX `rsc_process_detail_generatedSpreadsheetFileId_idx`(`generatedSpreadsheetFileId`),
    PRIMARY KEY (`processId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `full_professor_process_detail` (
    `processId` INTEGER NOT NULL,
    `evaluationMode` ENUM('MEMORIAL', 'THESIS') NULL,
    `memorialFileId` INTEGER NULL,
    `thesisFileId` INTEGER NULL,
    `doctorateDegreeId` INTEGER NULL,
    `finalReferenceDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `full_professor_process_detail_memorialFileId_idx`(`memorialFileId`),
    INDEX `full_professor_process_detail_thesisFileId_idx`(`thesisFileId`),
    INDEX `full_professor_process_detail_doctorateDegreeId_idx`(`doctorateDegreeId`),
    PRIMARY KEY (`processId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_template` (
    `idDocumentTemplate` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `processTypeId` INTEGER NULL,
    `version` VARCHAR(30) NOT NULL,
    `templateFile` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `document_template_code_key`(`code`),
    INDEX `document_template_processTypeId_idx`(`processTypeId`),
    PRIMARY KEY (`idDocumentTemplate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_process` (
    `idDocumentProcess` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `templateId` INTEGER NULL,
    `documentType` VARCHAR(80) NOT NULL,
    `nature` VARCHAR(80) NULL,
    `detailedSubject` VARCHAR(255) NULL,
    `format` VARCHAR(30) NULL,
    `receivedAt` DATETIME(3) NULL,
    `checked` BOOLEAN NOT NULL DEFAULT false,
    `evidenceFileId` INTEGER NULL,
    `generatedById` INTEGER NULL,
    `purpose` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `document_process_processId_idx`(`processId`),
    INDEX `document_process_templateId_idx`(`templateId`),
    INDEX `document_process_evidenceFileId_idx`(`evidenceFileId`),
    INDEX `document_process_generatedById_idx`(`generatedById`),
    PRIMARY KEY (`idDocumentProcess`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cppd_commission` (
    `idCppdCommission` INTEGER NOT NULL AUTO_INCREMENT,
    `campusId` INTEGER NULL,
    `ordinance` VARCHAR(120) NULL,
    `mandateStart` DATETIME(3) NULL,
    `mandateEnd` DATETIME(3) NULL,
    `validityStart` DATETIME(3) NULL,
    `validityEnd` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `cppd_commission_campusId_idx`(`campusId`),
    PRIMARY KEY (`idCppdCommission`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cppd_commission_member` (
    `commissionId` INTEGER NOT NULL,
    `personId` INTEGER NOT NULL,
    `function` ENUM('PRESIDENT', 'SECRETARY', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `membershipType` ENUM('PRIMARY', 'SUBSTITUTE') NOT NULL DEFAULT 'PRIMARY',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `cppd_commission_member_personId_idx`(`personId`),
    PRIMARY KEY (`commissionId`, `personId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `special_commission` (
    `idSpecialCommission` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `type` ENUM('RSC', 'FULL_PROFESSOR') NOT NULL,
    `ordinance` VARCHAR(120) NULL,
    `ordinanceDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `special_commission_processId_idx`(`processId`),
    PRIMARY KEY (`idSpecialCommission`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `special_commission_member` (
    `idSpecialCommissionMember` INTEGER NOT NULL AUTO_INCREMENT,
    `specialCommissionId` INTEGER NOT NULL,
    `personId` INTEGER NOT NULL,
    `origin` ENUM('INTERNAL', 'EXTERNAL') NOT NULL,
    `role` ENUM('PRESIDENT', 'MEMBER', 'PRIMARY', 'SUBSTITUTE') NOT NULL DEFAULT 'MEMBER',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `acceptanceStatus` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `special_commission_member_personId_idx`(`personId`),
    UNIQUE INDEX `special_commission_member_specialCommissionId_personId_key`(`specialCommissionId`, `personId`),
    PRIMARY KEY (`idSpecialCommissionMember`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `individual_evaluation` (
    `idIndividualEvaluation` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `memberId` INTEGER NULL,
    `type` ENUM('RSC', 'FULL_PROFESSOR', 'CPPD', 'OTHER') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `result` ENUM('APPROVED', 'REJECTED', 'DEFERRED', 'DENIED') NULL,
    `recognizedPoints` DECIMAL(10, 2) NULL,
    `opinionText` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `individual_evaluation_processId_idx`(`processId`),
    INDEX `individual_evaluation_memberId_idx`(`memberId`),
    PRIMARY KEY (`idIndividualEvaluation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `individual_evaluation_score` (
    `idIndividualEvaluationScore` INTEGER NOT NULL AUTO_INCREMENT,
    `individualEvaluationId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `awardedPoints` DECIMAL(10, 2) NOT NULL,
    `evaluatorComment` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `individual_evaluation_score_itemId_idx`(`itemId`),
    UNIQUE INDEX `individual_evaluation_score_individualEvaluationId_itemId_key`(`individualEvaluationId`, `itemId`),
    PRIMARY KEY (`idIndividualEvaluationScore`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_gecc` (
    `idProcessGecc` INTEGER NOT NULL AUTO_INCREMENT,
    `processOriginId` INTEGER NOT NULL,
    `externalNumber` VARCHAR(120) NULL,
    `status` ENUM('DRAFT', 'PENDING_DOCUMENTS', 'READY_TO_SEND', 'SENT_TO_CGP', 'COMPLETED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `checklistDocumentId` INTEGER NULL,
    `sentToCgpAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `process_gecc_processOriginId_idx`(`processOriginId`),
    INDEX `process_gecc_checklistDocumentId_idx`(`checklistDocumentId`),
    PRIMARY KEY (`idProcessGecc`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gecc_interested` (
    `processGeccId` INTEGER NOT NULL,
    `personId` INTEGER NOT NULL,
    `type` ENUM('INTERNAL_EVALUATOR', 'EXTERNAL_EVALUATOR', 'CPPD_UNIT', 'OTHER') NOT NULL,
    `informedEmail` VARCHAR(180) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `gecc_interested_personId_idx`(`personId`),
    PRIMARY KEY (`processGeccId`, `personId`, `type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gecc_document` (
    `idGeccDocument` INTEGER NOT NULL AUTO_INCREMENT,
    `processGeccId` INTEGER NOT NULL,
    `personId` INTEGER NULL,
    `documentType` VARCHAR(80) NOT NULL,
    `evidenceFileId` INTEGER NULL,
    `receivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `gecc_document_processGeccId_idx`(`processGeccId`),
    INDEX `gecc_document_personId_idx`(`personId`),
    INDEX `gecc_document_evidenceFileId_idx`(`evidenceFileId`),
    PRIMARY KEY (`idGeccDocument`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `docente_profile_campusId_idx` ON `docente_profile`(`campusId`);

-- CreateIndex
CREATE INDEX `evidence_file_usageType_idx` ON `evidence_file`(`usageType`);

-- CreateIndex
CREATE INDEX `process_campusId_idx` ON `process`(`campusId`);

-- CreateIndex
CREATE INDEX `process_processTypeId_idx` ON `process`(`processTypeId`);

-- CreateIndex
CREATE UNIQUE INDEX `user_cpfHash_key` ON `user`(`cpfHash`);

-- CreateIndex
CREATE UNIQUE INDEX `user_personId_key` ON `user`(`personId`);

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `person`(`idPerson`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docente_profile` ADD CONSTRAINT `docente_profile_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process` ADD CONSTRAINT `process_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process` ADD CONSTRAINT `process_processTypeId_fkey` FOREIGN KEY (`processTypeId`) REFERENCES `process_type_config`(`idProcessType`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_type_config` ADD CONSTRAINT `process_type_config_opinionTemplateId_fkey` FOREIGN KEY (`opinionTemplateId`) REFERENCES `document_template`(`idDocumentTemplate`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_degree` ADD CONSTRAINT `teacher_degree_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `docente_profile`(`idDocente`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_degree` ADD CONSTRAINT `teacher_degree_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progression_process_detail` ADD CONSTRAINT `progression_process_detail_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rsc_process_detail` ADD CONSTRAINT `rsc_process_detail_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rsc_process_detail` ADD CONSTRAINT `rsc_process_detail_reportFileId_fkey` FOREIGN KEY (`reportFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rsc_process_detail` ADD CONSTRAINT `rsc_process_detail_generatedSpreadsheetFileId_fkey` FOREIGN KEY (`generatedSpreadsheetFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `full_professor_process_detail` ADD CONSTRAINT `full_professor_process_detail_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `full_professor_process_detail` ADD CONSTRAINT `full_professor_process_detail_memorialFileId_fkey` FOREIGN KEY (`memorialFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `full_professor_process_detail` ADD CONSTRAINT `full_professor_process_detail_thesisFileId_fkey` FOREIGN KEY (`thesisFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `full_professor_process_detail` ADD CONSTRAINT `full_professor_process_detail_doctorateDegreeId_fkey` FOREIGN KEY (`doctorateDegreeId`) REFERENCES `teacher_degree`(`idTeacherDegree`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_template` ADD CONSTRAINT `document_template_processTypeId_fkey` FOREIGN KEY (`processTypeId`) REFERENCES `process_type_config`(`idProcessType`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_process` ADD CONSTRAINT `document_process_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_process` ADD CONSTRAINT `document_process_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `document_template`(`idDocumentTemplate`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_process` ADD CONSTRAINT `document_process_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_process` ADD CONSTRAINT `document_process_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `user`(`idUser`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cppd_commission` ADD CONSTRAINT `cppd_commission_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cppd_commission_member` ADD CONSTRAINT `cppd_commission_member_commissionId_fkey` FOREIGN KEY (`commissionId`) REFERENCES `cppd_commission`(`idCppdCommission`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cppd_commission_member` ADD CONSTRAINT `cppd_commission_member_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `person`(`idPerson`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_commission` ADD CONSTRAINT `special_commission_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_commission_member` ADD CONSTRAINT `special_commission_member_specialCommissionId_fkey` FOREIGN KEY (`specialCommissionId`) REFERENCES `special_commission`(`idSpecialCommission`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_commission_member` ADD CONSTRAINT `special_commission_member_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `person`(`idPerson`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `individual_evaluation` ADD CONSTRAINT `individual_evaluation_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `individual_evaluation` ADD CONSTRAINT `individual_evaluation_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `special_commission_member`(`idSpecialCommissionMember`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `individual_evaluation_score` ADD CONSTRAINT `individual_evaluation_score_individualEvaluationId_fkey` FOREIGN KEY (`individualEvaluationId`) REFERENCES `individual_evaluation`(`idIndividualEvaluation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `individual_evaluation_score` ADD CONSTRAINT `individual_evaluation_score_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `scoring_item`(`idScoringItem`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_gecc` ADD CONSTRAINT `process_gecc_processOriginId_fkey` FOREIGN KEY (`processOriginId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_gecc` ADD CONSTRAINT `process_gecc_checklistDocumentId_fkey` FOREIGN KEY (`checklistDocumentId`) REFERENCES `document_process`(`idDocumentProcess`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gecc_interested` ADD CONSTRAINT `gecc_interested_processGeccId_fkey` FOREIGN KEY (`processGeccId`) REFERENCES `process_gecc`(`idProcessGecc`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gecc_interested` ADD CONSTRAINT `gecc_interested_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `person`(`idPerson`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gecc_document` ADD CONSTRAINT `gecc_document_processGeccId_fkey` FOREIGN KEY (`processGeccId`) REFERENCES `process_gecc`(`idProcessGecc`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gecc_document` ADD CONSTRAINT `gecc_document_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `person`(`idPerson`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gecc_document` ADD CONSTRAINT `gecc_document_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE SET NULL ON UPDATE CASCADE;

