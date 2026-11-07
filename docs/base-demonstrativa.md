# Base demonstrativa para o orientador

Execute os comandos no diretório `backend`. O ambiente usa MySQL 8, Node.js e as dependências já instaladas do projeto.

## Comandos

| Comando | Comportamento |
|---|---|
| `npm run seeds` | Carrega a base de desenvolvimento existente: perfis, usuários básicos, campus, tipos e catálogos. Como antes, pode atualizar dados dessas contas e tabelas. |
| `npm run seed:demo` | Adiciona os cenários demonstrativos. Preserva contas, senhas, tabelas, processos e avaliações existentes. Não envia e-mails. |
| `npm run test:demo` | Cria e remove um banco temporário `TCC_DEMO_TEST_*`, sem limpar o banco TCC. Mantém relatórios em `tmp/demo-tests/` e `tmp/demo-validation.json`. |
| `npm run db:reset:demo` | Interrompe a aplicação do projeto, verifica backup restaurado e arquivos, limpa o banco local TCC e recria a demonstração. |

O reset aceita exclusivamente `localhost`, `127.0.0.1` ou `::1`, porta 3306 e banco `TCC`, sem parâmetros adicionais na conexão. Os utilitários MySQL são executados no contêiner Docker existente `database`; ele deve estar iniciado e publicar a porta 3306. No Windows, o Docker Desktop instalado no caminho padrão é detectado automaticamente; `DEMO_DOCKER_PATH` permite indicar outro executável.

O `.env` precisa manter `DATABASE_URL`, `CPF_ENCRYPTION_KEY` e as configurações de sessão válidas. `CPF_ENCRYPTION_KEY` deve ter pelo menos 32 caracteres. As variáveis `SEED_*_PASSWORD` já existentes continuam válidas. `SEED_DEMO_PASSWORD` define a senha inicial das novas contas, com padrão `Demo@123456`.

## Dados carregados

São 22 contas: administrador, CPPD Central, CPPD local, doze docentes requerentes, dois docentes avaliadores internos e cinco avaliadores externos. As contas básicas de docente e avaliador externo são reaproveitadas. Os cenários ficam no Campus Santa Maria, com comissão local vigente; Frederico Westphalen também permanece cadastrado.

São doze processos, três de cada tipo: Progressão, Promoção, RSC e Classe Titular. Cada tipo tem um rascunho, um enviado à CPPD e um com avaliação pendente. Nos dois processos de carreira, a análise foi iniciada e um item foi conferido. Nos processos avançados de RSC e Classe Titular, a comissão está ativa com um interno e três externos, aceites e declarações de ausência de conflito. Os avaliadores ainda precisam emitir seus pareceres.

Os processos RSC exemplificam RSC-I, RSC-II e RSC-III, respectivamente. A Classe Titular usa memorial, diploma de doutorado e sete indicados na composição 3+2+1+1. Os documentos fictícios exibem a identificação de demonstração; não há assinaturas simuladas nem decisões finais previamente aprovadas.

A pontuação de carreira usa o recorte da seed de desenvolvimento, sua fórmula de docência e os nove itens de equivalência Qualis já usados no material do projeto. Não é a transcrição integral da tabela institucional. O catálogo RSC contém os 82 critérios oficiais, com seus fatores, pesos, tetos e regra de 60 pontos totais e 36 no nível pretendido. Classe Titular usa avaliação de desempenho e pareceres, conforme o fluxo atual, sem inventar uma tabela adicional.

As datas são calculadas na primeira carga de cada cenário, com interstício completo e prazos de comissão futuros. A reexecução preserva essas datas e o trabalho do orientador. Para renovar prazos e voltar aos cenários iniciais, execute o reset.

## Guia e reexecução

