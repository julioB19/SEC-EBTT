-- CreateTable
CREATE TABLE `special_commission_invite` (
    `idSpecialCommissionInvite` INTEGER NOT NULL AUTO_INCREMENT,
    `specialCommissionId` INTEGER NOT NULL,
    `accessInvitationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `origin` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'EXTERNAL',
    `role` ENUM('PRESIDENT', 'MEMBER', 'PRIMARY', 'SUBSTITUTE') NOT NULL DEFAULT 'MEMBER',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('WAITING', 'CONVERTED', 'CANCELED') NOT NULL DEFAULT 'WAITING',
    `memberId` INTEGER NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `special_commission_invite_specialCommissionId_status_idx`(`specialCommissionId`, `status`),
    INDEX `special_commission_invite_accessInvitationId_status_idx`(`accessInvitationId`, `status`),
    PRIMARY KEY (`idSpecialCommissionInvite`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `special_commission_invite` ADD CONSTRAINT `special_commission_invite_specialCommissionId_fkey` FOREIGN KEY (`specialCommissionId`) REFERENCES `special_commission`(`idSpecialCommission`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `special_commission_invite` ADD CONSTRAINT `special_commission_invite_accessInvitationId_fkey` FOREIGN KEY (`accessInvitationId`) REFERENCES `access_invitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
