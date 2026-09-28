# SEC-EBTT - Status, validações e backlog

Última revisão: 14/09/2026

Este arquivo separa os requisitos que dependem de validação institucional das funcionalidades que ainda precisam ser desenvolvidas. A referência funcional é o documento `Documento_Requisitos_CPPD_RSC_Titular` no Google Drive.

## 1. Funcionalidades implementadas

- Cadastro de usuários com múltiplos papéis, incluindo docente, membro da CPPD e avaliador externo.
- Convite por e-mail e definição da senha no primeiro acesso do avaliador externo.
- Cadastro e edição de perfil docente.
- Abertura dos processos de progressão/promoção, RSC e Classe Titular.
- Upload de documentos específicos de RSC e Classe Titular.
- Tabelas de pontuação versionadas, com finalidade, vigência, limite, peso, fator e pontuação mínima.
- Pontuação do docente, anexação e reutilização de comprovantes.
- Avaliação da CPPD para progressão/promoção e geração dos documentos já existentes nesse fluxo.
- Comissão especial de RSC e Classe Titular, com membros internos/externos, aceite ou recusa, portaria e ativação.
- Avaliação individual do avaliador externo, com rascunho, documentos, pontuação reconhecida, parecer e envio definitivo.
- Consolidação das avaliações e decisão institucional da CPPD.
- Organizador GECC com interessados, documentos, checklist PDF e registro manual do envio à CGP.
- Histórico de mudanças de status e bloqueio de edição conforme a etapa do processo.
- Modelagem das entidades Campus, Person, TeacherDegree, ProcessTypeConfig, DocumentTemplate, CppdCommission, SpecialCommission, IndividualEvaluation e ProcessGecc.
- Perfil CPPD Central reconhecido no login, na troca de módulo, no cadastro de usuários e nas rotas institucionais.
- Escopo da CPPD local derivado do vínculo ativo entre pessoa, comissão vigente e campus.
- Isolamento por campus nas listas e nos detalhes de processos, avaliações, comissões especiais, GECC e docentes.
- Proteção das rotas administrativas de tabelas de pontuação para ADMIN ou CPPD Central.
- CPF armazenado com AES-256-GCM e localizado por HMAC-SHA-256, sem persistência em texto aberto.
- Migração reutilizável dos CPFs legados e compatibilidade de login durante a transição.
- Administração de campi e comissões CPPD, incluindo portaria, mandato, vigência, membros titulares ou suplentes e função exercida.
- Gestão de campi e comissões disponível para ADMIN e CPPD Central, com bloqueio da CPPD local no frontend e no backend.
- Rotas de criação, consulta, edição, exclusão e atribuição de papéis de usuários restritas ao perfil ADMIN selecionado.
- Administração versionada dos tipos de processo, com categoria, regras de pontuação, comissão especial, GECC, destino padrão e vigência.
- Documentos obrigatórios configuráveis por versão, incluindo código, nome, formatos aceitos, tamanho máximo, multiplicidade, ordem e status.
- Abertura de processos limitada à versão ativa e vigente da configuração, preservando os processos já vinculados a versões anteriores.
- Upload genérico dos documentos configurados para a versão do processo, com validação de formato e tamanho, substituição, múltiplos arquivos e remoção.
- Bloqueio do envio ao faltar documento obrigatório configurado, sem substituir as validações específicas de RSC e Classe Titular.
- Abertura, envio e análise documental de processos simples, com parecer e decisão da CPPD.
- Associação automática do processo ao campus cadastrado no perfil do docente.

## 2. Validações institucionais pendentes

Estas decisões devem ser confirmadas com orientador, CPPD ou documentação oficial antes de fechar as regras no sistema.

### Autenticação e acesso

- [ ] Confirmar o domínio ou a lista de domínios institucionais aceitos.
- [ ] Confirmar se Google e CPF/senha coexistirão no MVP.
- [ ] Confirmar que Gov.br permanece fora do MVP.
- [ ] Definir quais usuários pertencem à CPPD Central e quais são membros locais.

### RSC e Classe Titular

- [ ] Validar a composição oficial das comissões de RSC e Classe Titular.
- [ ] Confirmar a quantidade obrigatória de avaliadores internos e externos.
- [ ] Confirmar a regra de aprovação da Classe Titular, incluindo a hipótese de três aprovações entre quatro avaliadores.
- [ ] Confirmar a pontuação mínima total e a pontuação mínima no nível de RSC pretendido.
- [ ] Validar a regra da data de referência final da Classe Titular.
- [ ] Definir os fluxos de reavaliação, recurso, indeferimento e nova submissão.
- [ ] Confirmar quais dados do sorteio realizado no SIMEC devem ser registrados manualmente.

