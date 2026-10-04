# Qualidade e cobertura de testes

## Objetivo

O projeto exige pelo menos 80% de cobertura de linhas e instruções no núcleo regulatório. Esse núcleo concentra as decisões que podem alterar o resultado administrativo de RSC e de promoção à Classe Titular:

- composição, aceite e conclusão de comissão especial;
- avaliação individual e reconhecimento de pontuação;
- rito específico da Classe Titular;
- cálculo oficial do RSC;
- prazos procedimentais;
- geração do parecer individual em PDF.

O limite é executável e impede regressões: `npm run test:coverage` falha se linhas ou instruções ficarem abaixo de 80%, funções abaixo de 80% ou ramos abaixo de 60%.

## Camadas de teste

- Testes unitários verificam regras puras e serviços pelas interfaces públicas.
- Testes de integração iniciam a aplicação real, usam HTTP e um MySQL separado (`TCC_TEST`).
- O fluxo integrado cobre autenticação, autorização, abertura e edição de RSC, critérios oficiais, comprovantes PDF, submissão, análise CPPD, comissão de quatro membros, declaração de ausência de conflito, avaliações individuais, pareceres PDF, consolidação e decisão final.
- O banco principal `TCC` nunca é usado pela suíte de integração.

## Comandos

Na pasta `backend`:

```text
npm test
npm run test:unit
npm run test:db:setup
npm run test:integration -- --coverage=false
npm run test:coverage
npm run test:coverage:all
```

`test:coverage` é a barreira obrigatória de 80% do núcleo regulatório. `test:coverage:all` é um relatório diagnóstico de toda a aplicação, incluindo adaptadores HTTP, persistência e integrações externas; ele não substitui a barreira do núcleo.

## Banco de integração

A URL esperada pelos testes é:

```text
mysql://root:root123@localhost:3306/TCC_TEST
```

Antes da primeira execução, inicie o MySQL com `npm run db:up` e execute `npm run test:db:setup`. O comando cria somente o banco de teste, aplica todas as migrations e carrega o seed oficial. Ele recusa explicitamente uma URL cujo banco seja `TCC`. Os testes usam usuários temporários únicos e não alteram os dados do banco principal.

A URL pode ser substituída pela variável `TEST_DATABASE_URL` quando o ambiente de integração usar outro host ou credencial.
