# Acesso Google e convites autorizados

## Comportamento

O Google é uma alternativa ao login por CPF e senha. A entrada começa por uma consulta de autorização do e-mail; o servidor valida novamente a identidade devolvida pelo Google, incluindo destinatário, emissor, validade, assinatura e desafio da tentativa.

Novas contas Google exigem convite. Docentes ainda podem usar o cadastro público, com e-mail aceito pelo campus selecionado. Contas antigas conservam o login por CPF e senha, mesmo quando seu e-mail precisa ser regularizado. Novos cadastros e alterações de e-mail usam os domínios ativos configurados para o campus. Cada regra pode permitir ou recusar subdomínios.

Externos de outras instituições usam endereço individualmente autorizado pela CPPD, com confirmação administrativa do vínculo institucional. Provedores pessoais conhecidos são recusados. Essa confirmação não é uma validação automatizada de vínculo empregatício.

No primeiro vínculo, o acesso ao link de convite ou um código enviado à caixa de e-mail confirma sua posse. A confirmação Google exige o mesmo e-mail; a política compara o endereço confirmado com os domínios do campus. O domínio primário do Google pode ser diferente de um alias institucional; a confirmação adicional da caixa de e-mail continua obrigatória na primeira vinculação. O identificador permanente é o `sub` do Google. Uma mudança de e-mail não substitui a identidade Google vinculada.

## Configuração de domínios por campus

ADMIN e CPPD Central podem configurar os campi existentes. Membros da CPPD local configuram somente seus campi com vínculo vigente. A página E-mails institucionais permite cadastrar, ativar/inativar domínios e escolher se aceita subdomínios. O mesmo domínio pode ser configurado em vários campi, com políticas diferentes. Campus sem regra ativa não libera novos cadastros institucionais. Nenhum domínio é liberado automaticamente no banco de trabalho.

O cadastro público e o acesso Google pedem a seleção do campus. Convites registram o campus e o endereço completo; exceções para avaliadores de outras instituições dependem de confirmação individual. Domínio de aluno aceito pelo campus também permite o cadastro docente imediato escolhido para o sistema. Esta configuração não cria isolamento entre institutos ou altera os privilégios globais atuais de ADMIN/CPPD Central.

## Telas

- `/login`: CPF e senha, opção Google quando habilitada e entrada para convidados/acompanhamento.
- `/acesso`: autorização do e-mail, Google ou definição de senha, confirmação por código, conclusão do cadastro e acompanhamento da revisão.
- `/cppd/convites`: convite de externos, reenvio, cancelamento e revisão de dados profissionais. Exige perfil CPPD selecionado e vínculo CPPD vigente.
- `/admin/convites`: convites para os perfis disponíveis e revisão de externos.
- `/avaliador`: atribuições da conta, acessíveis também pelo perfil docente para avaliadores internos. Os filtros existentes por pessoa e processo permanecem aplicados.

O externo não recebe perfil de avaliador nem fica disponível para seleção na comissão antes da aprovação. A aprovação registra data e responsável. Contas existentes mantêm seus outros perfis enquanto um convite externo aguarda revisão.

## Configuração e publicação

1. Instalar dependências do servidor com `npm ci`.
2. Conferir `DATABASE_URL` e aplicar as migrações no ambiente de teste com `npm run migrate:deploy`. A migração nova adiciona tabelas de identidade, convites, tentativas e limites, além de três campos profissionais opcionais. Não altera CPFs ou senhas existentes.
3. Executar `npx prisma generate` e configurar `CPF_ENCRYPTION_KEY`, os segredos de sessão e o envio de e-mail já utilizados pelo sistema.
4. Definir `APP_URL` com o endereço público do site e `BACKEND_URL` na interface.
5. Criar um cliente OAuth do tipo Web no Google Cloud, configurar as origens JavaScript autorizadas e permitir o público externo necessário. Cadastrar a origem local de desenvolvimento separadamente. Este fluxo usa o retorno JavaScript do Google Identity Services.
6. Definir `GOOGLE_CLIENT_ID` no servidor e `GOOGLE_LOGIN_ENABLED=true` somente depois da configuração. O identificador é público; não são solicitados acesso ao Drive/Gmail nem credenciais de API além da identidade. Este fluxo não usa segredo OAuth no navegador.
7. Validar a entrada com contas institucionais reais, a correspondência de e-mail e a política organizacional do domínio Google. Publicar usando HTTPS; os cookies de sessão usam `Secure` em produção.

