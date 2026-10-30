# Testes de navegador — SEC-EBTT

Data: 17/10/2026. Escopo: Progressão, Promoção, RSC e Classe Titular.

Foram aprovados 31 cenários após as correções e os retestes. Os perfis Docente, CPPD, Avaliador e Administrador foram exercitados no navegador. A regressão complementar aprovou 220 testes em 36 suítes; cobertura de linhas/instruções de 81,37%, funções de 94,14% e ramos de 64,04%. Compilação e lint do backend e build de produção do frontend aprovados.

## Ambiente e alcance

Aplicação local de teste nas portas 3100 e 3340, com MySQL Docker isolado na porta 3307 e banco TCC_AUDIT. Contas, documentos e decisões usados nesta rodada são sintéticos. Os testes de navegador não alteraram os usuários ou processos do banco principal TCC.

O ciclo completo de Progressão foi executado pela interface: abertura, lançamento de itens e comprovante, envio, reconhecimento pela CPPD, geração e atualização do parecer, deferimento e consulta posterior. O cálculo conferido resultou em 160 pontos, interstício de 01/01/2024 a 31/12/2025 e efeitos financeiros em 01/01/2026.

Nos outros processos, foram exercitados abertura, edição, limites e documentação conforme os cenários abaixo. Esta rodada não equivale à execução integral de todas as variações de Promoção, RSC e Classe Titular pelo navegador. Os fluxos HTTP completos e regras adicionais estão cobertos pela regressão automatizada.

As contas de teste, diplomas reutilizáveis e uma atribuição histórica de avaliador foram preparados diretamente no banco isolado para viabilizar os cenários. O upload de comprovantes, o download do requerimento e as ações de processo descritas como testes de navegador ocorreram pela interface real. Nenhuma assinatura institucional foi produzida ou enviada a sistemas externos.

## Falhas corrigidas e retestadas

1. Datas civis recuavam um dia nas telas da CPPD, nos textos gerados e nas vigências de tabelas. A formatação agora preserva o dia cadastrado.
2. A prévia do parecer podia manter uma data financeira desatualizada. A prévia recebe a data de cumprimento dos requisitos; a conclusão preserva o interstício real e registra a data financeira calculada pelo servidor, inclusive quando há texto personalizado.
3. A biblioteca de diplomas não tinha acesso pelo caminho “Meu perfil”. Foi incluída a ligação na página de perfil do docente.
4. Selecionar um diploma reutilizável não atualizava imediatamente os dados exibidos no processo. Os detalhes agora são atualizados após a seleção, sem recarregar a página.

Não restaram falhas bloqueantes observadas nos cenários executados. Há uma melhoria textual de baixa prioridade: a listagem da CPPD ainda apresenta alguns nomes de tipos em inglês, embora as telas de detalhe apresentem o nome em português.

## Checklist executado

| Nº | Cenário | Resultado |
|---|---|---|
| 1 | Login inválido bloqueado e login válido | aprovado |
| 2 | Abertura Progressão B1→B2 | aprovado |
| 3 | Pontuação, anexo, reutilização e cálculo 160 pontos | aprovado |
| 4 | Equivalência Qualis exibida | aprovado |
| 5 | Progressão enviada e edição bloqueada | aprovado |
| 6 | Download do requerimento no navegador | aprovado |
| 7 | Docente bloqueado em administração | aprovado |
| 8 | CPPD avalia quatro itens e libera parecer | aprovado |
| 9 | Datas do interstício na CPPD e no parecer | corrigido e aprovado no reteste |
| 10 | Ciclo completo de Progressão no navegador e data financeira 01/01/2026 | aprovado |
| 11 | Calendário rejeita intervalo inválido e salva período válido | aprovado |
| 12 | Modelo versão 2 preserva versão 1 como histórico | aprovado |
| 13 | Abertura Promoção B4→C1 e envio bloqueado abaixo do mínimo | aprovado |
| 14 | Edição de rascunho de Promoção | aprovado |
| 15 | RSC rejeita período fora dos cinco anos e abre no limite válido | aprovado |
| 16 | Referências SIMEC e auditoria do RSC | aprovado |
| 17 | RSC bloqueia 101 unidades em critério limitado a 100 | aprovado |
| 18 | Promoção comum não oferece C4→D1 | aprovado |
| 19 | Abertura Classe Titular por tese com formulário próprio | aprovado |
| 20 | Ineditismo registrado e sete indicados com validação de ciência | aprovado |
| 21 | Envio de PDF de desempenho e acesso privado pelo processo | aprovado |
| 22 | Biblioteca e seleção de diploma reutilizável | aprovado; atualização imediata corrigida e retestada |
| 23 | Tela estreita e menu móvel sem rolagem horizontal | aprovado |
| 24 | Acesso à biblioteca pelo menu Meu perfil | corrigido e aprovado no reteste |
| 25 | Avaliador consulta parecer, evidências e resultado enviado sem poder editar | aprovado |
| 26 | Avaliador bloqueado no módulo Docente | aprovado |
| 27 | Conta com dois perfis: seleção e bloqueio da API Docente quando Avaliador está ativo | aprovado |
| 28 | Vigência de tabelas no Administrador e CPPD | corrigido e aprovado nos retestes do Administrador e da CPPD |
| 29 | Administrador acessa tabelas e pesquisa usuários | aprovado |
| 30 | URL pública de comprovante existente devolve Not Found | aprovado |
| 31 | Consulta da avaliação finalizada preserva interstício e data financeira | aprovado |

## Evidências

- [Consulta do parecer finalizado](23-consulta-parecer-datas-corretas.png)
- [Parecer corrigido e deferimento](06-parecer-corrigido-finalizado.png)
- [Classe Titular em tela de celular](13-titular-celular.png)
- [Biblioteca acessível pelo perfil](20-biblioteca-acessivel-pelo-menu.png)
- [Diploma atualiza os detalhes imediatamente](21-diploma-atualizacao-imediata.png)
- [Vigência corrigida na CPPD](22-vigencia-cppd-corrigida.png)
- [Todos os resultados em JSON](results.json)

As capturas mostram dados sintéticos. O console da página de consulta final não apresentou erros ou avisos na leitura efetuada; isso não representa uma auditoria global de todas as mensagens de console da aplicação.
