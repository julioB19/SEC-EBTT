# Relatório da conferência visual

**Data:** 01/10/2026  
**Ambiente:** aplicação local, Chrome em sessão isolada, resolução 1440 × 1000.

## Resultado final

Foram conferidas 21 telas com autenticação real nos perfis Docente, CPPD Central, Administrador e Avaliador Externo. O conjunto definitivo está na subpasta `final`, acompanhado do arquivo `relatorio-visual.json` com URL, título, textos, campos, botões, links e métricas de cada página.

Resultado da última execução:

- 21 páginas carregadas;
- zero exceções JavaScript;
- zero falhas de requisição;
- zero imagens quebradas;
- zero páginas com estouro horizontal na resolução testada;
- título `SEC-EBTT` em todas as páginas;
- nenhum formulário de negócio foi enviado e nenhum dado preservado foi apagado.

## Perfis e áreas conferidas

- Docente: início, listagem, abertura com os quatro tipos, detalhe RSC em rascunho, pontuação RSC e detalhe aprovado.
- CPPD: início, processos pendentes e avaliados, comissão concluída, tabela vigente, docentes, campi e comissões.
- Administrador: início, usuários, tabelas de pontuação, campi e comissões.
- Avaliador externo: lista de avaliações e parecer individual enviado.

## Correções feitas durante a conferência

1. O frontend estava executando um build antigo; foi recompilado e reiniciado.
2. A tela do avaliador dizia que uma comissão concluída ainda aguardava portaria; agora informa que o parecer permanece disponível para consulta.
3. Processos RSC e Classe Titular avaliados apontavam para a visualização de carreira; agora apontam para a comissão correspondente.
4. A pontuação do RSC aparecia como `Promoção` e exigia visualmente 120 pontos; agora mostra `RSC` e mínimo de 60 pontos.
5. A nomenclatura visível passou a usar `Promoção à Classe Titular`.
6. A página inicial da CPPD passou a mencionar os quatro fluxos do sistema.
7. Os metadados padrão `Create Next App` foram substituídos por `SEC-EBTT`.

## Evidências principais

- `final/04-docente-abrir-processo.png` — seleção dos quatro processos.
- `final/06-docente-pontuacao-15.png` — RSC e mínimo de 60 pontos.
- `final/10-cppd-processos-avaliados.png` — processos RSC avaliados com ação `Ver comissão`.
- `final/11-cppd-comissao-avaliada-14.png` — comissão, portaria, parecer e decisão.
- `final/20-avaliador-inicio.png` — estado correto da comissão concluída.
- `final/21-avaliador-parecer-7.png` — avaliação individual enviada e pontuação reconhecida.

O controlador visual integrado do Windows falhou duas vezes antes de obter qualquer janela com `apply deny-read ACLs`. A conferência foi então executada no Chrome local por protocolo de depuração, usando a mesma aplicação, contas, cookies, rotas e dados apresentados ao usuário.
