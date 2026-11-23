# Requisitos completos do SEC-EBTT

**Versão:** 1.5 — revisão do TCC II
**Atualizado em:** 23/11/2026
**Referência técnica:** revisão d3d630f do repositório julioB19/SEC-EBTT e ajustes de 23/11/2026. A versão 1.4 referia-se à revisão 4572155, que inclui a correção da ata.
**Escopo descrito:** Progressão/Promoção, RSC, Classe Titular, administração, autenticação e avaliações.

## 1. Objetivo

O SEC-EBTT deve apoiar a abertura, instrução, avaliação, decisão e auditoria de processos funcionais docentes do IFFar, respeitando o papel ativo do usuário, a legislação aplicável e os documentos oficiais da CPPD.

Este documento consolida os requisitos. A versão 1.4 acrescenta os requisitos de acesso, administração e proteção de dados já implementados que não constavam da versão anterior (RF-GER-09 a RF-GER-14, RF-ADM-03 a RF-ADM-06 e RNF-11). A versão 1.5 incorpora os ajustes pedidos na revisão do orientador para a Classe Titular: avaliação de desempenho pela planilha de Progressão/Promoção (RF-TIT-04), doutorado escolhido no perfil (RF-TIT-05), lista de indicados em rascunho (RF-TIT-08) e documentos gerados por perfil (RF-TIT-23). Acrescenta também o convite de avaliador externo sem cadastro (RF-RSC-30). O quadro da seção 12 indica as evidências e os limites dos pontos revisados para o TCC II. A numeração mantém os identificadores usados no artigo e nos registros de teste.

O levantamento inicial, `Documento_Requisitos_CPPD_RSC_Titular_v2.docx`, usa identificadores próprios. Sua exigência RF-043, que reúne portaria, defesa, reavaliação e recurso, aparece aqui em RF-TIT-11 e RF-TIT-16 a RF-TIT-20. O requisito condicional RF-003 do levantamento trata do acesso pelo Google, cujo alcance de validação é indicado na seção 12.

## 2. Perfis e autorização

- **RF-GER-01:** autenticar usuários por CPF e senha.
- **RF-GER-02:** renovar e revogar sessões com segurança.
- **RF-GER-03:** permitir que um usuário com mais de um papel selecione o papel ativo.
- **RF-GER-04:** autorizar cada operação pelo papel atualmente selecionado, e não apenas pelos papéis cadastrados.
- **RF-GER-05:** oferecer os papéis `DOCENTE`, `CPPD_MEMBER` (CPPD local), `CPPD_CENTRAL`, `ADMIN` e `EXTERNAL_EVALUATOR`. A CPPD local opera segundo seus vínculos por campus.
- **RF-GER-06:** manter perfil docente com SIAPE, classe/nível, formação, lotação e início de interstício.
- **RF-GER-07:** registrar alterações relevantes em histórico auditável.
- **RF-GER-08:** impedir acesso direto e público aos arquivos enviados.
- **RF-GER-09:** permitir redefinição de senha por código temporário enviado ao e-mail cadastrado, com prazo de expiração.
- **RF-GER-10:** permitir o autocadastro de docente com CPF e senha, funcionalidade herdada da versão anterior.
- **RF-GER-11:** permitir acesso pela conta Google quando o e-mail pertencer a domínio aceito pelo campus ou tiver convite vigente.
- **RF-GER-12:** convidar usuários por e-mail, confirmar o endereço por código e exigir aprovação administrativa antes de ativar o avaliador externo.
- **RF-GER-13:** manter as titulações do docente com instituição, data de conclusão e comprovante, incluindo o reconhecimento do diploma obtido no exterior.
- **RF-GER-14:** permitir reutilizar um comprovante já enviado em outros itens e processos do mesmo docente.

## 3. Administração e tabelas de pontuação

