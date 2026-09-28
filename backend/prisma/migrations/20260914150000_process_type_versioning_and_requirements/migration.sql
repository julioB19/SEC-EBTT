ALTER TABLE `process_type_config`
    DROP INDEX `process_type_config_code_key`,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `validUntil` DATETIME(3) NULL,
    ADD COLUMN `defaultDestination` VARCHAR(120) NULL;

UPDATE `process_type_config` SET `validFrom` = `createdAt`;

CREATE UNIQUE INDEX `process_type_config_code_version_key`
    ON `process_type_config`(`code`, `version`);

CREATE TABLE `process_type_document_requirement` (
    `idDocumentRequirement` INTEGER NOT NULL AUTO_INCREMENT,
    `processTypeId` INTEGER NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `allowsMultiple` BOOLEAN NOT NULL DEFAULT false,
    `acceptedFormats` VARCHAR(120) NULL,
    `maxSizeMb` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedDate` DATETIME(3) NULL,

    UNIQUE INDEX `process_type_document_requirement_processTypeId_code_key`(`processTypeId`, `code`),
    INDEX `process_type_document_requirement_processTypeId_active_idx`(`processTypeId`, `active`),
    PRIMARY KEY (`idDocumentRequirement`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `process_type_document_requirement`
    ADD CONSTRAINT `process_type_document_requirement_processTypeId_fkey`
    FOREIGN KEY (`processTypeId`) REFERENCES `process_type_config`(`idProcessType`)
    ON DELETE CASCADE ON UPDATE CASCADE;
