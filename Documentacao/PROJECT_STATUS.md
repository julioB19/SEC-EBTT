# SEC-EBTT — estado atual e pendências

**Última revisão:** 01/10/2026

## Estado comprovado

O sistema local possui os quatro fluxos definidos para o produto: Progressão, Promoção, RSC e Promoção à Classe Titular. GECC, processos administrativos genéricos e integrações automáticas externas permanecem fora do escopo.

A tabela oficial de RSC IFFar 2025 está ativa no banco como tabela **#6**, com **82 critérios** (37/16/29), sete diretrizes por nível, fatores, pesos, quantidades máximas e tetos oficiais. A pontuação é calculada no servidor, com arredondamento por critério, e a submissão/avaliação exige 60 pontos totais e 36 no nível pretendido.

O fluxo manual completo foi executado e preservado no banco no processo **#14**: abertura pelo docente, relatório e comprovantes PDF, 60 pontos no RSC-III, envio à CPPD, comissão, aceite, avaliação individual, consolidação e decisão final aprovada.

O processo **#15** preserva o novo cenário de elegibilidade RSC-I: ingresso em 01/01/2018, atividades desde 01/01/2013 (limite exato de cinco anos), fim em 30/09/2026 e declaração de veracidade. Antes dele, a API recusou corretamente um início em 31/12/2012.

Durante o teste foi corrigida a serialização de `BigInt` nas respostas da API. Antes da correção, a fila da CPPD falhava ao listar um processo que continha arquivo com `sizeBytes`; há teste de regressão para esse caso.

## Validações executadas

- Prisma formatado e cliente regenerado.
- 21 migrations aplicadas; banco MySQL atualizado.
- Backend compilado e lint aprovado.
- Frontend compilado e verificação de tipos aprovada; o projeto não possui script de lint próprio.
- 30 suítes e 179 testes automatizados aprovados.
- Fluxos RSC, Progressão, Promoção e Classe Titular (memorial e tese) validados pelas rotas reais da aplicação e pelo banco isolado `TCC_TEST`.
- Concorrência na formação de comissão validada, sem duplicidade persistida e sem resposta 500.
- Cobertura do núcleo regulatório protegida por barreira automática: 88,01% de linhas/instruções, 98,14% de funções e 68,24% de ramos.
- Cobertura integral do backend protegida por barreira automática: 80,10% de linhas/instruções, 94,32% de funções e 62,58% de ramos.
- Conferência visual concluída em 21 telas dos perfis Docente, CPPD, Administrador e Avaliador Externo; nenhuma exceção JavaScript, falha de requisição, imagem quebrada ou estouro horizontal permaneceu. Evidências em `Documentacao/testes/visual/final`.

## Itens que dependem de confirmação de escopo

- Parecer consolidado em PDF e metadados de assinatura/hash; o parecer individual em PDF já é gerado e foi validado visualmente.
- Recursos de RSC, caso façam parte do escopo aprovado.
- Lista de sete indicados, suspensão de prazos e anexos oficiais da Classe Titular, apenas se confirmados no escopo do TCC.

O detalhamento e a distinção entre implementado, pendente e dependente de validação institucional estão em `checklist-adequacao-cppd.md`.