- **RF-ADM-01:** cadastrar, consultar, editar, ativar e desativar usuários.
- **RF-ADM-02:** atribuir papéis e manter os dados específicos de docente e avaliador externo.
- **RF-ADM-03:** cadastrar campi e as comissões da CPPD de cada campus, com portaria, vigência e membros.
- **RF-ADM-04:** configurar os domínios de e-mail institucionais aceitos em cada campus.
- **RF-ADM-05:** cadastrar o calendário institucional, com feriados, férias e recessos aplicados aos prazos.
- **RF-ADM-06:** manter modelos de documentos e exigências documentais por categoria de processo, com versões que preservam os registros já utilizados.
- **RF-TAB-01:** criar tabelas de pontuação em rascunho.
- **RF-TAB-02:** separar tabelas destinadas à carreira das tabelas destinadas ao RSC. A Classe Titular usa a tabela de carreira, porque a CPPD publica a mesma planilha para Progressão/Promoção e como formulário de avaliação de desempenho da Titular.
- **RF-TAB-03:** organizar tabelas em blocos, sub-blocos e itens.
- **RF-TAB-04:** configurar ponto-base, quantidade máxima, peso, fator, teto e fórmulas.
- **RF-TAB-05:** impedir alterações estruturais depois da ativação.
- **RF-TAB-06:** impedir vigências ativas sobrepostas para a mesma finalidade.
- **RF-TAB-07:** permitir exclusão lógica somente de tabelas em rascunho e sem processos vinculados.
- **RF-TAB-08:** aplicar o piso de 60 pontos na configuração de tabelas de RSC. Na submissão e na avaliação individual, exigir também 36 pontos no nível pretendido (RF-RSC-11 e RF-RSC-22).

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
- **RF-CAR-12:** gerar o requerimento e a planilha oficial em PDF.
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
- **RF-RSC-30:** permitir à CPPD convidar para a comissão especial, de RSC ou de Classe Titular, um avaliador externo ainda sem cadastro aprovado, reservando a vaga. A vaga reservada conta na composição, mas a ativação fica bloqueada até o cadastro ser aprovado e a pessoa ocupar a vaga.

## 6. Promoção à Classe Titular

- **RF-TIT-01:** manter processo próprio de Classe Titular, separado de Promoção comum.
- **RF-TIT-02:** exigir cadastro funcional em C4 e título de doutor.
- **RF-TIT-03:** permitir abertura após 12 meses em C4 e exigir 24 meses para a concessão.
- **RF-TIT-04:** exigir avaliação de desempenho com pelo menos 120 pontos, lançada pelo docente na mesma tabela de pontuação de Progressão/Promoção, com comprovante por item, enviada junto com o processo e aprovada pela CPPD na análise prévia. O reenvio de processo devolvido anula a aprovação anterior do desempenho.
- **RF-TIT-05:** exigir diploma de doutorado e reconhecimento nacional quando obtido no exterior. O doutorado é selecionado entre as titulações do próprio docente (RF-GER-13), com data de conclusão, sem novo envio do diploma no processo.
- **RF-TIT-06:** permitir escolha entre memorial descritivo e tese acadêmica inédita.
- **RF-TIT-07:** exigir memorial e comprovantes em arquivo PDF único ou tese e declaração de ineditismo.
- **RF-TIT-08:** registrar lista de sete indicados: 3 externos titulares, 2 externos suplentes, 1 interno titular e 1 interno suplente. A lista pode ser salva em rascunho, com indicados incompletos; a lista completa é exigida no envio e na conferência da CPPD.
- **RF-TIT-09:** validar doutorado, posição na carreira, instituição, área ou área afim e ciência prévia.
- **RF-TIT-10:** constituir a Comissão Especial ordinária com três membros externos e um interno na presidência. A hipótese de quatro membros externos prevista no art. 5º, §7º, está fora do fluxo implementado e depende de validação da CPPD.
- **RF-TIT-11:** registrar portaria da Comissão e interlocutor da CPPD.
- **RF-TIT-12:** controlar prazo de até 45 dias após a portaria para conclusão da avaliação.
- **RF-TIT-13:** registrar quatro pareceres individuais e o parecer do presidente.
- **RF-TIT-14:** aprovar memorial ou tese com pelo menos 75% de votos favoráveis.
- **RF-TIT-15:** registrar parecer assinado em PDF, provedor, hash SHA-256 e validação administrativa.
- **RF-TIT-16:** permitir pedido de reavaliação do memorial em até dois dias úteis após o parecer do presidente.
- **RF-TIT-17:** agendar defesa oral da reavaliação em até 30 dias, perante a mesma Comissão Especial, com ata.
- **RF-TIT-18:** permitir recurso por reprovação em até dois dias úteis.
- **RF-TIT-19:** suspender prazos durante férias e recessos acadêmicos do IFFar.
- **RF-TIT-20:** gerar documentos de apoio correspondentes aos Anexos IV, V, VII, IX e X do Regulamento. A ata deve registrar o resultado da sessão da modalidade correspondente. Um eventual recurso acrescenta uma decisão própria ao histórico.
- **RF-TIT-21:** calcular efeitos financeiros pela data em que doutorado, desempenho, memorial/tese e interstício estiverem cumpridos.
- **RF-TIT-22:** atualizar a classe para D1 somente após deferimento e quando os requisitos temporais permitirem.
- **RF-TIT-23:** restringir os documentos gerados pelo docente ao requerimento, à lista de indicados, à planilha de pontuação e aos comprovantes, além dos documentos que ele próprio assina (declaração de ineditismo e requerimento de recurso). Pareceres e atas são gerados pela CPPD ou pela Comissão Especial, inclusive no acesso direto pelo servidor.