O [manual ilustrado de uso](manual-uso/Manual_de_Uso_SEC_EBTT.pdf) reúne instruções por perfil, 32 capturas reais, os quatro tipos de processo, avaliações, recursos e as 22 credenciais iniciais. A [versão editável em Markdown](manual-uso/Manual_de_Uso_SEC_EBTT.md) e o [pacote com as imagens](manual-uso/Manual_SEC_EBTT_editavel.zip) ficam na mesma pasta. As capturas foram produzidas em uma cópia isolada; os cenários originais continuam pendentes. O guia gerado pela seed também aponta para o manual. Se os cenários ou as senhas mudarem, use o guia gerado para consultar os valores atuais.

Após a carga, consulte `backend/tmp/demo/GUIA-ORIENTADOR.md`. Ele contém CPF, senha inicial, perfil, número do processo, estado e próxima ação de cada cenário. O arquivo é gerado localmente e não aparece na tela de login. Se uma senha for alterada durante o teste, a seed não a redefine.

As referências `DEMO-*` e o evento `DEMO_SEED_READY` identificam os cenários. Processos já preparados, inclusive concluídos ou excluídos durante o teste, não são recriados. Uma carga interrompida no meio de um processo é sinalizada; use o reset para retornar à base inicial. Não remova essas referências de controle para tentar repetir um cenário.

## Backup e recuperação

Cada reset cria `backend/tmp/demo-backups/<data-e-identificador>/`, contendo:

- `TCC.sql`: cópia completa do banco antes da limpeza, inclusive histórico e migrações.
- `uploads/`: cópia conferida por SHA-256 de todos os arquivos anteriores.
- `VERIFICACAO.json`: contagens de todas as tabelas, inventário dos arquivos e confirmação da restauração verificada.
- `uploads-original/`: diretório anterior preservado quando a limpeza começa.

A conferência restaura o SQL em `TCC_DEMO_RESTORE_*`, compara contagens e conteúdo e remove esse banco temporário. Qualquer falha antes dessa confirmação cancela a limpeza. Se a recriação ou a seed falhar depois da limpeza, o comando restaura automaticamente o SQL e os uploads anteriores. O caminho do último backup fica em `backend/tmp/demo/ultimo-backup.txt`.

Para recuperação manual, mantenha a aplicação parada, recrie o banco TCC vazio, importe `TCC.sql` pelo cliente MySQL e restaure o conteúdo de `uploads/` em `backend/uploads/`. Preserve a chave `CPF_ENCRYPTION_KEY` correspondente aos dados. Não use `npm run seeds` durante a recuperação, pois ele pode atualizar as contas básicas restauradas.

Os backups e guias gerados ficam fora do versionamento. Guarde também a configuração de ambiente de forma privada; o backup SQL não inclui a chave de proteção dos CPFs.

## Preparação para hospedagem

1. Instale as dependências de backend e frontend, gere o cliente Prisma e execute os builds normais. Disponibilize as dependências já exigidas pelo sistema para conversão de documentos, incluindo LibreOffice quando necessário.
2. Configure um banco MySQL exclusivo para a demonstração, os endereços de frontend/backend e os segredos de sessão. Preserve exatamente a `CPF_ENCRYPTION_KEY` se copiar o banco local.
3. Aplique as migrações versionadas com `npm run migrate:deploy`. Para criar os exemplos diretamente nesse banco vazio, configure `DEMO_SEED_ENABLED=true` e execute `npm run seed:demo` com as dependências de desenvolvimento necessárias ao ts-node.
4. Alternativamente, exporte o banco local já demonstrativo e importe no banco hospedado vazio. Nessa opção, copie também os uploads e mantenha a mesma chave; o histórico das migrações acompanha o SQL.
5. Garanta armazenamento persistente e privado para `backend/uploads/`. Os arquivos devem continuar sendo acessados pelas rotas autenticadas. Não publique os backups, o `.env` ou o guia de credenciais no diretório servido pelo site.
6. Entregue ao orientador o endereço e o guia gerado no ambiente escolhido. Confira os logins, o acesso aos PDFs e as tarefas de avaliação após a publicação.

O comando de reset é exclusivo da preparação local e não é executado automaticamente ao iniciar ou publicar a aplicação. Esta entrega não publica o sistema.
