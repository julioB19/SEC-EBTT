-- AlterTable
ALTER TABLE `scoring_item` ADD COLUMN `formulaKey` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `scoring_node` ADD COLUMN `formulaExpression` VARCHAR(255) NULL,
    ADD COLUMN `hasFormula` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `process_node_score` (
    `idProcessNodeScore` INTEGER NOT NULL AUTO_INCREMENT,
    `processId` INTEGER NOT NULL,
    `nodeId` INTEGER NOT NULL,
    `totalPoints` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `process_node_score_processId_nodeId_key`(`processId`, `nodeId`),
    PRIMARY KEY (`idProcessNodeScore`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `process_node_score` ADD CONSTRAINT `process_node_score_processId_fkey` FOREIGN KEY (`processId`) REFERENCES `process`(`idProcess`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `process_node_score` ADD CONSTRAINT `process_node_score_nodeId_fkey` FOREIGN KEY (`nodeId`) REFERENCES `scoring_node`(`idScoringNode`) ON DELETE CASCADE ON UPDATE CASCADE;
