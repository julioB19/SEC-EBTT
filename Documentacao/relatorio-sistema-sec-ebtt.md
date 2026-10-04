# Relatório funcional e de conformidade — SEC-EBTT

**Data da revisão:** 01/10/2026  
**Escopo:** código e banco locais, documentos oficiais preservados em `Documentacao/reference` e validações automatizadas/manuais executadas.

## 1. Conclusão executiva

O SEC-EBTT mantém os quatro fluxos definidos para o produto: Progressão, Promoção, RSC e Promoção à Classe Titular. A implementação não inclui GECC, processos administrativos genéricos nem integrações automáticas com SIPAC/SIMEC.

A principal lacuna de pontuação do RSC foi resolvida. O sistema agora carrega a planilha oficial IFFar 2025 em uma tabela versionada com **82 critérios**: 37 de RSC-I, 16 de RSC-II e 29 de RSC-III. O cálculo é feito no servidor por quantidade, ponto-base, fator e peso, com arredondamento por critério e teto por diretriz. A regra de decisão é 60 pontos totais e 36 no nível solicitado.

O fluxo RSC foi validado ponta a ponta e ficou preservado no processo local **#14**. A validação encontrou e corrigiu também um erro de serialização de `BigInt` que impedia a CPPD de listar processos com arquivos anexados.
Os fluxos completos de Progressão, Promoção e Classe Titular por memorial e tese também foram validados pelas APIs reais. Os testes confirmam documentos, comissão, pareceres, decisões e atualização do perfil funcional. A cobertura integral do backend passou a ter barreira automática mínima de 80%.

Ainda há diferenças entre o código e todo o rito normativo. Elas estão separadas no checklist entre pendências confirmadas e itens que dependem de confirmação do escopo acadêmico; não devem ser declaradas como implementadas antes da respectiva evidência no código e nos testes.

## 2. Arquitetura e módulos

| Camada | Tecnologia e responsabilidade |
|---|---|
| Interface | Next.js/React para docente, CPPD, administrador e avaliador externo |
| API | Node.js, Express e TypeScript |
| Persistência | Prisma ORM e MySQL 8 |
| Autenticação | JWT, renovação, revogação e seleção explícita de perfil |
| Documentos | Arquivos locais com acesso por endpoints autenticados |
| Qualidade | TypeScript, ESLint, Jest, Prisma e builds de produção |

RSC e Classe Titular usam o processo-base comum com detalhes específicos. Isso evita forçar no RSC os campos de classe/interstício exclusivos de Progressão/Promoção e preserva as relações compartilhadas de usuário, histórico, documentos e comissão.

## 3. Funcionalidades verificadas

### Progressão e Promoção

- abertura, edição e consulta;
- validação das transições de carreira existentes;
- preenchimento da tabela, comprovantes e submissão;
- geração de requerimento/planilha e consolidação de comprovantes;
- análise e decisão pela CPPD.

### RSC