### Documentos e GECC

- [ ] Validar os modelos oficiais de requerimento, declaração, parecer, ata, despacho e checklist.
- [ ] Confirmar quais arquivos devem ser PDFs separados e quais devem ser consolidados.
- [ ] Confirmar os documentos obrigatórios de cada tipo de processo.
- [ ] Confirmar os documentos obrigatórios e a sequência oficial do GECC.
- [ ] Definir por quanto tempo documentos com dados pessoais devem ser armazenados.
- [ ] Definir quais campos, além do CPF, exigem criptografia.

## 3. Roteiro de homologação para executar depois

### Administrador

- [ ] Criar e editar usuários de cada perfil.
- [ ] Criar e editar um campus, além de testar sua ativação e inativação.
- [ ] Criar uma comissão CPPD com portaria, início e fim do mandato.
- [ ] Adicionar membros titulares e suplentes, alterar a função e remover um vínculo.
- [ ] Criar um tipo de processo simples com destino padrão e documentos obrigatórios.
- [ ] Criar uma nova versão e confirmar que a versão anterior permanece no histórico.
- [ ] Inativar e reativar a versão mais recente; confirmar que versões antigas não podem ser reativadas.
- [ ] Confirmar que um processo já aberto mantém a versão original após a publicação de outra versão.
- [ ] Configurar requisito obrigatório e opcional, com formatos e tamanhos diferentes, e confirmar a lista mostrada ao docente.
- [ ] Criar uma tabela de pontuação, configurar itens e publicar uma versão vigente.
- [ ] Confirmar que alterações futuras não modificam tabelas já vinculadas a processos.

### Docente

- [ ] Abrir, editar e enviar um processo de progressão ou promoção.
- [ ] Preencher pontuação, anexar comprovantes e gerar requerimento, planilha e PDF consolidado.
- [ ] Abrir um RSC, anexar o relatório e preencher os níveis e itens aplicáveis.
- [ ] Abrir uma Classe Titular, cadastrar doutorado e escolher memorial ou tese.
- [ ] Em um processo configurável, anexar documento válido e rejeitar formato ou tamanho inválido.
- [ ] Substituir um documento único, anexar vários arquivos quando permitido e remover um anexo.
- [ ] Confirmar que o envio fica bloqueado sem documento configurado obrigatório e liberado após o anexo.
- [ ] Confirmar que o processo enviado deixa de ser editável.

### CPPD

- [ ] Como CPPD Central, administrar campi, comissões, portarias, vigências e membros.
- [ ] Como CPPD local, confirmar que o menu e o acesso direto à administração de comissões estão bloqueados.
- [ ] Confirmar que a ativação, inativação ou remoção do vínculo de um membro altera seu escopo de campus.
- [ ] Visualizar o processo recebido e conferir todos os documentos.
- [ ] Criar a comissão especial, convidar membros, registrar aceite/recusa e portaria.
- [ ] Confirmar que a comissão só pode ser ativada quando cumprir as regras necessárias.
- [ ] Acompanhar pareceres individuais e concluir a comissão somente quando todos forem enviados.
- [ ] Registrar a decisão institucional e verificar a abertura do GECC quando aplicável.
- [ ] Organizar interessados e documentos do GECC, gerar checklist e concluir o fluxo.

### Avaliador externo

- [ ] Receber o convite em um e-mail real e concluir o primeiro acesso.
- [ ] Confirmar acesso exclusivo aos processos em que foi incluído.
- [ ] Aceitar ou recusar a participação na comissão.
- [ ] Salvar uma avaliação como rascunho e depois enviá-la definitivamente.
- [ ] Confirmar que a avaliação enviada fica somente para leitura.

### Segurança e isolamento

- [ ] Tentar acessar rotas de outro perfil e confirmar o bloqueio pelo backend.
- [ ] Confirmar que somente ADMIN acessa a administração de tipos de processo.
- [ ] Tentar acessar um processo de outro campus como membro local da CPPD.
- [ ] Confirmar que apenas a CPPD Central visualiza todos os campi.
- [ ] Validar download protegido de evidências, pareceres e documentos GECC.
- [ ] Verificar os fluxos em tela de computador e celular.

### Verificações automáticas já executadas

