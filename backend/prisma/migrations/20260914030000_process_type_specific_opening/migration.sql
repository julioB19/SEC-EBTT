-- CareerProcess now stores only fields shared by every process as required values.
-- Legacy progression/promotion columns remain available for existing records.
ALTER TABLE `process`
    ADD COLUMN `externalNumber` VARCHAR(120) NULL,
    MODIFY `scoringTableId` INTEGER NULL,
    MODIFY `type` ENUM('PROGRESSAO', 'PROMOCAO') NULL,
    MODIFY `intersticeStart` DATETIME(3) NULL,
    MODIFY `intersticeEnd` DATETIME(3) NULL,
    MODIFY `classeOrigem` VARCHAR(20) NULL,
    MODIFY `nivelOrigem` VARCHAR(20) NULL,
    MODIFY `classeDestino` VARCHAR(20) NULL,
    MODIFY `nivelDestino` VARCHAR(20) NULL;

CREATE INDEX `process_externalNumber_idx` ON `process`(`externalNumber`);
