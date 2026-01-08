-- CreateTable
CREATE TABLE `password_reset_code` (
    `idPasswordResetCode` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `codeHash` VARCHAR(200) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_code_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`idPasswordResetCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `password_reset_code` ADD CONSTRAINT `password_reset_code_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;
