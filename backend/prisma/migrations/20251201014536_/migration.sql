-- AlterTable
ALTER TABLE `process` ADD COLUMN `evaluationOpinion` TEXT NULL,
    ADD COLUMN `evaluatorUserIds` JSON NULL,
    ADD COLUMN `finalPoints` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `process_node_score` ADD COLUMN `evaluatorTotalPoints` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `process_score` ADD COLUMN `evaluatorAwardedPoints` DECIMAL(10, 2) NULL,
    ADD COLUMN `evaluatorComment` VARCHAR(500) NULL;
