# Auditoria dos processos públicos da CPPD/IFFar e cobertura do SEC-EBTT

**Data da verificação:** 27 de setembro de 2026
**Escopo:** páginas públicas oficiais do IFFar/CPPD, atos oficiais do IFFar, legislação federal oficial e oito arquivos fornecidos pelo usuário após acesso autenticado; comparação estática com o código presente no repositório `SEC-EBTT`. Não houve alteração de código.

## 1. Resumo executivo

A página inicial pública da CPPD apresenta quatro processos: **Progressão/Promoção**, **Promoção à Classe Titular**, **Reconhecimento de Saberes e Competências (RSC)** e **Ação de desenvolvimento em serviço**. Por solicitação da auditoria, também foram examinadas **Licença para Capacitação** e **Retribuição por Titulação (RT)**, que aparecem em páginas oficiais de Gestão de Pessoas, mas não como itens da página inicial atual da CPPD.

| Processo | Cobertura no SEC-EBTT | Síntese |
|---|---|---|
| Progressão/Promoção | **Parcial** | Núcleo bem coberto: transições, interstícios, mínimo de 120 pontos, tabela, comprovantes e avaliação. Faltam alguns controles documentais/procedimentais e a orientação explícita da equivalência Qualis atual. |
| Promoção à Classe Titular | **Parcial** | A transição C4→D1 existe como promoção comum, mas não o rito específico de doutorado, memorial/tese, lista estruturada de sete nomes e comissão especial. |
| RSC | **Parcial** | Há módulo próprio robusto e os 82 critérios conferem numericamente com a planilha oficial; faltam elegibilidade, regras temporais, sorteio/banco SIMEC, parecer oficial assinado e recursos. |
| Ação de desenvolvimento em serviço | **Ausente** | Não há tipo, modelo, rota ou interface específica. |
| Licença para Capacitação | **Ausente** | Não há tipo, modelo, rota ou interface específica. |
| Retribuição por Titulação | **Ausente** | Há informação de escolaridade no perfil, mas não um processo de RT. |

Nenhum processo foi classificado como **completo**, pois todos os fluxos implementados apresentam ao menos uma lacuna material frente às regras públicas verificadas.

## 2. Critério e limitações

- **Completo:** finalidade, elegibilidade, documentos, cálculo, tramitação, decisão e recursos públicos materialmente cobertos.
- **Parcial:** existe fluxo utilizável, mas faltam requisitos ou etapas relevantes.
- **Ausente:** não existe fluxo específico, ainda que algum dado genérico possa ser armazenado.
- A navegação “**Orientações aos membros da CPPD (acesso restrito)**” não pôde ser percorrida diretamente pela automação. A auditoria complementar foi feita sobre os oito arquivos que o usuário baixou e forneceu após autenticação; portanto, a cobertura restrita limita-se ao conteúdo desses arquivos.
- Alguns anexos hospedados no Google Drive exigiram sessão ou não renderizaram integralmente no acesso automatizado. Nesses casos foram usados o texto público da página institucional, a versão pública no SIG/IFFar ou a legislação oficial; o que não pôde ser confirmado foi sinalizado.
- O portal é uma orientação operacional. Em conflito de atualidade, prevalece a legislação compilada. A página de Progressão/Promoção ainda menciona a MP 1.286/2024 e informa que a Resolução Consup 104/2013 está em revisão.
- A análise do SEC-EBTT é estática e considera inclusive alterações locais ainda não consolidadas no repositório no momento da auditoria.
- Os dois arquivos chamados `1. REQUERIMENTO PARA ABERTURA DE PROCESSO.docx` e `1. REQUERIMENTO PARA ABERTURA DE PROCESSO (1).docx` são cópias binariamente idênticas; foram tratados como um único modelo documental.

## 3. Inventário da página inicial da CPPD

