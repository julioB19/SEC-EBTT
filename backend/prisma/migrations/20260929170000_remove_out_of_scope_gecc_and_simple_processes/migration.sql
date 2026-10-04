-- Preserve the core process/audit records while removing modules that are outside
-- the SEC-EBTT scope. This migration intentionally archives legacy generic
-- processes instead of deleting them.
UPDATE `process`
SET `status` = 'APPROVED'
WHERE `status` = 'AWAITING_GECC';

UPDATE `process_status_history`
SET
  `fromStatus` = IF(`fromStatus` = 'AWAITING_GECC', 'APPROVED', `fromStatus`),
  `toStatus` = IF(`toStatus` = 'AWAITING_GECC', 'APPROVED', `toStatus`),
  `note` = LEFT(
    CONCAT_WS(
      ' | ',
      NULLIF(`note`, ''),
      'Estado legado AWAITING_GECC convertido para APPROVED após retirada do GECC do escopo.'
    ),
    500
  )
WHERE `fromStatus` = 'AWAITING_GECC' OR `toStatus` = 'AWAITING_GECC';

DROP TABLE IF EXISTS `gecc_document`;
DROP TABLE IF EXISTS `gecc_interested`;
DROP TABLE IF EXISTS `process_gecc`;

UPDATE `person`
SET `type` = 'OTHER'
WHERE `type` = 'GECC_INTERESTED';

-- Templates remain available for audit, but no longer point to a removed type.
UPDATE `document_template`
SET `processTypeId` = NULL
WHERE `processTypeId` IN (
  SELECT `idProcessType`
  FROM `process_type_config`
  WHERE `category` IN ('SIMPLE', 'OTHER')
);

-- Keep legacy process rows for audit without exposing unsupported flows as active.
UPDATE `process`
SET
  `processTypeId` = NULL,
  `deletedDate` = COALESCE(`deletedDate`, CURRENT_TIMESTAMP(3))
WHERE `processTypeId` IN (
  SELECT `idProcessType`
  FROM `process_type_config`
  WHERE `category` IN ('SIMPLE', 'OTHER')
);

-- Requirements tied to these configurations are removed by the existing
-- ON DELETE CASCADE constraint.
DELETE FROM `process_type_config`
WHERE `category` IN ('SIMPLE', 'OTHER');

ALTER TABLE `process`
  MODIFY `status` ENUM(
    'DRAFT',
    'DOCUMENTATION_PENDING',
    'SUBMITTED',
    'AWAITING_EVALUATOR_ACCEPTANCE',
    'AWAITING_ORDINANCE',
    'UNDER_REVIEW',
    'IN_EVALUATION',
    'APPROVED',
    'REJECTED',
    'RETURNED',
    'FINALIZED'
  ) NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `process_status_history`
  MODIFY `fromStatus` ENUM(
    'DRAFT',
    'DOCUMENTATION_PENDING',
    'SUBMITTED',
    'AWAITING_EVALUATOR_ACCEPTANCE',
    'AWAITING_ORDINANCE',
    'UNDER_REVIEW',
    'IN_EVALUATION',
    'APPROVED',
    'REJECTED',
    'RETURNED',
    'FINALIZED'
  ) NULL,
  MODIFY `toStatus` ENUM(
    'DRAFT',
    'DOCUMENTATION_PENDING',
    'SUBMITTED',
    'AWAITING_EVALUATOR_ACCEPTANCE',
    'AWAITING_ORDINANCE',
    'UNDER_REVIEW',
    'IN_EVALUATION',
    'APPROVED',
    'REJECTED',
    'RETURNED',
    'FINALIZED'
  ) NOT NULL;

ALTER TABLE `person`
  MODIFY `type` ENUM('TEACHER', 'CPPD_MEMBER', 'EXTERNAL_EVALUATOR', 'OTHER')
  NOT NULL DEFAULT 'OTHER';

ALTER TABLE `process_type_config`
  DROP COLUMN `requiresGecc`,
  MODIFY `category` ENUM('CAREER', 'RSC', 'FULL_PROFESSOR') NOT NULL;

ALTER TABLE `rsc_process_detail`
  DROP COLUMN `simecReference`;
