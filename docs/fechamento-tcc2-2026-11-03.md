# Correções da revisão do TCC 2

- **Decisão de carreira:** a transação só grava a conclusão se o processo ainda estiver no estado usado para avaliar. Uma segunda decisão recebe conflito e precisa recarregar a página; o histórico e a classe funcional permanecem associados à decisão efetivada.
- **Prazos:** a contagem parte da data civil em `America/Sao_Paulo`. O vencimento ocorre no último milissegundo do dia local; feriados, recessos e férias continuam seguindo o calendário. Datas de portaria são tratadas como datas civis, sem deslocamento de dia. A migração ajusta a representação antiga dos prazos abertos de comissão e preserva os encerrados.
- **Classe Titular:** em “Documentos e requisitos do processo”, o docente preenche a data de admissão, o regime de trabalho e a área de concurso. Esses dados entram no requerimento inicial e são exigidos ao submeter a solicitação. Após a apresentação do recurso, o requerente e a CPPD podem gerar o PDF do Anexo X, com fundamentos e campo de assinatura. A assinatura oficial continua externa ao SEC-EBTT.
- **Avaliação de carreira:** a interface e a API exigem justificativa para pontuação reconhecida diferente da declarada. A finalização também verifica divergências antigas sem motivo.

Aplicar a migração versionada `20261103150000_titular_documents_and_civil_deadlines` e regenerar o Prisma Client ao atualizar o ambiente. Antes de produção, a CPPD deve conferir a aderência do conteúdo dos formulários e validar o fluxo com os usuários.