- RSC-I, RSC-II e RSC-III;
- tabela oficial ativa `Tabela oficial RSC IFFar 2025` (#6);
- 82 critérios, 21 diretrizes e tetos oficiais;
- fórmula calculada no servidor e limites de quantidade;
- comprovantes e relatório restritos a PDF;
- mínimos de 60 pontos totais e 36 no nível pretendido;
- comissão, convite, aceite, portaria e prazo;
- reconhecimento de quantidades pelo avaliador;
- resultado individual automático e decisão final da CPPD.

### Classe Titular

- categoria e detalhes próprios;
- escolha entre memorial e tese;
- doutorado/diploma e mínimo de 120 pontos para envio;
- comissão final de um presidente interno e três externos;
- quatro avaliações e regra de três votos favoráveis;
- rito modelado de reavaliação, defesa e recurso.

### Administração e segurança

- múltiplos perfis e autorização pelo perfil selecionado;
- CPPD local limitada ao campus e CPPD Central com visão institucional;
- CPF protegido e login compatível;
- catálogo fixo de quatro processos;
- tabelas versionadas e documentos configuráveis;
- downloads protegidos por autenticação/autorização.

## 4. Matriz de conformidade atual

| Requisito | Situação | Evidência/observação |
|---|---|---|
| RSC — catálogo oficial | Conforme | 82 critérios ativos na tabela #6 e planilha-fonte preservada |
| RSC — fórmula e tetos | Conforme | cálculo no servidor, arredondamento por item e teto por diretriz |
| RSC — 60/36 | Conforme | validado na submissão e no parecer individual |
| RSC — PDF obrigatório | Conforme | relatório e comprovantes rejeitam formato diferente de PDF |
| RSC — comissão/avaliação básica | Conforme no fluxo atual | processo #14 concluiu o ciclo completo |
| RSC — elegibilidade e períodos | Conforme | titulação, ingresso, janela de cinco anos, concessão anterior, período de três anos e declaração são validados |
| RSC — composição exata e conflito | Conforme | novas ativações exigem 1 interno + 3 externos; aceite registra ausência de conflito e recusa exige motivo |
| RSC — parecer individual em PDF | Conforme | avaliador baixa o PDF após enviar; arquivo real foi renderizado e inspecionado |
| RSC — assinatura, consolidação e recursos | Não conforme | não há PDF assinado, PDF consolidado nem rito CPPD/CPRSC |
| Classe Titular — comissão e votação | Conforme no fluxo atual | 1 interno + 3 externos e mínimo de 3 votos |
| Classe Titular — C4/12/24 meses | Conforme | abertura exige C4 e 12 meses; concessão aprovada exige 24 meses completos |
| Classe Titular — sete indicados | Pendente de escopo | lista prévia 3+2+1+1 ainda não foi modelada |
| Classe Titular — prazos especiais e anexos | Parcial | rito existe; suspensão em férias/recessos e geração dos anexos faltam |
| Qualidade — cobertura regulatória de 80% | Conforme | 88,01% de linhas/instruções, 98,14% de funções e 68,24% de ramos |
| Qualidade — cobertura integral de 80% | Conforme | 80,10% de linhas/instruções, 94,32% de funções e 62,58% de ramos |

## 5. Teste manual preservado

O processo **#14**, `TESTE-MANUAL-RSC-2026-09-30`, foi criado com RSC-III e tabela #6 antes da correção que passou a exigir quatro membros na comissão. Foram anexados PDFs e registrados quatro critérios oficiais:

- RSC_054: 1 × 1 × 10 × 1 = 10;
- RSC_055: 4 × 1 × 2,5 × 1 = 10;
- RSC_058: 4 × 1 × 2,5 × 2 = 20;
- RSC_066: 2 × 1 × 5 × 2 = 20.

O total calculado foi 60 pontos no RSC-III. Uma tentativa de informar quantidade 2 em um critério limitado a 1 foi rejeitada, e o valor anterior permaneceu salvo. O cliente enviou deliberadamente pontuação e resultado contraditórios; o servidor ignorou esses valores e calculou 60 pontos e `DEFERRED`. A comissão foi concluída e a CPPD registrou a decisão final `APPROVED`.

O processo **#15**, `TESTE-RSC-ELEGIBILIDADE-2026-09-30`, foi criado como RSC-I e mantém ingresso, período e declaração de veracidade. Uma tentativa anterior com atividade além dos cinco anos permitidos foi rejeitada e não gerou processo.

O parecer individual real da avaliação do processo #14 foi gerado, renderizado em A4 e preservado em `Documentacao/testes/parecer-processo-14-avaliador-7.pdf`.

## 6. Validações técnicas

- 21 migrations aplicadas ao MySQL local;
- Prisma format/generate concluídos;
- build e lint do backend aprovados;
- build e typecheck do frontend aprovados;
- 30 suítes e 179 testes automatizados aprovados;
- cobertura integral do backend em 80,10% de linhas/instruções, com barreira automática de 80%;
- cobertura do núcleo regulatório em 88,01% de linhas/instruções;
- teste de regressão para resposta JSON contendo `BigInt`;
- ciclos completos de Progressão, Promoção e Classe Titular por memorial e tese;
- concorrência na composição da comissão, preservando unicidade e resposta de negócio;
- fluxo RSC real executado pelas rotas da aplicação e confirmado no banco.

O frontend não possui script de lint separado; o build executa a verificação de tipos e validade. A conferência visual final percorreu 21 telas autenticadas dos perfis Docente, CPPD, Administrador e Avaliador Externo. Após as correções encontradas, não permaneceram exceções JavaScript, falhas de requisição, imagens quebradas ou estouro horizontal na resolução 1440 × 1000. As capturas e o relatório estruturado estão em `Documentacao/testes/visual/final`.

## 7. Fontes preservadas

- `Documentacao/reference/regulamento-rsc-iffar-2025.pdf`;
- `Documentacao/reference/rsc/formulario-oficial-avaliacao-rsc-iffar-2025.xlsx`;
- `Documentacao/reference/regulamento-classe-titular-resolucao-11-2024.pdf`;
- `Documentacao/reference/homologacao-classe-titular-resolucao-40-2024.pdf`;
- `Documentacao/reference/orientacoes-classe-titular-cppd-2026.pdf`;
- modelos oficiais em `Documentacao/reference/classe-titular/modelos-oficiais`;
- auditoria detalhada em `Documentacao/auditoria-processos-cppd.md`.

## 8. Próximos passos

Os itens confirmados desta etapa estão implementados e cobertos por testes. O próximo passo é somente confirmar com orientador/CPPD se as lacunas normativas marcadas como dependentes de escopo devem integrar o TCC; nenhuma delas deve ser implementada automaticamente antes dessa decisão.
