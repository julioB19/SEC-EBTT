# Checklist de adequação do SEC-EBTT às especificações da CPPD

**Atualizado em:** 01/10/2026  
**Fontes:** regulamentos e formulários preservados em `Documentacao/reference`, formulário oficial de RSC, código local, banco MySQL local e testes executados.

Legenda: `[x]` implementado e verificado; `[ ]` pendente; `[?]` depende de confirmação institucional ou do escopo do TCC.

## 1. Escopo do produto

- [x] Manter somente Progressão, Promoção, RSC e Promoção à Classe Titular.
- [x] Manter GECC, processos administrativos genéricos e integrações automáticas SIPAC/SIMEC fora do escopo.
- [x] Preservar Progressão/Promoção ao adicionar RSC e Classe Titular.
- [x] Usar um processo-base comum e detalhes próprios para RSC e Classe Titular, sem exigir campos de interstício de Progressão/Promoção no RSC.

## 2. RSC — pontuação oficial

- [x] Carregar a tabela `Tabela oficial RSC IFFar 2025` com vigência e finalidade RSC.
- [x] Cadastrar os **82 critérios oficiais**: 37 de RSC-I, 16 de RSC-II e 29 de RSC-III.
- [x] Cadastrar sete diretrizes por nível e os respectivos tetos, totalizando 100 pontos por nível.
- [x] Calcular no servidor `quantidade × ponto-base × fator × peso`.
- [x] Arredondar o resultado de cada critério antes da soma.
- [x] Aplicar o teto de cada diretriz e de cada nível.
- [x] Impedir quantidade fracionária, negativa ou superior ao máximo oficial.
- [x] Ignorar pontuação digitada pelo cliente e recalcular no servidor.
- [x] Exigir no mínimo 60 pontos totais e 36 pontos no nível pretendido.
- [x] Exigir comprovante PDF para todo critério pontuado no RSC.
- [x] Exigir relatório/memorial PDF antes do envio.
- [x] Registrar quantidade reconhecida pelo avaliador e recalcular o parecer individual pela mesma fórmula.
- [x] Determinar automaticamente `DEFERRED`/`DENIED` pela regra 60/36.
- [x] Preservar no banco a tabela temporária antiga como inativa, sem vinculá-la a novos processos.

## 3. RSC — processo, comissão e documentos

- [x] Abrir, listar, consultar, editar e excluir logicamente rascunhos RSC.
- [x] Selecionar RSC-I, RSC-II ou RSC-III.
- [x] Submeter à CPPD, criar comissão, convidar avaliador, registrar aceite/recusa, portaria e prazo de 45 dias.
- [x] Ocultar a avaliação e os documentos antes do aceite do convite.
- [x] Salvar rascunho, enviar avaliação individual, consolidar resultados e registrar decisão da CPPD.
- [x] Bloquear o requerente como avaliador do próprio processo.
- [x] Validar titulação habilitante para cada nível solicitado.
- [x] Registrar ingresso na carreira EBTT e limitar atividades anteriores à janela regulamentar de cinco anos.
- [x] Registrar concessões anteriores e exigir três anos de atividades para novo nível.
- [x] Exigir exatamente quatro membros no RSC: um interno e três externos titulares.
- [x] Registrar declaração de ausência de conflito e justificativa auditável de recusa/impedimento.
- [x] Gerar parecer individual em PDF após o envio da avaliação.
- [ ] Gerar parecer consolidado em PDF no modelo oficial.
- [ ] Registrar arquivo assinado, signatário, data, origem e hash SHA-256 do parecer.
- [ ] Implementar recurso à CPPD e recurso final à CPRSC somente se estes fluxos fizerem parte do escopo aprovado do TCC.
- [?] Confirmar com orientador/CPPD quais itens normativos acima pertencem ao MVP acadêmico.

## 4. Progressão e Promoção

- [x] Manter abertura, pontuação, comprovantes, requerimento, submissão e análise da CPPD.
- [x] Manter as transições válidas de Progressão/Promoção e as regras de interstício existentes.
- [x] Gerar planilha de pontuação em PDF e PDF consolidado de comprovantes.
- [x] Preservar os testes existentes após a inclusão da tabela oficial do RSC.
- [x] Validar por integração HTTP os ciclos completos de Progressão e Promoção, incluindo perfil funcional, pontuação, comprovantes, downloads, autorização, decisão e atualização de classe.

