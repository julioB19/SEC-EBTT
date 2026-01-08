-- CreateTable
CREATE TABLE `user` (
    `idUser` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `cpf` VARCHAR(14) NOT NULL,
    `passwordHash` VARCHAR(200) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    UNIQUE INDEX `user_cpf_key`(`cpf`),
    PRIMARY KEY (`idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `idRole` BIGINT NOT NULL AUTO_INCREMENT,
    `name` ENUM('ADMIN', 'CPPD_MEMBER', 'DOCENTE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `role_name_key`(`name`),
    PRIMARY KEY (`idRole`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role` (
    `userId` INTEGER NOT NULL,
    `roleId` BIGINT NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `docente_profile` (
    `idDocente` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `siape` VARCHAR(30) NOT NULL,
    `classLevel` ENUM('A1', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1') NOT NULL,
    `start_interstice` DATETIME(3) NOT NULL,
    `educationLevel` VARCHAR(120) NOT NULL,
    `improvement` VARCHAR(120) NULL,
    `specialization` VARCHAR(120) NULL,
    `mastersDegree` VARCHAR(120) NULL,
    `doctorate` VARCHAR(120) NULL,
    `assignment` VARCHAR(120) NULL,
    `department` VARCHAR(120) NULL,
    `division` VARCHAR(120) NULL,
    `role` VARCHAR(120) NULL,
    `immediate_supervisor` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `docente_profile_userId_key`(`userId`),
    PRIMARY KEY (`idDocente`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scoring_table` (
    `idScoringTable` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `startsOn` DATETIME(3) NULL,
    `endsOn` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    PRIMARY KEY (`idScoringTable`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scoring_node` (
    `idScoringNode` INTEGER NOT NULL AUTO_INCREMENT,
    `scoringTableId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(50) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `scoring_node_scoringTableId_parentId_sortOrder_idx`(`scoringTableId`, `parentId`, `sortOrder`),
    UNIQUE INDEX `scoring_node_scoringTableId_parentId_name_key`(`scoringTableId`, `parentId`, `name`),
    PRIMARY KEY (`idScoringNode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scoring_item` (
    `idScoringItem` INTEGER NOT NULL AUTO_INCREMENT,
    `scoringTableId` INTEGER NOT NULL,
    `nodeId` INTEGER NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `points` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(30) NULL,
    `hasMaxPoints` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `scoring_item_nodeId_idx`(`nodeId`),
    PRIMARY KEY (`idScoringItem`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process` (
    `idProcess` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `scoringTableId` INTEGER NOT NULL,
    `type` ENUM('PROGRESSAO', 'PROMOCAO') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,
    `campus` VARCHAR(255) NOT NULL,
    `cidadeUF` VARCHAR(255) NOT NULL,
    `intersticeStart` DATETIME(3) NOT NULL,
    `intersticeEnd` DATETIME(3) NOT NULL,
    `classeOrigem` VARCHAR(20) NOT NULL,
    `nivelOrigem` VARCHAR(20) NOT NULL,
    `classeDestino` VARCHAR(20) NOT NULL,
    `nivelDestino` VARCHAR(20) NOT NULL,

    INDEX `process_userId_status_idx`(`userId`, `status`),
    INDEX `process_scoringTableId_idx`(`scoringTableId`),
    PRIMARY KEY (`idProcess`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_score` (
    `idProcessScore` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `awardedPoints` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `process_score_itemId_idx`(`itemId`),
    UNIQUE INDEX `process_score_processId_itemId_key`(`processId`, `itemId`),
    PRIMARY KEY (`idProcessScore`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_status_history` (
    `idStatusHist` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `fromStatus` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED') NULL,
    `toStatus` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED') NOT NULL,
    `changedById` INTEGER NOT NULL,
    `note` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,

    INDEX `process_status_history_processId_updatedAt_idx`(`processId`, `updatedAt`),
    PRIMARY KEY (`idStatusHist`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `score_evidence` (
    `idEvidence` INTEGER NOT NULL AUTO_INCREMENT,
    `processScoreId` INTEGER NOT NULL,
    `filename` VARCHAR(180) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(60) NULL,
    `sizeBytes` BIGINT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `score_evidence_processScoreId_idx`(`processScoreId`),
    PRIMARY KEY (`idEvidence`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `role`(`idRole`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docente_profile` ADD CONSTRAINT `docente_profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scoring_node` ADD CONSTRAINT `scoring_node_scoringTableId_fkey` FOREIGN KEY (`scoringTableId`) REFERENCES `scoring_table`(`idScoringTable`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scoring_node` ADD CONSTRAINT `scoring_node_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `scoring_node`(`idScoringNode`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scoring_item` ADD CONSTRAINT `scoring_item_scoringTableId_fkey` FOREIGN KEY (`scoringTableId`) REFERENCES `scoring_table`(`idScoringTable`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scoring_item` ADD CONSTRAINT `scoring_item_nodeId_fkey` FOREIGN KEY (`nodeId`) REFERENCES `scoring_node`(`idScoringNode`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process` ADD CONSTRAINT `process_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process` ADD CONSTRAINT `process_scoringTableId_fkey` FOREIGN KEY (`scoringTableId`) REFERENCES `scoring_table`(`idScoringTable`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_score` ADD CONSTRAINT `process_score_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_score` ADD CONSTRAINT `process_score_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `scoring_item`(`idScoringItem`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_status_history` ADD CONSTRAINT `process_status_history_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_status_history` ADD CONSTRAINT `process_status_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `score_evidence` ADD CONSTRAINT `score_evidence_processScoreId_fkey` FOREIGN KEY (`processScoreId`) REFERENCES `process_score`(`idProcessScore`) ON DELETE CASCADE ON UPDATE CASCADE;
