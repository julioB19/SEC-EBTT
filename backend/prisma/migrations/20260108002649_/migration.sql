-- AlterTable
ALTER TABLE `scoring_table` MODIFY `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'DRAFT';
