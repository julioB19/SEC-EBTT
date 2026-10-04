# Requisitos completos do SEC-EBTT

**Versão:** 1.2
**Atualizado em:** 30/09/2026
**Escopo validado:** Progressão/Promoção, Reconhecimento de Saberes e Competências (RSC), Promoção à Classe Titular, administração, autenticação e avaliadores internos/externos.

## 1. Objetivo

O SEC-EBTT deve apoiar a abertura, instrução, avaliação, decisão e auditoria de processos funcionais docentes do IFFar, respeitando o papel ativo do usuário, a legislação aplicável e os documentos oficiais da CPPD.

Este documento consolida os requisitos funcionais e não funcionais confirmados até 29/09/2026. O estado de implementação é acompanhado em `checklist-adequacao-cppd.md`.

## 2. Perfis e autorização

- **RF-GER-01:** autenticar usuários por CPF e senha.
- **RF-GER-02:** renovar e revogar sessões com segurança.
- **RF-GER-03:** permitir que um usuário com mais de um papel selecione o papel ativo.
- **RF-GER-04:** autorizar cada operação pelo papel atualmente selecionado, e não apenas pelos papéis cadastrados.
- **RF-GER-05:** oferecer os papéis `DOCENTE`, `CPPD`, `ADMIN` e `EXTERNAL_EVALUATOR`.
- **RF-GER-06:** manter perfil docente com SIAPE, classe/nível, formação, lotação e início de interstício.
- **RF-GER-07:** registrar alterações relevantes em histórico auditável.
- **RF-GER-08:** impedir acesso direto e público aos arquivos enviados.

## 3. Administração e tabelas de pontuação

- **RF-ADM-01:** cadastrar, consultar, editar, ativar e desativar usuários.
- **RF-ADM-02:** atribuir papéis e manter os dados específicos de docente e avaliador externo.
- **RF-TAB-01:** criar tabelas de pontuação em rascunho.
- **RF-TAB-02:** separar tabelas destinadas à carreira das tabelas destinadas ao RSC.
- **RF-TAB-03:** organizar tabelas em blocos, sub-blocos e itens.
- **RF-TAB-04:** configurar ponto-base, quantidade máxima, peso, fator, teto e fórmulas.
- **RF-TAB-05:** impedir alterações estruturais depois da ativação.
- **RF-TAB-06:** impedir vigências ativas sobrepostas para a mesma finalidade.
- **RF-TAB-07:** permitir exclusão lógica somente de tabelas em rascunho e sem processos vinculados.
- **RF-TAB-08:** exigir, para tabela RSC ativa, mínimo de 60 pontos totais e 36 pontos no nível pretendido.

## 4. Progressão e Promoção

- **RF-CAR-01:** permitir abertura de processo de Progressão ou Promoção pelo docente.
- **RF-CAR-02:** registrar campus, cidade/UF, origem, destino e período de interstício.
- **RF-CAR-03:** validar a classe/nível de origem contra o cadastro funcional atual.
- **RF-CAR-04:** permitir somente movimentações válidas da carreira.
- **RF-CAR-05:** aplicar 36 meses para A1→B1 e 24 meses nas demais transições vigentes.
- **RF-CAR-06:** permitir preparação somente nos 60 dias anteriores ao fim do interstício.
- **RF-CAR-07:** impedir submissão antes do cumprimento integral do interstício.
- **RF-CAR-08:** impedir processo ativo duplicado e reutilização indevida de interstício ou movimentação já aprovada.
- **RF-CAR-09:** preencher a tabela oficial, calcular pontuação e aplicar teto e fórmulas.
- **RF-CAR-10:** orientar e registrar a equivalência Qualis vigente.
- **RF-CAR-11:** anexar um comprovante PDF por item pontuado.
- **RF-CAR-12:** gerar a planilha oficial em PDF.
- **RF-CAR-13:** gerar arquivo consolidado de comprovantes, com índice, separadores e paginação global.
- **RF-CAR-14:** permitir avaliação item a item pela CPPD, com pontuação reconhecida e justificativa de divergência.
- **RF-CAR-15:** gerar parecer, registrar avaliadores e validar o conjunto documental.
- **RF-CAR-16:** deferir ou indeferir e registrar efeitos financeiros na data de cumprimento de todos os requisitos.
- **RF-CAR-17:** atualizar a classe funcional somente quando a decisão deferida for compatível com a origem cadastrada.

## 5. Reconhecimento de Saberes e Competências

