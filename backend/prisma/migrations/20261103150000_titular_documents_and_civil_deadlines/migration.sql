ALTER TABLE `process_compliance`
    ADD COLUMN `titularAdmissionDate` DATE NULL,
    ADD COLUMN `titularWorkRegime` VARCHAR(120) NULL,
    ADD COLUMN `titularCompetitionArea` VARCHAR(180) NULL;

-- Existing open deadlines were stored as the end of the UTC date.
-- Convert only that exact legacy representation. Closed cases retain their history.
UPDATE `special_commission`
SET `evaluationDeadlineAt` = DATE_ADD(`evaluationDeadlineAt`, INTERVAL 3 HOUR)
WHERE `status` = 'ACTIVE'
  AND `deletedDate` IS NULL
  AND TIME(`evaluationDeadlineAt`) = '23:59:59.999';

UPDATE `full_professor_process_detail`
SET `evaluationDeadlineAt` = DATE_ADD(`evaluationDeadlineAt`, INTERVAL 3 HOUR)
WHERE `procedureStage` <> 'COMPLETED'
  AND `deletedDate` IS NULL
  AND TIME(`evaluationDeadlineAt`) = '23:59:59.999';