Fonte: [CPPD/IFFar — página inicial](https://sites.google.com/iffarroupilha.edu.br/cppd/in%C3%ADcio).

Processos encontrados: Progressão/Promoção; Promoção à Classe Titular; RSC; Ação de desenvolvimento em serviço. Os demais itens visíveis — Resoluções e INs, Tabela de Vencimentos, Sobre, Contatos e Reuniões — são áreas informativas, não novos tipos de processo.

## 4. Progressão e promoção na carreira EBTT

### Finalidade e regras públicas

É o desenvolvimento na carreira para o nível seguinte da mesma classe (progressão) ou para a classe seguinte (promoção). A orientação do IFFar exige avaliação de desempenho com **mínimo de 120 pontos** e permite abrir o pedido a partir do 60º dia anterior ao fim do interstício, se a pontuação já for suficiente.

Pela legislação federal compilada, a progressão dentro da classe exige 24 meses e desempenho aprovado; a promoção A1→B1 exige 36 meses; B4→C1, 24 meses; e a promoção a Titular, 24 meses no último nível, além dos requisitos próprios. Os efeitos financeiros decorrem da data de cumprimento de todos os requisitos.

### Documentos e fluxo

- requerimento de progressão ou de promoção;
- planilha de pontuação docente completa, convertida em PDF;
- documentos comprobatórios reunidos em arquivo único, ordenados e numerados conforme a planilha;
- tramitação digital e avaliação segundo a tabela institucional.

A orientação fornecida também determina o uso da nomenclatura de classes **A, B, C e D** a partir de 1º de janeiro de 2025 e apresenta a equivalência temporária da classificação Qualis usada pela Resolução 104/2013: A1→A1 (30), A2→A2 (25), B1→A3 (22), B2→A4 (19), B3→B1 (16), B4→B2 (13), B5→B3 (10), C→B4 (7) e Sem Qualis/C→4 pontos.

Fontes oficiais: [CPPD — Progressão/Promoção](https://sites.google.com/iffarroupilha.edu.br/cppd/orienta%C3%A7%C3%B5es-para-abertura-de-processos/progress%C3%A3o-promo%C3%A7%C3%A3o), [Lei 12.772/2012 compilada](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12772compilado.htm), [Lei 15.141/2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15141.htm), [Lei 15.367/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15367.htm) e [Resolução Consup 104/2013](https://drive.google.com/file/d/1g4vySJn6wKm7GsnOOHp8ENX6FBxojwIj/view?usp=drive_link).

### Cobertura do SEC-EBTT — **implementação atualizada em 28/09/2026**

O sistema implementa `PROGRESSAO` e `PROMOCAO`, as transições B1→B2→B3→B4, C1→C2→C3→C4, A1→B1, B4→C1 e C4→D1; valida interstício de 24 meses e, corretamente para A1→B1, 36 meses; bloqueia envio abaixo de 120 pontos; mantém tabela de pontuação, comprovantes, avaliação, parecer e histórico.

Lacunas: não há regra explícita para abertura antecipada limitada aos 60 dias; o empacotamento oficial em um único PDF numerado não é garantido, pois a aplicação trabalha com anexos por item; e a promoção a Titular é tratada como promoção comum, sem o rito especial descrito na seção seguinte. O modelo local `backend/templates/planilha-pontuacao.xlsx` ainda mostra os rótulos Qualis antigos A1, A2, B1–B5, C e Sem Qualis. As pontuações são as mesmas da tabela de equivalência, mas a interface não explica ao docente como converter a classificação Qualis nova, criando risco de seleção incorreta.

Evidências principais no código: `backend/prisma/schema.prisma` (`ProcessType`), `backend/src/service/processoService.ts` (mínimo de 120 pontos, transições e interstícios) e `frontend/src/app/docente/processos/abrir/Form.tsx` (movimentações permitidas).

## 5. Promoção à Classe Titular

### Finalidade, requisitos e regras públicas

É a promoção ao topo da carreira EBTT. Exige cumulativamente: 24 meses no último nível (atualmente C4), doutorado, avaliação de desempenho com pelo menos 120 pontos e aprovação de memorial descritivo ou tese acadêmica inédita. O processo pode ser aberto após 12 meses no último nível para antecipar a formação da comissão, mas os efeitos só surgem quando todos os requisitos forem cumpridos.

A comissão especial tem quatro doutores — um do IFFar e três externos — Titulares ou no último nível, preferencialmente da mesma área ou afim. O docente apresenta uma lista de sete nomes, pelo menos cinco externos e previamente cientes. Memorial ou tese requer aprovação de pelo menos 75% da comissão. A resolução também disciplina prazos de avaliação e recursos.

### Documentos

- requerimento dirigido ao reitor;
- diploma de doutorado, com reconhecimento no Brasil se obtido no exterior;
- formulário de avaliação de desempenho e respectivos comprovantes em arquivo único;
- memorial e comprovantes, ou tese inédita e declaração de originalidade;
- relação de sete docentes elegíveis para a comissão;
- arquivos em PDF e assinaturas digitais via SIPAC ou gov.br.

O formulário fornecido confirma que o requerimento deve identificar nome, SIAPE, campus, data de admissão, classe C nível 04, regime de trabalho e área de concurso, além de marcar **tese inédita** ou **memorial descritivo**. O modelo da comissão divide os sete indicados em **três externos titulares, dois externos suplentes, um interno titular e um interno suplente**; para cada nome exige titulação, instituição/campus, telefone, celular e e-mail.

Fontes oficiais: [CPPD — Promoção à Classe Titular](https://sites.google.com/iffarroupilha.edu.br/cppd/orienta%C3%A7%C3%B5es-para-abertura-de-processos/promo%C3%A7%C3%A3o-%C3%A0-classe-titular), [Resolução ad referendum Consup 11/2024 — texto integral](https://sig.iffarroupilha.edu.br/public/jsp/documentos/documento_visualizacao.jsf?idDoc=674879), [Resolução Consup 40/2024 — homologação](https://sig.iffarroupilha.edu.br/public/jsp/documentos/documento_visualizacao.jsf?idDoc=705464) e [Lei 12.772/2012 compilada](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12772compilado.htm). Cópias verificadas estão em `Documentacao/reference/regulamento-classe-titular-resolucao-11-2024.pdf` e `Documentacao/reference/homologacao-classe-titular-resolucao-40-2024.pdf`.

### Cobertura do SEC-EBTT — **Parcial**

A Classe Titular usa o processo-base comum com detalhe específico. A abertura valida C4 e 12 meses completos; a concessão aprovada exige 24 meses completos. O envio exige doutorado com diploma e memorial ou tese em PDF. A comissão final possui um presidente interno e três externos, registra quatro avaliações e exige pelo menos três votos favoráveis. O rito de reavaliação, defesa e recurso está modelado. A lista prévia 3+2+1+1, os anexos oficiais, a suspensão por férias/recessos e os metadados de assinatura ainda dependem de implementação e confirmação de escopo.

O texto integral agora foi confirmado. Prazo de 45 dias, reavaliação do memorial em dois dias úteis, defesa oral em 30 dias e recurso em dois dias úteis estão modelados. Permanecem pendentes a suspensão de prazos em férias/recessos e a geração das atas e formulários dos Anexos IV, V, VII, IX e X.

## 6. Reconhecimento de Saberes e Competências (RSC)

### Finalidade e elegibilidade

O RSC produz equivalência **exclusivamente para Retribuição por Titulação**: graduação + RSC-I equivale a especialização; especialização + RSC-II a mestrado; mestrado + RSC-III a doutorado. Não substitui titulação para promoção. Não há limite de vagas.

O pedido exige pelo menos 60 pontos totais, com no mínimo 36 no nível pretendido. Para novo nível, as atividades devem abranger no mínimo três anos posteriores à última concessão. O regulamento admite, em regra, atividades de até cinco anos antes do ingresso na carreira EBTT.

### Documentos e fluxo

- requerimento de RSC;
- memorial cronológico, com identificação e trajetória acadêmica, profissional e intelectual;
- formulário/planilha de pontuação assinado;
- comprovantes em arquivo eletrônico único, ordenados e numerados;
- protocolo na CGP e encaminhamento à CPPD;
- cadastro no SIMEC-RSC e solicitação à CPPD para liberação do acesso.

O memorial fornecido detalha os dados e seções esperados: nome, CPF, SIAPE, lotação, telefone, e-mail, data de efetivo exercício, nível pretendido e número de comprovantes; declaração de veracidade; termo de efetivo exercício; formação/titulação; atuação em ensino, pesquisa e extensão; produção; atividades administrativas; títulos, homenagens e prêmios; formulário de pontuação; e anexos listados e numerados.

A planilha oficial de avaliação tem seis abas protegidas. O avaliador preenche apenas os dados pessoais, as quantidades reconhecidas nos 82 critérios e as observações/justificativas. O parecer é montado automaticamente, deve ser exportado em PDF, assinado digitalmente e devolvido ao IFFar. Os dados requeridos incluem número do processo, nome, SIAPE, nível RSC, instituição e lotação do requerente; e nome, SIAPE, cidade da avaliação, instituição e lotação do avaliador.

A comissão especial tem quatro docentes EBTT, sendo três externos ao IFFar, sorteados do banco nacional no SIMEC. A aprovação exige ao menos três pareceres favoráveis. Cabe recurso à CPPD em até 45 dias, com nova comissão e sem novas provas, e recurso final à CPRSC em 10 dias.

Fontes oficiais: [CPPD — RSC](https://sites.google.com/iffarroupilha.edu.br/cppd/orienta%C3%A7%C3%B5es-para-abertura-de-processos/reconhecimento-de-saberes-e-compet%C3%AAncias), [Resolução Consup 24/2025](https://sig.iffarroupilha.edu.br/sigrh/downloadArquivo?idArquivo=2618005&key=0412fc858d07f1343f575b4c07b1df86), [Regulamento RSC 7/2025](https://sig.iffarroupilha.edu.br/sigrh/downloadArquivo?idArquivo=2618007&key=3f4caf626da5084845ee404b4d425429), [Resoluções Consup de 2025](https://www.iffarroupilha.edu.br/conselho-superior/documentos/item/41213-resolu%C3%A7%C3%B5es-do-consup-2025) e [Lei 12.772/2012 compilada](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12772compilado.htm).

### Cobertura do SEC-EBTT — **Parcial**

O módulo próprio cobre abertura, memorial, tabela oficial de 2025 com 82 critérios, pontuação e limites, mínimos 60/36, comprovantes, tramitação, quatro avaliadores com composição de um interno e três externos, aceite, pareceres individuais, resultado com três votos favoráveis e parecer consolidado. A referência SIMEC pode ser registrada.

A comparação automática entre `backend/scripts/official-rsc-criteria.ts` e a planilha fornecida confirmou os **82 códigos**, todos os fatores, pesos e quantidades máximas, sem divergência numérica. As únicas diferenças textuais são abreviações/capitalização de unidade nos itens 31, 32 e 44 e um ponto final no item 45. O cálculo do sistema também segue corretamente o art. 18, § 6º, do Regulamento 7/2025 ao arredondar o resultado final de **cada critério** antes da soma.

Há dois defeitos no arquivo oficial que não devem ser reproduzidos no sistema: na aba RSC I, os rótulos de totais das diretrizes IV a VII aparecem deslocados como itens V a VIII; e as fórmulas de cada critério não usam `ROUND`, embora exibam zero casas decimais. Como a pasta não ativa “precisão conforme exibida”, frações ocultas podem entrar nos subtotais. O código atual, que usa `Math.round` por critério, está alinhado ao regulamento e deve ser preservado.

Lacunas materiais remanescentes: os avaliadores são designados no sistema, sem sorteio/integração verificável com o banco nacional SIMEC; a referência SIMEC não é integração; não existe fluxo de recurso com nova comissão nem recurso final à CPRSC; e o sistema não força memorial e comprovantes em arquivo único numerado exatamente no formato oficial. A escolaridade, a janela de cinco anos, o intervalo de três anos, a composição 1+3 e a declaração de conflito já são validados.

Para reproduzir o parecer oficial, faltam ainda SIAPE e cidade/lotação completa do avaliador externo, contagem declarada de comprovantes, geração do parecer individual em PDF e registro/verificação da assinatura digital. Hoje o avaliador conclui o parecer apenas dentro do sistema. Relatório e comprovantes RSC já são restritos a PDF.

Evidências principais: `backend/scripts/official-rsc-criteria.ts`, `backend/scripts/seeds.ts`, `backend/src/service/processoService.ts`, `backend/src/service/individualEvaluationService.ts`, `backend/prisma/schema.prisma` e as telas de processos/avaliações em `frontend/src/app`.

## 7. Ação de desenvolvimento em serviço

### Finalidade e requisitos

Concede horas semanais, sem compensação, para participação em educação formal de graduação ou pós-graduação stricto sensu quando não caracterizado outro afastamento do Decreto 9.991/2019. Para jornada de 40 horas, a carga acadêmica somada ao deslocamento deve ser superior a 8 e limitada a 16 horas semanais.

Exige previsão no PDP, alinhamento ao cargo/unidade/função e demonstração de impossibilidade de compensação. Não se aplica a servidor em jornada flexibilizada de 30 horas, ocupante de cargo/função de confiança ou aluno especial. A autorização é semestral, com manifestação da chefia e, para docente, da CPPD.

### Documentos e continuidade

- formulário próprio e processo digital no SIPAC;
- matrícula regular com carga horária;
- matriz curricular;
- comprovação de reconhecimento do curso/programa por CAPES/CNE/MEC;
- horários acadêmicos, deslocamento e trabalho;
- manifestação favorável da chefia imediata;
- renovação semestral com matrícula/rematrícula, carga horária e horários.

Fontes oficiais: [CPPD — Ação de desenvolvimento em serviço](https://sites.google.com/iffarroupilha.edu.br/cppd/orienta%C3%A7%C3%B5es-para-abertura-de-processos/a%C3%A7%C3%A3o-de-desenvolvimento-em-servi%C3%A7o), [Gestão de Pessoas — procedimento completo](https://www.iffarroupilha.edu.br/gest%C3%A3o-de-pessoas/acao-desenvolvimento-servico), [Resolução Consup 8/2024](https://www.iffarroupilha.edu.br/component/k2/attachments/download/49805/4391270e427fd487df2db83f406e253f) e [Decreto 9.991/2019](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9991.htm).

### Cobertura do SEC-EBTT — **Ausente**

Não há enumeração de processo, modelo, rotas, regras ou telas específicas. Os tipos gerais do sistema continuam limitados a Progressão e Promoção, além do módulo separado de RSC.

## 8. Licença para Capacitação

### Finalidade e requisitos

Após cada quinquênio de efetivo exercício, permite até 90 dias remunerados para ação de desenvolvimento de interesse institucional, sem acumulação. A ação deve estar no PDP e ter carga equivalente mínima de 30 horas semanais. Pode ser parcelada em até seis períodos de no mínimo 15 dias, observado intervalo mínimo de 60 dias, e o limite simultâneo de 5% dos servidores da unidade. Não se aplica a servidor em estágio probatório.

São admitidos cursos presenciais ou a distância, elaboração de monografia/TCC/dissertação/tese, estudo de idioma no país ou exterior quando relevante ao trabalho, e curso conjugado com atividade prática ou voluntária. Afastamento superior a 30 dias implica exoneração/dispensa de cargo ou função de confiança nas hipóteses legais.

### Documentos e fluxo

- requerimento no SIPAC com antecedência mínima de 30 dias;
- conforme a modalidade: matrícula/aceite, instituição, datas, carga horária, conteúdo, declaração do orientador/supervisor, acordo de cooperação e plano de trabalho, declaração da entidade voluntária ou justificativa da chefia;
- CGP acrescenta extrato do PDP e verifica o quinquênio; CPPD/CIS emite parecer conforme a carreira;
- o servidor só se afasta após publicação do ato;
- em até 30 dias do retorno, apresenta certificado/equivalente, relatório quando cabível e trabalho concluído; descumprimento pode gerar ressarcimento.

Fontes oficiais: [IFFar — Licença para Capacitação](https://www.iffarroupilha.edu.br/licen%C3%A7a-para-capacita%C3%A7%C3%A3o), [IN IFFar 1/2023](https://www.iffarroupilha.edu.br/component/k2/attachments/download/49807/b84ab8620d8ef3a17a5d68e4b75f370d), [Lei 8.112/1990 compilada](https://www.planalto.gov.br/ccivil_03/leis/l8112compilado.htm) e [Decreto 9.991/2019](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9991.htm).

### Cobertura do SEC-EBTT — **Ausente**

Não foi encontrado fluxo específico, cálculo de quinquênio/saldo, limite simultâneo, parcelamento, PDP, documentos por modalidade, aprovação/publicação ou prestação de contas.

## 9. Retribuição por Titulação (RT)

### Finalidade e regras verificáveis

É vantagem remuneratória da carreira EBTT conforme o cargo, classe/nível e titulação comprovada, sem acumulação entre títulos. O RSC pode produzir equivalência para RT nos termos legais, mas não substitui título para promoção.

Fonte normativa segura: [Lei 12.772/2012 compilada, especialmente arts. 17 a 19](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12772compilado.htm). O [Manual do Servidor do IFFar](https://www.iffarroupilha.edu.br/gest%C3%A3o-de-pessoas/manual-do-servidor) marca o conteúdo de RT como **“em construção”**; a [página oficial de formulários](https://www.iffarroupilha.edu.br/gest%C3%A3o-de-pessoas/formul%C3%A1rios) lista um requerimento de RT, mas o arquivo/procedimento atualizado não ficou publicamente recuperável na auditoria.

### Conteúdo não verificável publicamente

Não foi possível confirmar, por fonte institucional pública atual e completa, a lista documental, autoridades, prazos, fluxo e tratamento de diplomas/certidões para o pedido de RT no IFFar. Esses itens devem ser confirmados com a CGP/CPPD; não foram preenchidos por suposição ou por fontes secundárias.

### Cobertura do SEC-EBTT — **Ausente**

O perfil docente registra escolaridade/titulação de modo genérico, e o RSC registra seu próprio resultado, mas não há pedido de RT, prova de título, validação, decisão, implantação financeira ou integração entre concessão de RSC e RT.

## 10. Prioridades de adequação

1. Separar Promoção à Classe Titular da promoção comum e implementar toda a comissão especial, documentos e recursos.
2. Completar o RSC com validação de titulação, regras temporais, banco/sorteio SIMEC, dados do parecer oficial, exportação/assinatura digital e recursos.
3. Preservar o núcleo de Progressão/Promoção e acrescentar janela de protocolo, conformidade documental e orientação Qualis atual; manter a regra legal vigente de 36 meses para A1→B1, apesar do texto genérico de 24 meses ainda visível na página operacional.
4. Criar fluxos próprios para Ação de desenvolvimento em serviço e Licença para Capacitação.
5. Só implementar RT após obter do IFFar a orientação institucional atualizada que a própria página pública ainda declara em construção.

## 11. Validação complementar com os arquivos fornecidos

Foram examinados os três PDFs das orientações de Progressão/Promoção, Classe Titular e RSC, os modelos de requerimento e indicação de membros, o memorial docente e a planilha oficial de avaliação do RSC. Os dois requerimentos anexados são idênticos. A planilha foi inspecionada em suas seis abas, incluindo fórmulas, células editáveis, validações, proteção e prévia visual completa.

Os arquivos complementares confirmaram as regras já descritas e permitiram validar os campos e a divisão titular/suplente das comissões. Não foram encontrados arquivos equivalentes para Ação de desenvolvimento em serviço, Licença para Capacitação ou Retribuição por Titulação; para esses processos permanece válida a auditoria baseada nas fontes oficiais públicas.

## 12. Conteúdo ainda não verificável

- A área restrita não foi percorrida integralmente; apenas os oito arquivos fornecidos pelo usuário foram auditados.
- Anexos de Drive não incluídos nesses oito arquivos e que exigiram autenticação não foram tratados como prova de conteúdo além do que a página institucional informa.
- O procedimento institucional detalhado e atualizado de RT não está publicamente completo.
- Não foram usados documentos antigos revogados como fundamento atual. Em especial, os materiais de RSC de 2014 devem ceder à Resolução Consup 24/2025 e ao Regulamento 7/2025; formulários antigos de “Aceleração da Promoção” exigem confirmação institucional, pois a base legal foi alterada.
# Nota de escopo

Esta auditoria preserva processos e procedimentos identificados nas fontes oficiais para fins de pesquisa. A decisão de escopo de 29/09/2026 limita o SEC-EBTT a Progressão/Promoção, RSC e Classe Titular. GECC, processos administrativos genéricos e integrações automáticas com sistemas externos são referências contextuais, não pendências obrigatórias.
