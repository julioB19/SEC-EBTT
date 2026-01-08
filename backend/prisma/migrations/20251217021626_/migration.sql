/*
  Warnings:

  - Added the required column `updatedAt` to the `password_reset_code` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `password_reset_code` ADD COLUMN `deletedDate` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;
