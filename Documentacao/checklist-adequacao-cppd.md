# Checklist de conclusão do SEC-EBTT

Ordem de execução: risco de exposição e decisão inválida, regras normativas, documentos, recursos e administração, validação final. Um item só será marcado concluído após implementação e verificação. Data de início: 17/10/2026.

## Prioridade 1 Segurança e decisões

- [x] 01 Bloquear acesso público aos uploads e preservar downloads autorizados.
- [x] 02 Exigir papel ativo correto nas operações de docente e avaliador.
- [x] 03 Exigir quatro pareceres e pelo menos três favoráveis para deferir RSC.
- [x] 04 Bloquear deferimento de carreira abaixo da pontuação reconhecida mínima.
- [x] 05 Impedir C4→D1 pela promoção comum e validar origem funcional na decisão.
- [x] 06 Proteger tabelas ativas, versões históricas, vigências e mínimos oficiais.

## Prioridade 2 Elegibilidade e datas

- [x] 07 Validar preparação de carreira nos 60 dias anteriores ao término do interstício.
- [x] 08 Exigir análise de desempenho e doutorado pela CPPD na Classe Titular.
- [x] 09 Calcular no servidor as datas oficiais e efeitos financeiros.
- [x] 10 Exigir reconhecimento do diploma estrangeiro e declaração de ineditismo da tese.
- [x] 11 Implementar lista de sete indicados, suplentes e validação da qualificação da banca.
- [x] 12 Aplicar feriados, férias e recessos aos prazos processuais.

## Prioridade 3 Documentos e rastreabilidade

- [x] 13 Gerar requerimentos próprios de RSC e Classe Titular.
- [x] 14 Exportar planilhas corretas por finalidade e com mapeamento estável.
- [x] 15 Gerar dossiê com índice, separadores, numeração global e memorial quando aplicável.
- [x] 16 Gerar parecer consolidado, parecer do presidente, atas e anexos oficiais.
- [x] 17 Receber PDFs assinados com signatário, provedor, data, hash, validação e versões.
- [x] 18 Completar cadastro e reutilização de titulações e evidências.
- [x] 19 Completar auditoria de pontuações, pareceres, documentos e modelos versionados.
- [x] 20 Exibir orientação de equivalência Qualis e referências manuais SIPAC/SIMEC.

## Prioridade 4 Recursos e escopo complementar

- [x] 21 Implementar recursos do RSC à CPPD e CPRSC, preservando documentos e comissões anteriores.
- [x] 22 Concluir a gestão de modelos e documentos obrigatórios por tipo de processo.
- [x] 23 Manter CPF e senha conforme RF-GER-01 e registrar a autenticação externa fora desta entrega.
- [x] 24 GECC excluído desta execução por confirmação explícita do usuário.
- [x] 25 Processos simples excluídos desta execução por confirmação explícita do usuário.

## Prioridade 5 Validação e entrega

- [x] 26 Aprovar testes de regressão, integração, builds, lint e cobertura.
- [x] 27 Conferir fluxos dos perfis, documentos gerados e migrações em banco isolado.
- [x] 28 Atualizar documentação, aplicar as alterações verificadas ao repositório local e registrar limitações restantes.

## Evidências da conclusão

- Escopo confirmado pelo usuário: somente Progressão, Promoção, RSC e Classe Titular.
- 36 suítes e 220 testes aprovados, incluindo os fluxos HTTP reais e os dois recursos do RSC.
- Cobertura integral do backend: 81,30% de linhas/instruções, 94,13% de funções e 64,08% de ramos. Limites existentes preservados.
- Núcleo regulatório: 88,18% de linhas/instruções, 98,24% de funções e 70,62% de ramos.
- Backend: build e lint aprovados. Frontend: build de produção e verificação de tipos aprovados.
- 23 migrações verificadas em MySQL isolado no Docker, sem uso do banco principal pelos testes.
- Telas de administração, titulações e Classe Titular conferidas no navegador. Planilha RSC, dossiê, pareceres e ata renderizados para conferência.
- Cópia de segurança do banco local preservada antes da atualização. A sincronização verifica os hashes para não sobrescrever alterações concorrentes do usuário.
- Assinatura institucional e referências SIPAC/SIMEC permanecem externas, com registro e conferência administrativa no sistema.

Detalhes e instruções: [Conclusão dos quatro processos](conclusao-quatro-processos-2026-10-17.md).

- Aplicação final concluída no repositório original e no banco local: 23 migrações aplicadas, sete usuários e cinco processos preservados. Build de produção Turbopack aprovado também na instalação original.
