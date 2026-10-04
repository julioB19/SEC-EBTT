# Relatório do reteste visual no navegador

**Data:** 01/10/2026  
**Sistema:** SEC-EBTT local  
**Ambiente:** Chrome em sessão isolada, resolução de 1440 × 1000, frontend em `http://127.0.0.1:3000` e backend em `http://127.0.0.1:3333`.

## Objetivo

Repetir a conferência visual dos fluxos disponíveis, autenticando com os quatro perfis de teste e preservando os dados existentes. O ensaio foi somente de navegação e consulta: nenhum formulário de negócio foi enviado, nenhuma decisão foi refeita e nenhum registro foi excluído.

## Resultado executivo

O reteste foi aprovado na resolução avaliada:

- 21 páginas carregadas e 21 capturas geradas;
- autenticação concluída nos perfis Docente, CPPD Central, Administrador e Avaliador Externo;
- zero exceções JavaScript;
- zero requisições com falha;
- zero imagens quebradas;
- zero páginas com estouro horizontal;
- título `SEC-EBTT` presente nas 21 páginas.

## Matriz de execução

| Evidência | Perfil/área | Tela ou fluxo conferido | Resultado |
|---|---|---|---|
| `01-login.png` | Público | Entrada e autenticação | Aprovado |
| `02-docente-inicio.png` | Docente | Página inicial | Aprovado |
| `03-docente-processos.png` | Docente | Consulta de processos | Aprovado |
| `04-docente-abrir-processo.png` | Docente | Abertura e seleção do tipo de processo | Aprovado |
| `05-docente-processo-15.png` | Docente | Detalhe de RSC em rascunho | Aprovado |
| `06-docente-pontuacao-15.png` | Docente | Planilha e mínimo do RSC | Aprovado |
| `07-docente-processo-14.png` | Docente | Detalhe de processo RSC concluído | Aprovado |
| `08-cppd-inicio.png` | CPPD | Página inicial | Aprovado |
| `09-cppd-processos-pendentes.png` | CPPD | Processos pendentes | Aprovado |
| `10-cppd-processos-avaliados.png` | CPPD | Processos avaliados | Aprovado |
| `11-cppd-comissao-avaliada-14.png` | CPPD | Comissão concluída, portaria, parecer e decisão | Aprovado |
| `12-cppd-comissao-14.png` | CPPD | Reabertura da comissão pela rota operacional | Aprovado |
| `13-cppd-tabelas.png` | CPPD | Tabelas de pontuação | Aprovado |
| `14-cppd-docentes.png` | CPPD | Cadastro e consulta de docentes | Aprovado |
| `15-cppd-campi-comissoes.png` | CPPD | Campi e comissões locais | Aprovado |
| `16-admin-inicio.png` | Administrador | Página inicial | Aprovado |
| `17-admin-usuarios.png` | Administrador | Usuários | Aprovado |
| `18-admin-tabelas.png` | Administrador | Tabelas de pontuação | Aprovado |
| `19-admin-campi-comissoes.png` | Administrador | Campi e comissões | Aprovado |
| `20-avaliador-inicio.png` | Avaliador externo | Lista de avaliações e comissões concluídas | Aprovado |
| `21-avaliador-parecer-7.png` | Avaliador externo | Consulta de parecer enviado | Aprovado |

## Verificações funcionais e visuais críticas

1. A abertura de processo apresenta exatamente os quatro fluxos esperados: `Progressão`, `Promoção`, `RSC` e `Promoção à Classe Titular`.
2. A planilha do processo nº 15 identifica o tipo como `RSC` e informa o mínimo de `60,00 pontos`.
3. A planilha exibe os blocos RSC I, RSC II e RSC III, com fatores, pesos, limites, unidades e campos de quantidade.
4. A listagem de processos avaliados da CPPD usa a ação `Ver comissão` e direciona os processos nº 14 e nº 13 para suas rotas de comissão.
5. A comissão nº 14 apresenta estado concluído, portaria, membro externo, aceite, parecer, média reconhecida de 60,00 pontos e decisão da CPPD.
6. O módulo do avaliador informa que a comissão foi concluída e mantém o parecer disponível para consulta.
7. O parecer individual nº 7 permanece somente para consulta, com estado `Enviada`, documentos, pontuação reconhecida e observações.
8. Menus, cabeçalhos e títulos estão consistentes entre os quatro perfis.

## Evidências e dados técnicos

As evidências desta rodada estão na pasta `reteste-2026-10-01`:

- 21 arquivos PNG, numerados na ordem da execução;
- `relatorio-visual.json`, contendo URL, título, texto visível, campos, opções, botões, links, resolução, dimensões do documento, imagens quebradas, exceções e falhas de rede.

Capturas recomendadas para revisão rápida:

- `reteste-2026-10-01/04-docente-abrir-processo.png`;
- `reteste-2026-10-01/06-docente-pontuacao-15.png`;
- `reteste-2026-10-01/10-cppd-processos-avaliados.png`;
- `reteste-2026-10-01/11-cppd-comissao-avaliada-14.png`;
- `reteste-2026-10-01/20-avaliador-inicio.png`;
- `reteste-2026-10-01/21-avaliador-parecer-7.png`.

## Observação sobre a execução

O controlador visual integrado do Windows falhou em duas tentativas antes de abrir qualquer janela, com erro de aplicação de ACL do sandbox. O reteste foi então realizado em uma instância isolada do Chrome local por protocolo de depuração. Essa sessão usou a interface real do sistema, autenticação real nas contas locais, cookies, rotas e dados persistidos, e produziu capturas de tela integrais para auditoria.

## Conclusão

Não foram encontrados novos defeitos visuais ou regressões nos fluxos percorridos. Nenhum ajuste de código foi necessário nesta rodada. A aprovação se limita às páginas, aos estados de dados e à resolução registrados neste relatório; alterações destrutivas e novos envios de processos ficaram deliberadamente fora do reteste para preservar a base solicitada pelo usuário.
