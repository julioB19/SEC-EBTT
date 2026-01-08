-- AlterTable
ALTER TABLE `scoring_table` ADD COLUMN `status` ENUM('DRAFT', 'ACTIVE') NOT NULL DEFAULT 'DRAFT';