- **RF-RSC-01:** manter detalhes próprios de RSC, sem exigir os campos específicos de Progressão/Promoção.
- **RF-RSC-02:** permitir solicitação de RSC-I, RSC-II ou RSC-III.
- **RF-RSC-03:** validar escolaridade/titulação habilitante para o nível solicitado.
- **RF-RSC-04:** registrar ingresso na carreira EBTT e concessões anteriores.
- **RF-RSC-05:** limitar atividades anteriores ao ingresso à janela regulamentar de cinco anos.
- **RF-RSC-06:** exigir ao menos três anos de atividades após concessão anterior para novo nível.
- **RF-RSC-08:** disponibilizar os 82 critérios oficiais da planilha de RSC (37/16/29), sem inventar critérios ou pontuações.
- **RF-RSC-09:** calcular cada critério por quantidade, ponto-base, peso, fator e teto.
- **RF-RSC-10:** arredondar o resultado final de cada critério antes da soma.
- **RF-RSC-11:** respeitar limites por diretriz e mínimo de 60 pontos totais e 36 no nível solicitado.
- **RF-RSC-12:** exigir memorial e comprovante PDF para todo item pontuado.
- **RF-RSC-13:** gerar dossiê único, ordenado, indexado e numerado.
- **RF-RSC-14:** exigir declaração de veracidade antes da submissão.
- **RF-RSC-15:** cadastrar avaliador externo com dados funcionais e conta de acesso.
- **RF-RSC-16:** formar comissão com um avaliador interno e três externos.
- **RF-RSC-17:** impedir que o requerente avalie o próprio processo.
- **RF-RSC-19:** exigir aceite, ausência de conflito e motivo de recusa ou impedimento.
- **RF-RSC-20:** ocultar documentos e pontuação do avaliador antes do aceite.
- **RF-RSC-21:** registrar quantidade reconhecida e comentário por critério.
- **RF-RSC-22:** calcular o parecer individual automaticamente pela regra 60/36.
- **RF-RSC-23:** gerar parecer individual em PDF.
- **RF-RSC-24:** registrar PDF assinado, provedor, signatário, data, hash SHA-256, validação e versões.
- **RF-RSC-25:** consolidar quatro avaliações e deferir com pelo menos três pareceres favoráveis.
- **RF-RSC-26:** permitir cancelamento/substituição auditável de atribuição.
- **RF-RSC-27:** permitir recurso à CPPD em até 45 dias, com nova comissão e sem provas novas.
- **RF-RSC-28:** permitir recurso final à CPRSC em até dez dias após o indeferimento da CPPD.
- **RF-RSC-29:** registrar decisão final e preservar toda a trilha de auditoria.

## 6. Promoção à Classe Titular

- **RF-TIT-01:** manter processo próprio de Classe Titular, separado de Promoção comum.
- **RF-TIT-02:** exigir cadastro funcional em C4 e título de doutor.
- **RF-TIT-03:** permitir abertura após 12 meses em C4 e exigir 24 meses para a concessão.
- **RF-TIT-04:** exigir avaliação de desempenho aprovada com pelo menos 120 pontos.
- **RF-TIT-05:** exigir diploma de doutorado e reconhecimento nacional quando obtido no exterior.
- **RF-TIT-06:** permitir escolha entre memorial descritivo e tese acadêmica inédita.
- **RF-TIT-07:** exigir memorial e comprovantes em arquivo PDF único ou tese e declaração de ineditismo.
- **RF-TIT-08:** registrar lista de sete indicados: 3 externos titulares, 2 externos suplentes, 1 interno titular e 1 interno suplente.
- **RF-TIT-09:** validar doutorado, posição na carreira, instituição, área ou área afim e ciência prévia.
- **RF-TIT-10:** constituir Comissão Especial com três membros externos e um interno.
- **RF-TIT-11:** registrar portaria da Comissão e interlocutor da CPPD.
- **RF-TIT-12:** controlar prazo de até 45 dias após a portaria para conclusão da avaliação.
- **RF-TIT-13:** registrar quatro pareceres individuais e o parecer do presidente.
- **RF-TIT-14:** aprovar memorial ou tese com pelo menos 75% de votos favoráveis.
- **RF-TIT-15:** registrar parecer assinado em PDF, provedor, hash SHA-256 e validação administrativa.
- **RF-TIT-16:** permitir pedido de reavaliação do memorial em até dois dias úteis após o parecer do presidente.
- **RF-TIT-17:** agendar defesa oral da reavaliação em até 30 dias, perante a mesma Comissão Especial, com ata.
- **RF-TIT-18:** permitir recurso por reprovação em até dois dias úteis.
- **RF-TIT-19:** suspender prazos durante férias e recessos acadêmicos do IFFar.
- **RF-TIT-20:** gerar os documentos previstos nos Anexos IV, V, VII, IX e X do Regulamento.
- **RF-TIT-21:** calcular efeitos financeiros pela data em que doutorado, desempenho, memorial/tese e interstício estiverem cumpridos.
- **RF-TIT-22:** atualizar a classe para D1 somente após deferimento e quando os requisitos temporais permitirem.

