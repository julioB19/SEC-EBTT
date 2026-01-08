/*
  Warnings:

  - You are about to drop the `score_evidence` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `score_evidence` DROP FOREIGN KEY `score_evidence_processScoreId_fkey`;

-- AlterTable
ALTER TABLE `process_score` ADD COLUMN `evidenceFileId` INTEGER NULL;

-- DropTable
DROP TABLE `score_evidence`;

-- CreateTable
CREATE TABLE `evidence_file` (
    `idEvidenceFile` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `originalName` VARCHAR(180) NOT NULL,
    `storedName` VARCHAR(180) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(60) NULL,
    `sizeBytes` BIGINT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `evidence_file_userId_deletedDate_idx`(`userId`, `deletedDate`),
    PRIMARY KEY (`idEvidenceFile`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `process_score` ADD CONSTRAINT `process_score_evidenceFileId_fkey` FOREIGN KEY (`evidenceFileId`) REFERENCES `evidence_file`(`idEvidenceFile`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evidence_file` ADD CONSTRAINT `evidence_file_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;