Os links e códigos são enviados pelo remetente já configurado no sistema. Uma falha de envio mantém o convite registrado e aparece para o responsável, que pode reenviar.

Para desligar a alternativa Google, usar `GOOGLE_LOGIN_ENABLED=false`. Isso não apaga vínculos nem modifica senhas. Usuários que criaram conta apenas pelo Google podem usar a recuperação de senha por CPF para estabelecer o acesso por senha.

## Segurança e validade

- Convites duram sete dias. Reenvio renova a validade e invalida o link e as tentativas anteriores.
- Links são de uso único e enviados no fragmento da URL, retirado da barra de endereço ao iniciar. Os segredos persistidos são hashes.
- Tentativas e códigos duram até dez minutos; cada tentativa permite cinco erros de código. Reenviar código não reinicia a contagem de erros.
- Há limites persistidos por e-mail e origem de acesso. Todos os pedidos que passam pelo mesmo proxy compartilham seu IP; a configuração da infraestrutura deve considerar o volume esperado.
- A sessão provisória de acompanhamento dura 24 horas e só serve para consultar ou corrigir o cadastro pendente. Para retomar após expirar, iniciar novamente pelo e-mail, com Google ou senha e confirmação da caixa de e-mail.
- Segredos provisórios e sessões ficam em cookies `HttpOnly`; operações novas da interface exigem a mesma origem. A tentativa e o desafio impedem reutilizar o retorno Google em outro navegador.
- A conclusão do cadastro, os vínculos e as permissões são gravados em transações. Uso concorrente da mesma tentativa não pode gerar duas contas.
- O CPF informado no novo fluxo é obrigatório e válido, mas fica cifrado e com hash de pesquisa, preservando o mecanismo existente. CPF já associado a outra conta exige resolução pela administração.
- Login, renovação, seleção de perfil e pedidos autenticados verificam o estado atual do usuário. Usuários inativos ou perfis removidos não mantêm acesso por tokens antigos.
- Cadastrar um externo pelo formulário administrativo antigo não contorna a revisão: o sistema encaminha para Convites de acesso, e a API recusa a concessão antecipada do perfil.

## Rotas e contratos

As rotas públicas do servidor estão em `/auth/google/start`, `/auth/google/complete` e `/auth/access/{config,send-code,verify-email,status,complete,password,update-pending}`. A gestão autenticada usa `/access/invitations`, com operações por identificador para `resend`, `cancel`, `review` e `approve`.

A interface usa `/api/acesso/*` para intermediar esses pedidos. O segredo da tentativa e os tokens da sessão definitiva são retirados da resposta antes de ela chegar ao JavaScript da página. A resposta informa a etapa: `VERIFY_EMAIL`, `REGISTER`, `READY`, `REVIEW` ou `AUTHENTICATED`.

## Verificação

No servidor: `npm run build`, `npx prisma validate`, `npm run test:unit` e a checagem de lint dos arquivos alterados.

Na interface: `npm run typecheck` e `npm run build`.

Para os testes HTTP com MySQL, usar exclusivamente um banco de teste: configurar `TEST_DATABASE_URL`, executar `npm run test:db:setup` com as migrações novas e depois `npm run test:integration`. A nova suíte `googleAccessFlows.test.ts` percorre convite, identidade, cadastro cifrado, revisão e sessão com atribuições restritas. A identidade Google e o envio de e-mail são simulados nessa suíte; a validação real do provedor requer o cliente Web configurado.

A migração deve ser validada em MySQL de teste antes da produção. Os testes unitários e a prévia visual não substituem essa verificação.
