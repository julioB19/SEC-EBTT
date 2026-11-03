-- AlterTable
ALTER TABLE `user` ADD COLUMN `campusId` INTEGER NULL;

-- AlterTable
ALTER TABLE `access_invitation` ADD COLUMN `campusId` INTEGER NULL;

-- AlterTable
ALTER TABLE `access_attempt` ADD COLUMN `campusId` INTEGER NULL;

-- CreateTable
CREATE TABLE `campus_email_domain` (
    `id` VARCHAR(191) NOT NULL,
    `campusId` INTEGER NOT NULL,
    `domain` VARCHAR(253) NOT NULL,
    `includeSubdomains` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    INDEX `campus_email_domain_campusId_active_idx`(`campusId`, `active`),
    UNIQUE INDEX `campus_email_domain_campusId_domain_key`(`campusId`, `domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_invitation` ADD CONSTRAINT `access_invitation_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_attempt` ADD CONSTRAINT `access_attempt_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campus_email_domain` ADD CONSTRAINT `campus_email_domain_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `campus`(`idCampus`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve existing campus links; do not invent domains or grant new roles.
UPDATE `user` u JOIN `docente_profile` d ON d.userId = u.idUser SET u.campusId = d.campusId WHERE u.campusId IS NULL AND d.campusId IS NOT NULL;
UPDATE `access_invitation` i JOIN `user` u ON u.idUser = i.userId SET i.campusId = u.campusId WHERE i.campusId IS NULL AND u.campusId IS NOT NULL;
UPDATE `access_attempt` a JOIN `access_invitation` i ON i.id = a.invitationId SET a.campusId = i.campusId WHERE a.campusId IS NULL AND i.campusId IS NOT NULL;
