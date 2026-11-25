-- Período avaliado da avaliação de desempenho da Classe Titular, informado pelo docente.
-- A planilha de Progressão/Promoção usa as datas do interstício, que a Titular não tem.
ALTER TABLE `process_compliance`
    ADD COLUMN `titularPerformancePeriodStart` DATE NULL,
    ADD COLUMN `titularPerformancePeriodEnd` DATE NULL;