## 7. Regras oficiais de pontuação do RSC

- **Fórmula do item:** quantidade × ponto-base × fator do item × peso da diretriz, com arredondamento do resultado do item e aplicação do teto da diretriz.
- **Limites RSC-I:** diretrizes I=10, II=10, III=20, IV=20, V=20, VI=10 e VII=10.
- **Limites RSC-II:** diretrizes I=30, II=10, III=10, IV=20, V=10, VI=10 e VII=10.
- **Limites RSC-III:** diretrizes I=10, II=10, III=20, IV=10, V=20, VI=20 e VII=10.
- **Regra ativa:** mínimo de 60 pontos totais e 36 pontos no nível pretendido.
- **Regra histórica:** a planilha IFFar 2021 aplicava 50 pontos totais e 25 no nível; essa versão só pode ser usada para reprodução de processos antigos, com vigência explícita.
- **Catálogo:** os fatores, unidades, limites de quantidade e pesos dos 82 critérios estão preservados em `Documentacao/reference/rsc/formulario-oficial-avaliacao-rsc-iffar-2025.xlsx` e carregados pela versão oficial da tabela.

## 8. Fora do escopo

- GECC e pagamento de avaliadores.
- Licença Capacitação, Retribuição por Titulação, Ação de Desenvolvimento em Serviço e outros processos administrativos genéricos.
- Integrações automáticas com SIPAC, SIMEC, Google Drive, ConferênciaWeb, calendários institucionais, correio institucional ou ICP-Brasil.
- Sorteio automático de avaliadores, emissão externa de portarias e publicação institucional.

## 9. Requisitos não funcionais

- **RNF-01:** usar TypeScript com build sem erros e lint aprovado.
- **RNF-02:** preservar no mínimo 80% de cobertura de linhas, instruções e funções do backend.
- **RNF-03:** manter migrations Prisma reproduzíveis e compatíveis com MySQL.
- **RNF-04:** validar arquivos no servidor e limitar uploads aos formatos e tamanhos autorizados.
- **RNF-05:** impedir enumeração ou download de documentos sem autenticação e autorização.
- **RNF-06:** preservar exclusão lógica, históricos, versões e decisões já emitidas.
- **RNF-07:** executar operações críticas de comissão e decisão em transação.
- **RNF-08:** exibir datas e valores conforme o padrão brasileiro sem perder precisão no banco.
- **RNF-09:** manter interface utilizável por docente, CPPD, administrador e avaliador externo.
- **RNF-10:** não alterar regras oficiais de pontuação sem fonte normativa verificável.

## 10. Critérios gerais de aceite

Um fluxo é considerado concluído quando:

1. regras de elegibilidade e prazo são validadas no servidor;
2. documentos obrigatórios e declarações são exigidos;
3. somente papéis autorizados conseguem visualizar ou alterar o processo;
4. toda mudança de estado relevante fica auditável;
5. a decisão e seus efeitos financeiros são calculados de forma determinística;
6. testes de sucesso, bloqueio, autorização e limites estão aprovados;
7. build, lint, Prisma e cobertura passam sem redução dos pisos configurados.

## 11. Fontes normativas e operacionais

- CPPD/IFFar — orientações públicas para Progressão/Promoção, RSC e Classe Titular;
- Lei nº 12.772/2012, texto compilado;
- Resolução Consup nº 104/2013 para avaliação de desempenho;
- Resolução Consup nº 24/2025 e Regulamento RSC nº 7/2025;
- Resolução ad referendum Consup/IFFar nº 11/2024 — regulamento da Classe Titular;
- Resolução Consup/IFFar nº 40/2024 — homologação da Resolução 11/2024;
- formulários, memoriais, planilha RSC e orientações fornecidos pela CPPD.