## 7. Regras oficiais de pontuação do RSC

- **Fórmula do item:** quantidade × ponto-base × fator do item × peso da diretriz, com arredondamento do resultado do item e aplicação do teto da diretriz.
- **Limites RSC-I:** diretrizes I=10, II=10, III=20, IV=20, V=20, VI=10 e VII=10.
- **Limites RSC-II:** diretrizes I=30, II=10, III=10, IV=20, V=10, VI=10 e VII=10.
- **Limites RSC-III:** diretrizes I=10, II=10, III=20, IV=10, V=20, VI=20 e VII=10.
- **Regra ativa:** mínimo de 60 pontos totais e 36 pontos no nível pretendido.
- **Regra histórica:** a planilha IFFar 2021 aplicava 50 pontos totais e 25 no nível. Essa regra fica registrada apenas como referência e não foi implementada; o sistema aplica somente a regra ativa.
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
- **RNF-11:** armazenar o CPF com cifragem autenticada e usar identificador derivado para busca.

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

## 12. Evidências e limites da revisão

| Requisito | Evidência e alcance |
| --- | --- |
| RF-RSC-08 | O catálogo carregado tem 82 critérios, distribuídos em 37, 16 e 29. A contagem comprova a extensão do catálogo. A equivalência de cada fator e teto com a planilha oficial requer conferência específica. |
| RF-RSC-22 e RF-RSC-25 | A Tabela 4 do artigo aponta os casos de parecer individual, consolidação e bloqueio de membro repetido no recurso. O material complementar indica os registros da execução isolada. |
| RF-TIT-10 | A configuração implementada e testada é a ordinária, com presidência interna. |
| RF-TIT-17, RF-TIT-18, RF-TIT-20 e RNF-06 | O teste da ata de reavaliação registra defesa reprovada, recurso aprovado e compara o resultado das atas geradas nas duas etapas. O modelo lógico registra os eventos separadamente do estado corrente. |
| RF-RSC-24 e RF-TIT-15 | As verificações técnicas exercitaram o envio, o registro de metadados, a integridade do PDF e a conferência administrativa com dados fictícios. A conferência da assinatura na plataforma competente faz parte do procedimento institucional. |
| RNF-02 | O requisito mantém o alvo de 80% para o backend. Os 88,06% de linhas e instruções da rodada de 03/11 referem-se aos seis arquivos do núcleo regulatório. A evidência citada tem esse alcance. |
| RF-TIT-04, RF-TIT-05, RF-TIT-08 e RF-TIT-23 | Ajustes de 23/11/2026, após a revisão do orientador. Os testes de integração preenchem a planilha de Progressão/Promoção até 120 pontos, geram a planilha em PDF e conferem a lista de documentos do docente, o bloqueio do parecer da CPPD, a consulta da planilha pela CPPD e a anulação da aprovação no reenvio. A equivalência com o formulário oficial segue a mesma ressalva da tabela de carreira. |
| RNF-05 | Os cenários isolados verificaram arquivo privado, processo alheio e abrangência da CPPD por campus. |

A autenticação pelo Google e a entrega de e-mail foram exercitadas com serviços simulados nos testes citados. A validação institucional dos fluxos e dos documentos gerados permanece pendente.
