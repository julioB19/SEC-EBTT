# Como testar manualmente o SEC-EBTT

## Ambiente local

1. Inicie o Docker Desktop.
2. No diretório `backend`, execute `npm run db:up`, `npm run migrate:deploy`, `npm run seeds` e `npm start`.
3. No diretório `frontend`, execute `npm run build` e `npm start`.
4. Abra `http://localhost:3000`.

## Contas de teste

| Perfil | CPF | Senha |
|---|---|---|
| Administrador | `81188057006` | `Admin@123456` |
| CPPD local | `51756662070` | `Cppd@123456` |
| CPPD Central | `58315013610` | `CppdCentral@123456` |
| Docente | `65033520008` | `Docente@123456` |
| Avaliador externo | `52998224725` | `Avaliador@123456` |

As contas são apenas dados locais de desenvolvimento.

## Conferir o cenário já salvo

1. Entre como docente e abra **Meus processos**.
2. Localize o processo **#14**, número externo `TESTE-MANUAL-RSC-2026-09-30`.
3. Confira RSC-III, tabela `Tabela oficial RSC IFFar 2025`, 60 pontos, relatório e quatro comprovantes PDF.
4. Entre como avaliador externo e confira a avaliação da comissão **#7**: 60 pontos, resultado `DEFERRED` e parecer enviado.
5. Entre como CPPD local e consulte os processos avaliados. O processo #14 deve estar `APPROVED`, com 60 pontos e decisão final registrada.

### Cenários finais preservados no banco `TCC_TEST`

A última execução automatizada de 01/10/2026 preservou os registros abaixo para auditoria direta do banco. Eles não aparecem na interface conectada ao banco principal `TCC`.

| Processo | Cenário | Estado final | Valor principal |
|---|---|---|---|
| #102 | RSC-I completo | `APPROVED` | 60 pontos |
| #103 | Progressão B1 → B2 | `APPROVED` | 160 pontos |
| #104 | Promoção B4 → C1 | `APPROVED` | 160 pontos |
| #105 | Classe Titular por memorial | `APPROVED` | rito `COMPLETED`, resultado `APPROVED` |
| #106 | Classe Titular por tese | `APPROVED` | defesa registrada, rito `COMPLETED` |
| #107 | Concorrência na comissão | `AWAITING_EVALUATOR_ACCEPTANCE` | uma única inclusão persistida; a duplicata simultânea foi rejeitada |

As contas temporárias desses testes são excluídas logicamente ao final, mas os processos, históricos, comissões, avaliações e arquivos relacionados permanecem salvos. Para preservar esses dados, não execute o comando de recriação do banco de testes.

## Criar um novo RSC

1. Entre como docente e abra um processo RSC.
2. Escolha RSC-I, II ou III e informe campus/cidade.
3. Informe ingresso na carreira, início/fim das atividades, eventual concessão anterior e aceite a declaração de veracidade.
4. Confirme que o sistema rejeita atividades iniciadas há mais de cinco anos antes do ingresso e, havendo concessão anterior, períodos menores que três anos.
5. Na pontuação, selecione um critério, anexe primeiro um PDF e informe uma quantidade inteira dentro do máximo mostrado.
6. Confirme que os pontos são calculados automaticamente e que o total da diretriz não ultrapassa seu teto.
7. Tente informar quantidade superior ao máximo; o sistema deve rejeitar e preservar o valor anterior.
8. Anexe o relatório/memorial em PDF.
9. O envio só deve ser aceito com pelo menos 60 pontos totais e 36 no nível pretendido.
10. Entre como CPPD, crie a comissão, informe portaria/data e adicione exatamente um avaliador interno e três externos titulares. Crie contas adicionais de teste no módulo administrativo quando necessário.
11. Entre em cada conta de avaliador; para aceitar, confirme a ausência de conflito. A recusa exige motivo. Volte à CPPD e ative a comissão.
12. Entre novamente como avaliador, reconheça as quantidades, escreva o parecer e envie.
13. Após o envio, use **Baixar parecer em PDF** e confirme processo, docente, resultado, pontuação, itens e fundamentação.
14. Na CPPD, conclua a comissão e registre a decisão final.

## Testar Progressão e Promoção

1. Use um docente cujo perfil funcional corresponda exatamente à classe de origem escolhida.
2. Abra Progressão B1 → B2 ou Promoção B4 → C1 e preencha o período de interstício.
3. Lance as quantidades na tabela, anexe os comprovantes e gere requerimento, planilha e PDF consolidado.
4. Envie o processo e confirme que o docente não consegue mais alterá-lo.
5. Na CPPD, inicie a análise, reconheça a pontuação, emita o parecer e finalize como aprovado.
6. Volte ao perfil funcional do docente e confirme a atualização para B2 ou C1.

## Testar Promoção à Classe Titular

1. Use um docente em C4, com doutorado e os períodos mínimos exigidos.
2. Abra o processo escolhendo memorial ou tese, anexe o PDF da modalidade e o diploma de doutorado.
3. Preencha a avaliação até o mínimo de 120 pontos e envie.
4. Na CPPD, forme a comissão com um presidente interno e três externos, registre portaria e aguarde todos os aceites sem conflito.
5. Na modalidade memorial, envie quatro pareceres; na modalidade tese, agende e registre também a defesa oral antes dos pareceres.
6. Conclua a comissão com pelo menos três votos favoráveis e registre a decisão final.
7. Confirme que o procedimento ficou `COMPLETED`/`APPROVED` e que o perfil funcional passou para D1.

## Regressões importantes

- RSC aceita somente PDF para relatório e comprovantes.
- O servidor ignora pontuação calculada pelo navegador e recalcula pela tabela oficial.
- O avaliador informa quantidade reconhecida, não pontos livres.
- O resultado individual do RSC é automático pela regra 60/36.
- Um processo enviado não pode ser editado pelo docente.
- Um avaliador não aceito não pode ler documentos do processo.
- A CPPD local deve ver apenas o campus autorizado; a CPPD Central pode ver todos.

## Observação

Os valores e arquivos dos processos #14 e #15 foram deliberadamente mantidos no banco principal, e os processos #102 a #107 foram preservados no `TCC_TEST`. Os arquivos permanecem em `backend/uploads`. As capturas da conferência visual estão em `Documentacao/testes/visual/final`. Não execute `docker compose down -v`, pois a opção `-v` remove o volume do banco.
