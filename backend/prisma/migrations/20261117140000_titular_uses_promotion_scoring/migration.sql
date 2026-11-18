-- A Classe Titular passa a usar a planilha de pontuação de Progressão/Promoção
-- (a CPPD/IFFar publica o mesmo arquivo como "Formulário de avaliação de desempenho").
UPDATE `process_type_config`
SET `requiresScoring` = true
WHERE `category` = 'FULL_PROFESSOR';

-- Processos de Classe Titular já abertos recebem a tabela vigente de Progressão/Promoção.
UPDATE `process` p
JOIN `process_type_config` c ON c.`idProcessType` = p.`processTypeId`
SET p.`scoringTableId` = (
  SELECT t.`idScoringTable`
  FROM `scoring_table` t
  WHERE t.`purpose` = 'PROGRESSION_PROMOTION'
    AND t.`status` = 'ACTIVE'
    AND t.`deletedDate` IS NULL
  ORDER BY t.`startsOn` DESC, t.`idScoringTable` DESC
  LIMIT 1
)
WHERE c.`category` = 'FULL_PROFESSOR'
  AND p.`scoringTableId` IS NULL;
