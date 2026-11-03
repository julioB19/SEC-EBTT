-- AlterTable
ALTER TABLE `external_evaluator_profile` ADD COLUMN `evaluationCity` VARCHAR(120) NULL,
    ADD COLUMN `siape` VARCHAR(30) NULL,
    ADD COLUMN `workUnit` VARCHAR(180) NULL;

-- CreateTable
CREATE TABLE `google_identity` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(20) NOT NULL DEFAULT 'GOOGLE',
    `subject` VARCHAR(255) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `google_identity_provider_subject_key`(`provider`, `subject`),
    UNIQUE INDEX `google_identity_provider_userId_key`(`provider`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `access_invitation` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `roles` JSON NOT NULL,
    `institutionalExternal` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'REVIEW', 'ACCEPTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `tokenHash` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdById` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `deliveryError` VARCHAR(255) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `access_invitation_email_key`(`email`),
    UNIQUE INDEX `access_invitation_tokenHash_key`(`tokenHash`),
    INDEX `access_invitation_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `access_attempt` (
    `id` VARCHAR(191) NOT NULL,
    `secretHash` VARCHAR(64) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `nonce` VARCHAR(64) NOT NULL,
    `invitationId` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `googleSubject` VARCHAR(255) NULL,
    `googleEmail` VARCHAR(180) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `codeHash` VARCHAR(64) NULL,
    `codeAttempts` INTEGER NOT NULL DEFAULT 0,
    `codeSentAt` DATETIME(3) NULL,
    `purpose` VARCHAR(20) NOT NULL DEFAULT 'LOGIN',
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `access_attempt_secretHash_key`(`secretHash`),
    INDEX `access_attempt_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `access_rate_limit` (
    `key` VARCHAR(64) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `google_identity` ADD CONSTRAINT `google_identity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `access_attempt` ADD CONSTRAINT `access_attempt_invitationId_fkey` FOREIGN KEY (`invitationId`) REFERENCES `access_invitation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

