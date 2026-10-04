-- AlterTable
ALTER TABLE `role` MODIFY `name` ENUM('ADMIN', 'CPPD_MEMBER', 'DOCENTE', 'AVALIADOR_EXTERNO') NOT NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `cpf` VARCHAR(14) NULL,
    MODIFY `passwordHash` VARCHAR(200) NULL;

-- CreateTable
CREATE TABLE `external_evaluator_profile` (
    `idExternalEvaluator` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(120) NULL,
    `institution` VARCHAR(180) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `external_evaluator_profile_userId_key`(`userId`),
    PRIMARY KEY (`idExternalEvaluator`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `external_evaluator_profile` ADD CONSTRAINT `external_evaluator_profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;
