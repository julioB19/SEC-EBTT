# Conclusão do checklist do SEC-EBTT

Atualização: 17/10/2026. Escopo confirmado: Progressão, Promoção, RSC e Promoção à Classe Titular.

## Resultado por processo

| Processo | Implementação e verificação |
| --- | --- |
| Progressão | Preparação limitada à janela de 60 dias, origem funcional compatível, interstício completo para deferimento, mínimo de 120 pontos reconhecidos, planilha, dossiê e decisão da CPPD. A data financeira respeita o cumprimento de todos os requisitos. |
| Promoção | Mesmos controles de carreira, incluindo 36 meses para A1→B1 e 24 meses nas demais movimentações permitidas. C4→D1 exige o processo próprio de Classe Titular. |
| RSC | Critérios oficiais e regra 60/36, comissão com um interno e três externos, quatro pareceres e três votos favoráveis para deferimento. Requerimento, planilha própria, dossiê com memorial, parecer consolidado e documentos assinados. Recursos à CPPD e CPRSC com preservação das provas e da comissão anterior. |
| Classe Titular | C4 e janelas de 12/24 meses, desempenho mínimo de 120 pontos conferido pela CPPD, diploma próprio com reconhecimento nacional quando estrangeiro, sete indicados qualificados na composição 3+2+1+1, memorial ou tese e declaração de ineditismo. Comissão, defesa, reavaliação, recurso, documentos e cálculo dos efeitos financeiros. |

## Controles compartilhados

- Arquivos privados, disponibilizados por rotas autenticadas e autorizadas. A URL pública de uploads responde 404.
- Operações condicionadas ao perfil selecionado e ao vínculo do usuário com o processo; CPPD local limitada ao campus.
- Tabelas ativas protegidas contra alteração e retorno a rascunho. Versões e vigências preservadas.
- Feriados, férias e recessos cadastráveis, com aplicação aos prazos pertinentes.
- Biblioteca de titulações e PDFs reutilizáveis. A substituição de documentos preserva versões e invalida a conferência anterior quando necessário.
- PDFs assinados com tipo, versão, signatário, plataforma, data, hash SHA-256 e conferência administrativa da CPPD.
- Auditoria de pontuação, evidências, pareceres, documentos, recursos e versões de modelos.
- Administração de modelos complementares e documentos obrigatórios por versão do tipo de processo.
- Orientação de equivalência Qualis na tela de pontuação e referências manuais SIPAC/SIMEC.

## Como usar as funções acrescentadas

1. **Administrador ou CPPD Central:** abrir “Calendário e documentos”; cadastrar períodos do calendário institucional, versões dos modelos e documentos exigidos. Para alterar exigências de um tipo já utilizado, criar sua próxima versão.
2. **Docente:** cadastrar diplomas em “Meu perfil”. Para diploma estrangeiro, informar o país e anexar o reconhecimento nacional. Na Classe Titular, selecionar o doutorado, informar o desempenho, preencher os sete indicados e declarar o ineditismo quando a modalidade for tese.
3. **CPPD:** na página da comissão, conferir desempenho, doutorado e indicados antes da ativação. Gerar os pareceres e atas na etapa correspondente.
4. **Avaliadores:** aceitar o convite com declaração de ausência de conflito, avaliar os itens e emitir seu parecer individual. A CPPD também pode registrar o PDF assinado recebido pelo procedimento institucional.
5. **Assinaturas:** assinar os PDFs na plataforma institucional e reenviá-los. A CPPD registra sua conferência. Na decisão, o sistema exige as versões pertinentes validadas dos pareceres e, na Classe Titular, dos documentos específicos da modalidade.
6. **Recursos RSC:** o docente encontra o formulário no processo indeferido. O recurso à CPPD tem prazo de 45 dias e exige nova comissão com membros diferentes. Persistindo o indeferimento, o recurso final à CPRSC tem prazo de dez dias. A CPPD Central registra o ato externo com seu PDF conferido.

## Verificação técnica

- 36 suítes e 220 testes aprovados.
- Cobertura integral: 81,30% de linhas/instruções, 94,13% de funções e 64,08% de ramos.
- Cobertura do núcleo regulatório: 88,18% de linhas/instruções, 98,24% de funções e 70,62% de ramos.
- Limites de cobertura mantidos: 80% para linhas, instruções e funções; 60% para ramos.
- Build e lint do backend aprovados. Build de produção e tipos do frontend aprovados.
- 23 migrações aplicadas e verificadas no banco isolado.

Os testes de integração usam o banco separado `TCC_AUDIT`, em MySQL Docker na porta 3307. Os dados sintéticos e as assinaturas de teste não são copiados ao banco principal. Foram exercitados os ciclos completos dos quatro processos, as duas modalidades de Titular, os dois recursos RSC, os controles de perfis, diplomas estrangeiros, versões administrativas e concorrência na composição da comissão.

A conferência visual incluiu entrada, administração de calendário e modelos, biblioteca de titulações e acompanhamento da Classe Titular. PDFs de parecer consolidado, parecer prévio, ata, planilha RSC e dossiê foram renderizados; o dossiê preserva índice, separadores e numeração global.

O repositório original foi atualizado após conferência dos hashes e preservação de cópias dos arquivos anteriores. O cliente Prisma foi regenerado e as 23 migrações estão aplicadas no banco local TCC. A atualização preservou os sete usuários e os cinco processos existentes, sem executar seeds. Um backup SQL local de 103.809 bytes foi salvo antes da aplicação. Build e lint do backend e build de produção Turbopack do frontend também passaram na instalação original.

## Decisões de escopo e operação

- Mantida autenticação por CPF e senha, conforme RF-GER-01 de `requisitos-completos-sec-ebtt.md`. Login Google não é requisito desta entrega.
- GECC, Licença, RT e Desenvolvimento em Serviço permanecem fora desta execução por decisão do usuário.
- SIPAC/SIMEC são referências manuais. O sistema não envia processos nem consulta sorteios automaticamente nesses serviços.
- A assinatura é realizada fora do SEC-EBTT. O hash protege a integridade do arquivo recebido; a aprovação registrada pela CPPD é uma conferência administrativa, sem substituir a validação criptográfica da plataforma de assinatura.
- Os textos gerados contêm os campos e conteúdos dos procedimentos implementados. A administração pode complementar os modelos; a diagramação não reproduz integralmente cada DOCX institucional.
- O calendário depende do cadastramento das datas institucionais reais. Não foram inventados feriados ou períodos de férias do IFFar.
- Processos históricos concluídos são preservados; as novas exigências não reescrevem suas decisões anteriores.

## Referências de implementação

O checklist atualizado está em `checklist-adequacao-cppd.md`. Os regulamentos e formulários consultados permanecem em `Documentacao/reference`, sem alteração de conteúdo. A auditoria anterior é um registro histórico do estado observado antes desta conclusão.