## 5. Promoção à Classe Titular

- [x] Manter categoria e detalhes próprios, separados da Promoção comum.
- [x] Permitir escolha entre memorial e tese.
- [x] Exigir PDF correspondente à modalidade e cadastro do doutorado com diploma.
- [x] Exigir tabela de avaliação com mínimo de 120 pontos para envio.
- [x] Exigir comissão final com um presidente interno e três membros externos.
- [x] Exigir quatro avaliações e aplicar aprovação mínima de três votos favoráveis.
- [x] Controlar prazo de 45 dias, reavaliação do memorial, defesa oral e recurso do rito já modelado.
- [x] Validar automaticamente C4 e as janelas de 12/24 meses previstas no regulamento.
- [x] Validar por integração HTTP o ciclo completo nas modalidades memorial e tese, incluindo comissão, quatro pareceres, sessão de defesa e atualização final para D1.
- [ ] Modelar e validar a lista inicial de sete indicados (3+2+1+1), se mantida no escopo do TCC.
- [ ] Registrar pareceres assinados em PDF com metadados e hash.
- [ ] Suspender prazos durante férias e recessos acadêmicos.
- [ ] Gerar os formulários e atas dos Anexos IV, V, VII, IX e X.
- [?] Confirmar quais anexos precisam ser gerados pelo sistema e quais apenas serão enviados como documentos externos.

## 6. Segurança, consistência e qualidade

- [x] Autorizar operações pelo perfil atualmente selecionado.
- [x] Isolar o acesso da CPPD local por campus e permitir escopo global à CPPD Central.
- [x] Proteger downloads de documentos e evidências por autenticação/autorização.
- [x] Converter valores `BigInt` antes da resposta JSON, evitando erro ao listar processos com arquivos anexados.
- [x] Aplicar as 21 migrations no MySQL local.
- [x] Executar `prisma format`, `prisma generate`, build, lint do backend e build/typecheck do frontend.
- [x] Conferir visualmente 21 telas dos quatro perfis, sem erros JavaScript, falhas de requisição, imagens quebradas ou estouro horizontal, com evidências em `Documentacao/testes/visual/final`.
- [x] Aprovar 30 suítes e 179 testes automatizados após as validações de RSC, carreira, Classe Titular e administração.
- [x] Criar testes de integração com MySQL e migrations em banco isolado `TCC_TEST`.
- [x] Criar teste automatizado ponta a ponta do RSC para docente, CPPD e quatro avaliadores.
- [x] Criar teste concorrente para formação/alteração de comissão e devolver erro de negócio, sem resposta 500, ao segundo cadastro simultâneo.
- [x] Aplicar barreira mínima de 80% ao núcleo regulatório: 88,01% de linhas/instruções, 98,14% de funções e 68,24% de ramos.
- [x] Aplicar barreira mínima de 80% ao backend inteiro: 80,10% de linhas/instruções, 94,32% de funções e 62,58% de ramos.

## 7. Teste manual preservado no banco

- [x] Processo RSC **#14**, identificado como `TESTE-MANUAL-RSC-2026-09-30`.
- [x] Processo RSC **#15**, identificado como `TESTE-RSC-ELEGIBILIDADE-2026-09-30`, preservando ingresso, período e declaração de veracidade.
- [x] Nível pretendido RSC-III e tabela oficial **#6**.
- [x] Quatro critérios preenchidos com 60 pontos no RSC-III e comprovantes PDF salvos.
- [x] Quantidade acima do máximo rejeitada sem alterar o valor anterior.
- [x] Relatório PDF anexado e processo enviado à CPPD.
- [x] Comissão histórica **#7**, criada com um avaliador antes da correção da composição; novos fluxos exigem 1 interno + 3 externos.
- [x] Avaliação **#7** enviada com 60 pontos e resultado automático `DEFERRED`.
- [x] Comissão concluída e processo finalizado como `APPROVED`, com 60 pontos e parecer textual preservado.

## 8. Próximas decisões, sem ampliar escopo

Os itens de implementação e qualidade confirmados para esta etapa estão concluídos. Antes de novo desenvolvimento, confirmar com o orientador/CPPD se entram no escopo acadêmico: parecer consolidado e assinatura/hash, recursos do RSC, lista inicial de sete indicados, suspensão de prazos e geração automática dos anexos da Classe Titular.