- [x] Compilação do backend.
- [x] Execução dos 162 testes unitários do backend.
- [x] Verificação de tipos do frontend.
- [x] Compilação de produção do frontend, incluindo 53 páginas.
- [x] Varredura das telas estáticas e dinâmicas de ADMIN, DOCENTE, CPPD local, CPPD Central e AVALIADOR EXTERNO sem erros de execução ou respostas 5xx.
- [x] Processo simples aberto, enviado e deferido pela análise documental da CPPD.
- [x] Processo simples associado automaticamente ao campus e acessado pela CPPD local correspondente.
- [x] Comissão RSC criada com portaria, convite ao avaliador externo, aceite, ativação, avaliação individual, conclusão e decisão CPPD.
- [x] Transição do processo RSC aprovado para organização GECC e carregamento da tela correspondente.
- [x] Login local com CPPD local e CPPD Central.
- [x] CPPD local visualizando somente o docente do campus vinculado.
- [x] CPPD Central visualizando docentes de todos os campi.
- [x] Acesso ao módulo CPPD pela interface com o perfil CPPD Central.
- [x] Migração dos 7 usuários locais: nenhum CPF permaneceu no campo legado em texto aberto.
- [x] Login por CPF validado para ADMIN, CPPD local, CPPD Central, docente e avaliador externo após a migração.
- [x] Rotas de administração de campi e comissões validadas para ADMIN e CPPD Central, com resposta 403 para CPPD local.
- [x] Middleware de perfil selecionado coberto para acesso permitido, perfil incorreto e perfil ausente.
- [x] Schema Prisma validado e cliente regenerado com versionamento e requisitos documentais.
- [x] Regras de criação, nova versão, vigência, conflito e reativação cobertas por testes unitários.
- [x] Requisitos documentais cobertos para bloqueio de envio, formato, tamanho e anexo válido.

## 4. Backlog de implementação

### P0 - Autorização e dados sensíveis

- [x] Implementar o perfil CPPD Central no frontend, middleware e rotas do backend.
- [x] Associar o membro local de teste a uma comissão/campus vigente.
- [x] Aplicar o filtro de campus nas consultas e alterações de processos, avaliações, comissões, GECC e docentes da CPPD.
- [x] Implementar `cpfEncrypted` e `cpfHash`, migrando os CPFs em texto aberto sem quebrar login, busca ou recuperação de senha.
- [x] Adicionar testes unitários do escopo de autorização entre papéis, campi, processos e docentes.
- [x] Criar a tela administrativa para gerenciar campi, comissões CPPD, portarias, membros e vigências.
- [ ] Adicionar testes integrados permanentes com processos de dois campi.

### P1 - Autenticação e configuração administrativa

- [ ] Implementar login com Google usando o client ID já configurado e validação do e-mail institucional.
- [x] Manter CPF/senha enquanto a decisão de coexistência não for validada.
- [x] Criar administração de tipos de processo, documentos obrigatórios e destino padrão.
- [ ] Criar administração e versionamento de modelos de documentos.

### P1 - Documentos oficiais e regras finais

1. Gerar PDF do parecer individual do avaliador externo.
2. Gerar parecer consolidado da CPPD para RSC e Classe Titular.
3. Gerar lista de indicados e ata para Classe Titular, incluindo modalidade por tese quando aplicável.
4. Disponibilizar o diploma cadastrado para reutilização e anexação sem novo upload.
5. Implementar a pontuação mínima por nível de RSC depois da validação da regra oficial.
6. Implementar a composição e o critério final de aprovação da Classe Titular depois da validação oficial.
7. Implementar sessões de defesa, reavaliação e recurso quando as regras forem confirmadas.

### P2 - Processos genéricos e operação

1. Gerar os documentos oficiais dos processos simples; abertura, envio e análise documental básica já estão implementados.
2. Definir e implementar política de retenção, exclusão e auditoria de arquivos pessoais.
3. Adicionar testes integrados permanentes para convite, comissão, avaliação e GECC.
4. Adicionar testes de ponta a ponta dos principais fluxos e verificações de acessibilidade.
5. Preparar configuração de produção, armazenamento persistente de arquivos, cópia de segurança e observabilidade.

## 5. Próxima implementação recomendada

Implementar a **administração e o versionamento dos modelos de documentos**, vinculando cada modelo ao tipo e à versão do processo. Depois disso, implementar o login Google sem remover CPF/senha durante a fase de transição.

## 6. Estado do ambiente local

- [x] MySQL local em execução.
- [x] Migrações aplicadas; `prisma migrate status` informa que o banco está atualizado.
- [x] Seeds executados e logins dos cinco perfis validados.
- [!] A tabela `Tabela RSC temporária para testes` (#5) foi criada somente para permitir o cenário automatizado. Substituir pelos critérios oficiais antes de homologar pontuação RSC.

### Dados criados para continuar a homologação manual

- Processo #11: `Training Leave`, deferido pela CPPD Central no teste automatizado.
- Processo #12: `Training Leave`, enviado e disponível para análise documental da CPPD local.
- Processo #13: RSC, comissão concluída e processo aguardando organização GECC.
- Avaliação externa #6: convite aceito e avaliação individual enviada no processo #13.

