-- Permite salvar a lista de indicados aos poucos; a lista completa continua exigida no envio e na conferência.
ALTER TABLE `process_nominee`
    MODIFY `email` VARCHAR(180) NULL,
    MODIFY `phone` VARCHAR(30) NULL,
    MODIFY `doctorateTitle` VARCHAR(180) NULL,
    MODIFY `institution` VARCHAR(180) NULL,
    MODIFY `knowledgeArea` VARCHAR(180) NULL,
    MODIFY `priorConsentAt` DATETIME(3) NULL;
