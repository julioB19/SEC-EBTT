# Manual de testes do SEC EBTT

Roteiro de validação manual de Progressão, Promoção, RSC e Classe Titular. Use este documento para executar as etapas, comparar o resultado esperado e registrar evidências antes de considerar o sistema homologado.

Edição baseada no sistema verificado em 17 de outubro de 2026. Preparado para Julio e para a conferência funcional com docentes, CPPD e avaliadores.

| Etapa | O que você vai verificar |
|---|---|
| Preparação | Ambiente, contas, perfis funcionais e arquivos de teste. |
| Acesso e cadastros | Login, troca de perfil, permissões, campus e comissão local. |
| Processos | Abertura, pontuação, envio, análise e conclusão dos quatro tipos. |
| Conferência criteriosa | Datas financeiras, limites, votos, assinaturas, recursos e histórico. |
| Encerramento | Resultados registrados, falhas classificadas e pendências explícitas. |

Como preencher: A = aprovado; R = reprovado; B = bloqueado por uma dependência; NT = não testado. Anote a identificação do processo e o nome da captura ou do PDF em cada registro. Um botão bloqueado conta como aprovação somente quando o bloqueio era o resultado esperado.

- Faça os testes de erro antes de concluir o processo. Depois do deferimento, a classe funcional e as permissões de edição mudam.
- Use registros identificados como TESTE MANUAL. A ação de deferir ou indeferir salva uma decisão, mesmo no ambiente local.
- Os casos marcados CRÍTICO precisam passar. Uma pendência nesses casos impede encerrar a homologação como completa.
- Os resultados descritos refletem as regras implementadas. A CPPD deve confirmar também o conteúdo institucional dos documentos e a interpretação dos procedimentos.

A implementação já passou por 220 testes automatizados. Na rodada de navegador anterior, o ciclo integral de Progressão foi percorrido; os outros processos ainda precisam de sua conferência completa pela interface.

# 1 Preparar o ambiente

Comece no ambiente local já configurado. Abra http://localhost:3000 e atualize a página com Ctrl + F5. O frontend usa a porta 3000 e o backend local usa a porta 3333; o Docker precisa manter o banco disponível.

- Se a página não abrir, confira se os servidores e o Docker estão em execução. Se abrir, mas os dados falharem, registre a mensagem antes de tentar novamente.
- Não recrie o banco nem recarregue os cadastros iniciais para seguir este roteiro. Preserve os usuários e processos existentes.
- As contas abaixo são as contas locais de desenvolvimento documentadas. Se a senha foi alterada, use a senha atual. Não use a sua conta pessoal para simular mudanças funcionais.

| Perfil | CPF | Senha inicial local |
|---|---|---|
| Administrador | 81188057006 | Admin@123456 |
| CPPD Central | 58315013610 | CppdCentral@123456 |
| CPPD local | 51756662070 | Cppd@123456 |
| Docente base | 65033520008 | Docente@123456 |
| Avaliador externo base | 52998224725 | Avaliador@123456 |

O Docente base foi originalmente cadastrado em D1. Confira a classe atual antes de usá-lo: uma conta em D1 não serve para abrir Progressão B1 para B2 ou Promoção B4 para C1. Prepare as contas da próxima seção para os ciclos completos.

Para manter pessoas conectadas ao mesmo tempo, use perfis separados do navegador, navegadores diferentes ou uma janela normal e uma anônima. Duas abas ou duas janelas normais compartilham a sessão. Se usar a mesma sessão, faça Sair antes de trocar de pessoa.

Os processos sintéticos 64, 65, 66 e 67 usados anteriormente estavam no banco isolado de testes. Não espere encontrá-los neste ambiente e não dependa desses números. Registre os números criados na sua rodada.

Identificação da rodada: ____________________  Data: ____/____/______
Responsável: ____________________  Navegador: ____________________
Endereço conferido: ____________________

# 2 Preparar os docentes de teste

Entre como Administrador e abra Usuários > Novo usuário. Cadastre os perfis abaixo com CPF e SIAPE de homologação distintos. Use e-mails de teste sob seu controle. Estes são modelos de cadastro a preparar, não contas já criadas por este manual.

| Identificação | Classe e formação | Finalidade |
|---|---|---|
| T PROG | B1; início em 01/01/2024; graduação | Progressão B1 para B2. |
| T PROM | B4; início em 01/01/2024; graduação | Promoção B4 para C1. |
| T A1 | A1; início em 01/01/2023; graduação | Promoção A1 para B1 e regra de 36 meses. |
| T RSC | B1; graduação, especialização ou mestrado conforme o nível pedido | RSC I exige graduação; II, ao menos especialização; III, ao menos mestrado. |
| T MEM | C4; início em 01/01/2024; doutorado | Classe Titular por memorial. |
| T TESE | C4; início em 01/01/2024; doutorado | Classe Titular por tese inédita. |

Vincule os docentes ao mesmo campus da CPPD local utilizada na rodada. Preencha todos os campos obrigatórios do cadastro. Para T RSC, prefira mestrado se quiser testar também RSC III; para T MEM e T TESE, cadastre depois o diploma na biblioteca do próprio docente.

As datas acima permitem testar períodos completos na edição de outubro de 2026. Para testar abertura antecipada e prazos, crie uma conta extra ou ajuste apenas outro cadastro identificado como teste, antes de haver decisão. Não altere um cadastro real para simular o limite.

Guarde para cada conta: nome, CPF, e-mail, senha de teste, classe, início do interstício e campus. Após a aprovação, confira a nova classe. Não tente executar o segundo processo como se a conta ainda tivesse a classe anterior.

Processos da rodada
Progressão nº __________  Promoção B4 nº __________  Promoção A1 nº __________
RSC favorável nº __________  RSC indeferido nº __________
Titular memorial nº __________  Titular tese nº __________

# 3 Preparar avaliadores e documentos

A comissão especial de um processo é diferente da comissão local da CPPD. A primeira avalia um RSC ou uma Classe Titular específica; a segunda define quem pode atuar como CPPD de um campus.

| Grupo | Contas necessárias | Uso |
|---|---|---|
| Banca A | 1 interno e 3 externos, pessoas diferentes | RSC inicial e ciclos de Titular, respeitando os indicados de cada processo. |
| Banca B | Outro interno e outros 3 externos | Recurso do RSC; os membros não podem repetir os da comissão original. |
| Suplentes de Titular | 2 externos e 1 interno na lista de indicados | Completam a indicação de sete pessoas; não são sete votantes. |

Cadastre os externos como Avaliador externo ativo e complete o perfil exigido. Para o interno de teste, prefira uma conta com Docente e Avaliador externo, com o perfil avaliador selecionável. Ela não pode ser a conta do próprio requerente. Use os mesmos e-mails do cadastro e da indicação na Classe Titular.

- Prepare PDFs legíveis: comprovante de atividade, relatório ou memorial RSC, memorial Titular, tese, diploma nacional, diploma estrangeiro, reconhecimento nacional e avaliação de desempenho.
- Use conteúdo fictício identificado como teste. Mantenha arquivos pequenos para o percurso normal. Guarde também um arquivo que não seja PDF e outro acima do limite para os testes de rejeição.
- Documentos específicos e comprovantes usuais: até 5 MB. PDFs assinados no painel próprio: até 20 MB. Confira o limite mostrado no campo correspondente.
- As assinaturas são feitas fora do SEC-EBTT. Para a conferência institucional, utilize PDFs realmente assinados e verifique-os na plataforma emissora; um nome escrito no PDF não comprova assinatura.

Para testar permissões entre campi, prepare outro campus e uma CPPD local vinculada a ele. Se essa preparação não estiver disponível, marque o teste de isolamento como B; não o dê como aprovado por ausência de dados.

Banca A preparada [ ]  Banca B preparada [ ]  PDFs preparados [ ]
Contas e e-mails anotados em local reservado [ ]

# 4 Testar login e sessão

Execute estes casos antes de iniciar os processos. Use Sair entre contas e observe o nome do módulo e a pessoa exibida no menu de perfil.

## L01 Entrar com credenciais válidas   CRÍTICO

Faça: Entre uma vez como Administrador, CPPD Central, CPPD local, Docente e Avaliador externo.

Confirme: Cada conta acessa seu módulo; os dados pessoais e as opções correspondem à pessoa conectada.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## L02 Rejeitar senha incorreta   CRÍTICO

Faça: Use um CPF de teste existente com senha errada. Tente também entrar sem preencher os campos.

Confirme: A entrada é recusada com mensagem compreensível; a sessão anterior não pode ser apresentada como se o novo login tivesse funcionado.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## L03 Sair e impedir retorno aos dados   CRÍTICO

Faça: Entre, abra uma página interna, faça Sair e tente voltar à página pelo endereço ou pelo botão Voltar do navegador.

Confirme: O acesso aos dados exige autenticação novamente; atualizar a página não recupera uma sessão encerrada.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## L04 Selecionar perfil de uma mesma pessoa   CRÍTICO

Faça: Use uma conta com dois perfis. Escolha Docente, depois Avaliador, e confira o módulo ativo antes de agir.

Confirme: O sistema respeita o perfil selecionado. Navegar para outro módulo que a pessoa possui pode selecionar esse perfil; isso é diferente de conceder um perfil que ela não possui.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## L05 Conferir cadastro e recuperação de senha

Faça: Se usar Cadastre-se, crie somente um docente de teste. Em Esqueci minha senha, solicite recuperação para um e-mail sob seu controle.

Confirme: O cadastro não concede Administração ou CPPD. Para recuperação, a mensagem é clara; entrega do e-mail depende do serviço configurado. Sem acesso ao e-mail, marque B, não A.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

# 5 Testar permissões e arquivos privados

Faça estes testes com dois docentes de teste e uma CPPD de cada campus. Copie somente endereços dos registros que você preparou para a rodada.

## S01 Separar processos dos docentes   CRÍTICO

Faça: No Docente A, copie o endereço de um processo e de um comprovante. Entre como Docente B e tente abrir os mesmos endereços.

Confirme: B não vê o processo nem o arquivo de A. Mensagens de acesso negado ou não encontrado são aceitáveis; exibir qualquer conteúdo privado é reprovação crítica.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## S02 Restringir módulos e campus   CRÍTICO

Faça: Como Docente, tente abrir /admin/usuarios. Como avaliador sem perfil docente, tente /docente. Como CPPD local, procure um processo do outro campus.

Confirme: Os módulos não autorizados são bloqueados. A CPPD local fica limitada ao campus autorizado; a CPPD Central pode consultar o conjunto permitido.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## S03 Restringir o acesso do avaliador   CRÍTICO

Faça: Antes de aceitar um convite, tente abrir documentos e a avaliação. Depois, use outra conta de avaliador que não foi convidada.

Confirme: O avaliador só obtém o acesso permitido após o aceite; a outra pessoa não consegue consultar nem enviar o parecer daquela atribuição.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## S04 Bloquear arquivos sem autenticação   CRÍTICO

Faça: Com um comprovante de teste existente, copie seu link de download autenticado e abra em uma janela anônima sem login. Se tiver uma URL antiga de /uploads, teste-a também.

Confirme: Nenhum PDF é exibido sem a autorização necessária. A URL pública antiga deve ficar indisponível. Não invente uma URL de arquivo inexistente para concluir que a proteção passou.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Evidência suficiente: capture a mensagem de bloqueio e anote qual conta tentou acessar qual processo. Ao registrar um defeito, evite expor CPF, senha ou conteúdo documental real na imagem.

# 6 Conferir cadastros e comissão local

Administrador ou CPPD Central > Campi e CPPD ou Campi e comissões. A tela de Usuários é a referência visual para os cards, campos, bordas e ações.

## A01 Criar e editar um campus de teste

Faça: Na aba Campi, crie um campus com nome, sigla e e-mail da CPPD. Edite o e-mail e recarregue a página.

Confirme: O dado persiste e a lista não duplica o campus por simples recarga. Campos inválidos mostram mensagem e preservam o cadastro anterior.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## A02 Cadastrar uma comissão local vigente   CRÍTICO

Faça: Na aba Comissões, crie uma comissão para o campus com portaria e datas coerentes. Selecione o card, edite e cancele a edição antes de salvar outro ajuste.

Confirme: Cancelar não altera os dados. Salvar persiste a mudança. Nome, portaria, mandato e vigência continuam associados ao campus correto.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## A03 Conferir membros e acesso local   CRÍTICO

Faça: Adicione um usuário de teste da CPPD, escolha função, titular ou suplente e situação ativa. Em uma sessão separada, confira o acesso desse usuário ao campus.

Confirme: O vínculo define o acesso correto. Alterar o vínculo de teste não pode liberar outros campi ou duplicar a pessoa na mesma comissão.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## A04 Conferir dados funcionais do docente   CRÍTICO

Faça: Em Usuários > Editar, confira classe, início do interstício, escolaridade, SIAPE e campus de T PROG, T PROM, T MEM e T TESE.

Confirme: As informações reaparecem no perfil do docente e nos processos correspondentes. Um cadastro funcional incorreto deve ser corrigido antes de avaliar um suposto erro de elegibilidade.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Não remova a única comissão ou o único membro que você usa para administrar o ambiente. Para testar inativação e remoção, use os vínculos adicionais preparados para a rodada.

# 7 Conferir o comportamento comum dos processos

Docente > Abrir processo e Consultar processos. Use número externo com prefixo TESTE MANUAL e registre o número interno exibido após a abertura.

## G01 Abrir e recuperar um rascunho

Faça: Abra um processo válido, preencha os campos comuns, salve, volte à lista e entre novamente nos detalhes.

Confirme: Tipo, número, docente, campus e dados próprios do processo persistem. Não há dois processos criados por uma única ação de abertura.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## G02 Validar e persistir documentos   CRÍTICO

Faça: Tente anexar um arquivo que não seja PDF e um arquivo acima do limite do campo. Depois anexe um PDF válido e abra o link salvo.

Confirme: O inválido é recusado, o válido abre legível e corresponde ao arquivo escolhido. Atualizar a página preserva a associação correta.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## G03 Bloquear envio incompleto   CRÍTICO

Faça: Tente enviar sem os documentos e os campos exigidos. Corrija um requisito por vez até completar a preparação.

Confirme: O sistema informa as pendências, preserva o rascunho e não inicia análise antes de o envio ser aceito.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## G04 Bloquear edição depois do envio   CRÍTICO

Faça: Envie um processo completo. Volte como docente e tente alterar dados, pontuação, evidências e excluir o processo.

Confirme: O conteúdo enviado fica protegido. Só uma etapa explicitamente permitida, como um recurso, pode receber a ação correspondente; o envio não libera edição geral.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Faça a exclusão somente em um rascunho descartável criado para isso e confirme o resultado na lista. Nunca use o processo que contém as evidências do ciclo principal para esse teste.

# 8 Testar o ciclo normal de Progressão

Use T PROG em B1, com início do interstício em 01/01/2024. Prepare Progressão B1 para B2, com período de 01/01/2024 a 31/12/2025 e os comprovantes necessários.

## P01 Abrir a movimentação correta   CRÍTICO

Faça: Escolha Progressão, B1 como origem e B2 como destino. Salve e confira o perfil e o período nos detalhes.

Confirme: A origem coincide com o cadastro funcional. Progressão permanece dentro da mesma classe e não oferece promoção entre classes.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## P02 Conferir a pontuação com cálculo independente   CRÍTICO

Faça: Na tabela que contenha o bloco de horas aula, lance MNP 20, MND 20, NT 20 e NSI 2, com comprovantes. Recarregue.

Confirme: A fórmula (MNP + MND × 2 + NT) × NSI resulta em 160 pontos. O campo MND contribui com 40 antes da multiplicação por NSI. Não some os valores individuais como se fossem o total do bloco.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## P03 Analisar e deferir na CPPD   CRÍTICO

Faça: Envie como docente. Na CPPD, abra Processos > Avaliar, reconheça os quatro itens, registre a fundamentação, confira a prévia e conclua como aprovado.

Confirme: A pontuação da CPPD é a reconhecida, o processo aparece nos avaliados e o docente passa de B1 para B2. O processo concluído fica somente para leitura.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Se a tabela vigente não contiver MNP, MND, NT e NSI, não invente itens: use a fórmula e os limites efetivamente exibidos e registre qual tabela foi testada. O exemplo de 160 pontos só vale para aquele bloco.

Antes de concluir, execute os testes P04 a P06 da próxima seção. Depois compare requerimento, planilha, dossiê, parecer salvo e consulta posterior. O período e os totais devem ser coerentes em todos eles.

# 9 Conferir os limites de Progressão e as datas

Estes são testes críticos. A pontuação declarada pelo docente não substitui a pontuação reconhecida pela CPPD. A possibilidade de preparar o pedido antecipadamente não autoriza deferimento antecipado.

## P04 Bloquear aprovação abaixo do mínimo   CRÍTICO

Faça: Em um processo de teste, deixe a CPPD reconhecer menos de 120 pontos, mesmo que o docente tenha declarado 160. Tente deferir.

Confirme: A aprovação é recusada; a classe do docente não muda. Se a tabela vigente exigir mais de 120, deve prevalecer também esse mínimo maior.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## P05 Distinguir preparação de elegibilidade   CRÍTICO

Faça: Em outra conta de teste, use início de interstício cuja data de completar 24 meses ainda esteja a mais de 60 dias. Depois teste dentro da janela de 60 dias, mas antes dos 24 meses.

Confirme: Fora da janela, a preparação é bloqueada. Dentro dela, a preparação pode ocorrer; o deferimento antes de completar o interstício continua bloqueado.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## P06 Conferir data financeira e data civil   CRÍTICO

Faça: No exemplo 01/01/2024 a 31/12/2025, informe cumprimento dos requisitos em 01/01/2026; atualize a prévia. Antes de concluir, repita com 15/02/2026.

Confirme: No primeiro caso, efeitos em 01/01/2026; no segundo, em 15/02/2026. O período permanece o período cadastrado. Prévia, parecer final e consulta não recuam um dia nem mantêm data financeira antiga.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

A regra implementada para a data financeira de carreira considera a mais recente entre fim do período, término do interstício mínimo e cumprimento dos demais requisitos. Uma data de cumprimento futura deve ser rejeitada. Confirme também que a atualização funcional usa a data financeira oficial.

Se você não puder preparar uma conta para o limite de datas, marque P05 como B e peça um cenário assistido. Não altere o relógio do computador para simular a passagem do prazo.

# 10 Testar Promoção

Use T PROM para B4 para C1 e T A1 para A1 para B1. Faça cada ciclo com sua própria conta; o deferimento muda a classe de origem para testes seguintes.

## M01 Concluir Promoção de B4 para C1   CRÍTICO

Faça: Abra Promoção B4 para C1 com 24 meses completos. Preencha pontuação e documentos, envie, reconheça os itens na CPPD e confira o parecer antes de deferir.

Confirme: O ciclo se conclui com origem B4 e destino C1. O perfil passa para C1 e mantém documentos, decisão, data financeira e histórico coerentes.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## M02 Conferir os 36 meses de A1 para B1   CRÍTICO

Faça: Use T A1 e um período completo iniciado em 01/01/2023. Compare com uma conta extra ainda sem 36 meses completos.

Confirme: A1 para B1 exige 36 meses. A regra de preparação de 60 dias não transforma 24 meses em prazo suficiente para deferir essa movimentação.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## M03 Impedir Titular pela promoção comum   CRÍTICO

Faça: Na abertura de Promoção, tente selecionar C4 para D1 e tente uma origem incompatível com a conta.

Confirme: C4 para D1 é reservado ao processo próprio de Classe Titular. Uma movimentação incompatível com o cadastro não pode ser deferida.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## M04 Repetir os limites e a conferência documental   CRÍTICO

Faça: Antes da decisão de um processo de teste, reconheça pontuação inferior ao mínimo e tente aprovar. Depois confira datas e PDFs como nos casos P04 e P06.

Confirme: O mínimo e as datas têm os mesmos controles da carreira. Não há troca de nomes, SIAPE, classes ou processo entre Progressão e Promoção.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Conferência final: T PROG deve estar B2; T PROM, C1; T A1, B1, se todos os três ciclos foram deferidos. Um indeferimento não pode produzir a mudança funcional de uma aprovação.

# 11 Abrir RSC e conferir a pontuação

Prepare pelo menos dois processos: RSC A para resultado favorável e RSC B para indeferimento e recurso. Use o docente T RSC com formação compatível com o nível pretendido.

## R01 Preencher nível e período válidos   CRÍTICO

Faça: Escolha RSC I, II ou III. Informe ingresso na carreira, início e fim das atividades, concessão anterior se houver e declaração de veracidade.

Confirme: A formação atende ao nível. Com ingresso em 01/01/2018, início em 01/01/2013 respeita o limite de cinco anos; antes disso deve ser recusado. Fim futuro e declaração não aceita também impedem a abertura válida.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R02 Conferir o intervalo após uma concessão anterior   CRÍTICO

Faça: Em outro rascunho, informe concessão anterior em 01/01/2020 e período posterior encerrando antes e depois de completar três anos.

Confirme: O novo pedido respeita o intervalo mínimo de três anos após a concessão anterior. Datas incoerentes ou futuras são recusadas.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R03 Conferir quantidades e tetos   CRÍTICO

Faça: Anexe comprovantes e lance quantidades inteiras. Tente negativo, fração e quantidade acima do máximo mostrado em um critério.

Confirme: O sistema calcula pontos a partir de quantidade, fatores e pesos da tabela. Valores inválidos são rejeitados e os tetos de diretriz continuam respeitados.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R04 Exigir total e pontos do nível pretendido   CRÍTICO

Faça: Monte uma combinação válida com pelo menos 60 no total e 36 no nível pedido. Compare com total abaixo de 60 e com total suficiente, mas nível pedido abaixo de 36. Anexe o relatório ou memorial.

Confirme: Só a combinação completa libera o envio. Ter 60 no total sem 36 no nível pretendido é insuficiente. Registre os valores efetivamente alcançáveis na tabela vigente.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

# 12 Formar a comissão especial do RSC

Na CPPD, abra Processos > Comissão do RSC enviado. Use a Banca A preparada, não os sete indicados de Classe Titular.

Ponto prioritário da revisão de código: o seletor Interno ou Externo está desabilitado para RSC na versão inspecionada. Confirme esse comportamento na interface. Se impedir incluir o interno, registre R05 como B e abra uma falha crítica; os passos dependentes também ficam bloqueados. Não substitua o interno por um quarto externo.

## R05 Cadastrar portaria e quatro membros   CRÍTICO

Faça: Salve a comissão, a portaria e sua data. Inclua um interno e três externos, pessoas distintas. Tente repetir um membro e incluir o próprio requerente.

Confirme: A composição correta é aceita. Duplicidade e participação do interessado são bloqueadas; o mesmo cadastro não pode votar duas vezes.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R06 Bloquear comissão incompleta   CRÍTICO

Faça: Com três membros, tente ativar. Depois adicione o quarto e tente ativar sem portaria ou sem todos os aceites.

Confirme: A comissão não é ativada sem composição completa, portaria, data e aceites necessários. Corrigir uma pendência não dispensa as demais.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R07 Conferir aceite e recusa de convites   CRÍTICO

Faça: Entre em cada conta de avaliador. Tente aceitar sem declarar ausência de conflito e recusar sem motivo. Depois aceite corretamente; teste a recusa em um convite descartável.

Confirme: O aceite exige a declaração; a recusa exige motivo. Convites e respostas ficam ligados à pessoa certa. Substitua um recusante enquanto a comissão ainda está em rascunho.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R08 Ativar e preservar a composição   CRÍTICO

Faça: Após os quatro aceites, ative a comissão. Tente incluir ou remover membro e observe o acesso do avaliador.

Confirme: A composição fica protegida após a ativação. Os quatro avaliadores aceitos acessam apenas as atribuições autorizadas.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Se o interno não conseguir abrir o módulo de avaliação, confira os perfis da conta de teste. A conta com Docente e Avaliador externo preparada neste roteiro permite selecionar o módulo de avaliação; origem interna e perfil de acesso são informações diferentes.

# 13 Avaliar e concluir o RSC

Prepare resultados individuais distintos por reconhecimento de quantidades. O resultado do avaliador no RSC é calculado pelo sistema com base nos pontos reconhecidos, inclusive os do nível pretendido.

## R09 Enviar os quatro pareceres individuais   CRÍTICO

Faça: Como cada avaliador, abra sua atribuição, confira os PDFs, registre quantidades reconhecidas e fundamentação. Salve rascunho, retorne e envie.

Confirme: Rascunho persiste; envio torna o parecer somente para leitura. O resultado reflete os pontos reconhecidos e o PDF contém a pessoa, o processo e os itens corretos.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R10 Impedir conclusão com parecer pendente   CRÍTICO

Faça: Envie apenas três pareceres e tente concluir a comissão. Depois envie o quarto.

Confirme: Três pareceres enviados, mesmo favoráveis, não bastam. A conclusão exige quatro avaliações enviadas.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R11 Conferir três votos favoráveis de quatro   CRÍTICO

Faça: No RSC A, produza três pareceres favoráveis e um contrário. Conclua a comissão e prepare os documentos assinados antes da decisão.

Confirme: Há quatro pareceres e o resultado permite deferimento. A CPPD não deve registrar uma decisão contrária à regra de pelo menos três votos favoráveis.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R12 Conferir o limite de dois votos favoráveis   CRÍTICO

Faça: No RSC B, produza dois favoráveis e dois contrários. Conclua e tente deferir antes de registrar o indeferimento correto.

Confirme: Deferimento é bloqueado. A decisão correspondente é indeferimento. Não basta uma média de pontos elevada para superar a falta de três votos favoráveis.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Antes da decisão final, gere os quatro pareceres individuais e o consolidado, envie suas versões assinadas e peça à CPPD a conferência administrativa. No documento individual, selecione o membro correspondente. Sem as versões exigidas validadas, a decisão deve ser bloqueada. A seção de documentos detalha essa sequência.

# 14 Testar os recursos do RSC

Use o RSC B efetivamente indeferido. Os recursos dependem da decisão e dos prazos da própria rodada; um rascunho ou um processo aprovado não serve como preparação.

## R13 Apresentar recurso à CPPD   CRÍTICO

Faça: Como requerente, abra Recursos do RSC e apresente a fundamentação dentro do prazo de 45 dias. Tente anexar provas novas ou alterar as evidências anteriores.

Confirme: O recurso preserva o conjunto de provas e abre uma nova comissão. Não deve permitir reescrever o pedido original nem acrescentar prova nova.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R14 Exigir outra comissão no recurso   CRÍTICO

Faça: Na CPPD, use a Banca B. Tente primeiro indicar uma pessoa que participou da comissão original; depois use quatro pessoas diferentes e repita aceite, avaliação e conclusão.

Confirme: A repetição do membro original é recusada. As duas comissões, os dois conjuntos de pareceres e as decisões permanecem consultáveis.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## R15 Registrar recurso final à CPRSC   CRÍTICO

Faça: Se o recurso à CPPD também for indeferido, apresente o recurso final dentro de dez dias. Como CPPD Central, registre referência do ato externo, resultado, fundamentação e PDF assinado conferido.

Confirme: A decisão externa fica registrada com rastreabilidade. A ação não fica disponível indevidamente para qualquer docente, avaliador ou CPPD local.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

A contagem implementada usa dias corridos para 45 e dez dias, com tratamento dos períodos de suspensão cadastrados. Compare a data calculada com o calendário vigente. Os prazos do RSC são diferentes dos prazos em dias úteis do rito de Titular.

Para testar prazo vencido sem esperar, solicite um cenário assistido em ambiente de homologação. Não mude o relógio do computador e não edite datas de um processo real. Se o caso depender de preparação que você não tem, registre B e a dependência.

# 15 Preparar Classe Titular

Use T MEM e T TESE, ambos C4 com doutorado. A abertura é permitida após 12 meses em C4; o deferimento exige 24 meses completos e os demais requisitos.

## T01 Conferir classe e permanência em C4   CRÍTICO

Faça: Abra o processo próprio de Classe Titular. Compare uma conta abaixo de 12 meses com uma entre 12 e 24 meses e com a conta completa.

Confirme: Abaixo de 12 meses, abertura bloqueada; entre 12 e 24, preparação permitida, mas concessão bloqueada; após 24, os demais requisitos ainda precisam ser cumpridos.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T02 Cadastrar e reutilizar o doutorado   CRÍTICO

Faça: No perfil do próprio docente, abra Titulações e diplomas. Cadastre curso, instituição, conclusão, país e PDF. Selecione esse diploma no processo e recarregue.

Confirme: É usado o doutorado do requerente. A seleção atualiza os detalhes imediatamente e persiste após recarga. Uma titulação de outra pessoa não pode ser vinculada.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T03 Exigir reconhecimento do diploma estrangeiro   CRÍTICO

Faça: Teste um diploma estrangeiro sem o arquivo de reconhecimento e depois com o reconhecimento nacional. Compare com um diploma nacional.

Confirme: O diploma estrangeiro incompleto não libera o envio. Os links abrem o diploma e o reconhecimento corretos, sem misturar arquivos de outra conta.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T04 Conferir avaliação de desempenho   CRÍTICO

Faça: Informe 119 pontos e tente salvar ou avançar; depois informe pelo menos 120 com PDF. Na CPPD, confira o documento, os pontos, a data e o parecer de desempenho e doutorado.

Confirme: O mínimo é 120. A declaração do docente não substitui a aprovação da CPPD. Sem desempenho, doutorado e indicados conferidos, a comissão não pode ser ativada.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Teste estes limites em contas extras quando a decisão final de T MEM ou T TESE já tiver alterado a classe para D1. Não modifique o docente de um processo concluído para fazê-lo parecer elegível novamente.

# 16 Conferir os sete indicados de Titular

Docente > processo > Documentos e requisitos > Cadastrar os sete indicados. Prepare a lista com os e-mails das contas que efetivamente participarão da comissão.

| Origem | Titulares | Suplentes | Total |
|---|---|---|---|
| Externos | 3 | 2 | 5 |
| Internos | 1 | 1 | 2 |
| Total | 4 | 3 | 7 |

## T05 Exigir a composição completa da indicação   CRÍTICO

Faça: Preencha sete pessoas na composição acima. Tente salvar com seis, com e-mail duplicado ou com o e-mail do requerente.

Confirme: A lista completa é aceita; quantidade ou composição incorreta, duplicidade e indicação do interessado são recusadas. São sete indicados, mas quatro integrantes votantes.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T06 Conferir qualificação e ciência   CRÍTICO

Faça: Para cada pessoa, informe doutorado, instituição federal, nível C4, Titular ou equivalente permitido, área e ciência prévia. Teste ausência de qualificação, área distinta sem justificativa e ciência em data futura.

Confirme: A lista inválida não passa. Área distinta exige justificativa; ciência futura é recusada. A CPPD deve conferir os dados e registrar sua validação.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T07 Formar a banca a partir dos titulares   CRÍTICO

Faça: Na comissão especial, inclua os três externos titulares e o interno titular, este como presidente. Tente incluir alguém fora da lista ou um suplente como se fosse titular.

Confirme: A banca corresponde aos titulares validados; o presidente é interno. Aceites, portaria e verificação prévia continuam obrigatórios para ativar.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Se desempenho, diploma ou lista forem substituídos antes da decisão, confira se a aprovação anterior pertinente foi invalidada e se a CPPD precisa fazer nova conferência. A simples existência de uma marcação antiga não deve liberar dados substituídos.

# 17 Concluir Classe Titular por memorial

Use T MEM. O percurso de aprovação inicial é diferente do percurso de reavaliação após reprovação. Execute primeiro um ciclo favorável e reserve outro processo para testar o recurso.

## T08 Enviar o memorial com a preparação completa   CRÍTICO

Faça: Escolha Memorial, anexe o arquivo correto e conclua diploma, desempenho e sete indicados. Envie; na CPPD, valide os requisitos, forme a banca, obtenha quatro aceites e ative.

Confirme: O arquivo exigido é o memorial da modalidade. Não se usa a tese nem a pontuação comum de Progressão como substituto da avaliação de desempenho.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T09 Concluir a análise inicial favorável   CRÍTICO

Faça: Como os quatro avaliadores, leia os documentos e envie os pareceres. Para este ciclo, registre pelo menos três resultados favoráveis. Conclua a comissão na CPPD.

Confirme: Com quatro pareceres enviados e pelo menos três favoráveis, o rito pode concluir como aprovado. Não é preciso inventar uma defesa de reavaliação para o percurso inicialmente favorável.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T10 Conferir assinaturas e decisão final   CRÍTICO

Faça: Gere e confira os quatro pareceres individuais, o consolidado, o parecer do presidente e o parecer prévio de desempenho e doutorado. Envie versões assinadas, valide na CPPD e registre a decisão coerente.

Confirme: Sem os documentos exigidos validados, a decisão é bloqueada. Com rito e requisitos completos, T MEM passa de C4 para D1; a consulta preserva documentos e datas oficiais.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Se houve reavaliação com defesa oral, também é exigida a ata assinada correspondente. Não substitua o parecer individual do presidente pelo parecer específico do presidente: são tipos documentais distintos no sistema.

Conferência financeira: a data não pode anteceder a conclusão dos 24 meses, o doutorado, o cumprimento do desempenho e o marco pertinente do rito. Compare os marcos concretos da sua rodada; não use uma data fixa copiada do teste de Progressão.

# 18 Concluir Classe Titular por tese

Use T TESE. A modalidade exige tese acadêmica inédita, declaração de ineditismo e registro de defesa. O teste deve conferir o fluxo da tese, não apenas copiar o fluxo do memorial.

## T11 Exigir tese e declaração de ineditismo   CRÍTICO

Faça: Selecione Tese acadêmica inédita, tente enviar sem tese e sem declaração. Depois anexe a tese, registre a declaração e complete os demais requisitos de Titular.

Confirme: A falta dos documentos e da declaração impede o avanço. O texto e o arquivo ficam associados ao requerente e à modalidade correta.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T12 Agendar e registrar a defesa   CRÍTICO

Faça: Após formar e ativar a comissão, use Rito da Classe Titular para agendar a defesa. Registre depois data realizada, endereço da gravação e observações. Tente concluir sem esse registro.

Confirme: A conclusão sem defesa e gravação é bloqueada. O prazo da comissão é de 45 dias a partir da portaria, com o calendário aplicável. A sessão não pode ser registrada como realizada em uma data futura.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T13 Concluir pareceres e documentos da tese   CRÍTICO

Faça: Obtenha quatro pareceres e pelo menos três favoráveis. Conclua a comissão, prepare as assinaturas comuns de Titular e também a declaração de ineditismo e a ata da defesa. Valide e finalize na CPPD.

Confirme: A decisão só ocorre após defesa, rito e assinaturas pertinentes. T TESE passa para D1 apenas no deferimento. A ata e a declaração são da tese deste processo e da versão válida.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Para a simulação, use sessão e gravação de homologação identificadas como teste. Registre o que foi simulado e o que foi realmente conferido. Marcar uma URL qualquer como gravação não comprova que a prova documental do fluxo está correta.

As datas financeiras de Titular devem acompanhar o último requisito efetivamente cumprido, inclusive defesa ou decisão de recurso quando aplicável. Uma aprovação não pode gerar efeito anterior à própria elegibilidade.

# 19 Testar reavaliação e recurso de Titular

Prepare um processo adicional de memorial inicialmente reprovado e, se possível, um de tese inicialmente reprovada. Não use o processo já aprovado: a mudança de estado necessária é diferente.

## T14 Pedir reavaliação do memorial   CRÍTICO

Faça: Conclua quatro pareceres com menos de três favoráveis. Como docente, peça reavaliação dentro de dois dias úteis e fundamente o pedido.

Confirme: O rito entra na etapa de reavaliação. A CPPD não encerra o processo como se o prazo ainda aberto não existisse. O pedido e o parecer inicial continuam no histórico.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T15 Registrar defesa oral e eventual recurso   CRÍTICO

Faça: Na CPPD, agende e registre a reavaliação oral do memorial dentro do limite de 30 dias aplicável. Se permanecer reprovado, apresente recurso dentro de dois dias úteis e registre sua decisão fundamentada.

Confirme: Defesa, gravação, ata, resultado e eventual decisão de recurso ficam rastreáveis. A decisão final do processo acompanha o resultado final do rito, não apenas o primeiro parecer.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## T16 Conferir tese reprovada e encerramento de prazo   CRÍTICO

Faça: Na tese reprovada, confira o recurso em dois dias úteis. Em cenário preparado com prazo vencido, tente pedir recurso e use a ação de encerramento disponível à CPPD.

Confirme: A tese não é tratada como reavaliação de memorial. Pedido fora do prazo é bloqueado; encerramento só ocorre quando o prazo realmente terminou.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Dias úteis excluem fins de semana e os períodos institucionais cadastrados que suspendem a contagem. Nos prazos corridos implementados, férias e recessos suspendem a contagem; feriados isolados não equivalem automaticamente a férias. Confira as datas efetivas com a CPPD.

Se não houver tempo para esperar ou cenário assistido para prazo vencido, marque a parte correspondente como B. Não aprove um prazo apenas porque o sistema exibiu uma data; compare a contagem e o estado anterior e posterior ao limite.

# 20 Conferir documentos e assinaturas

Execute esta conferência antes de toda decisão que exigir documentos assinados. A CPPD registra uma conferência administrativa; a validação criptográfica deve ser feita na plataforma da assinatura.

## D01 Conferir o conteúdo dos arquivos gerados   CRÍTICO

Faça: Baixe requerimento, planilha, dossiê e pareceres disponíveis para o processo. Abra os arquivos baixados, não apenas o link.

Confirme: Nome, SIAPE, processo, campus, modalidade, período, classes, itens e totais estão corretos. No dossiê, confira índice, separadores, ordem, páginas e memorial quando pertinente.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## D02 Vincular assinatura ao tipo e ao membro   CRÍTICO

Faça: Gere o PDF correto, assine externamente e envie no painel de assinaturas com tipo, membro quando individual, signatário, plataforma e data. Faça a conferência como CPPD e registre a justificativa.

Confirme: O arquivo abre e corresponde ao tipo e ao avaliador selecionados. Nenhuma versão não conferida pode liberar uma decisão que a exija.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## D03 Exigir a versão válida mais recente   CRÍTICO

Faça: Antes de finalizar, envie uma nova versão de um documento já validado. Tente decidir enquanto a nova versão aguarda conferência; depois valide a versão correta.

Confirme: A versão nova não herda a validação da antiga. Versões anteriores permanecem consultáveis e a decisão usa os documentos atuais exigidos.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## D04 Conferir integridade e limites   CRÍTICO

Faça: Envie um arquivo não PDF no campo de assinados, tente arquivo acima de 20 MB e compare com PDF válido. Consulte histórico e metadados da versão salva.

Confirme: Inválidos são recusados. O arquivo válido preserva versão, signatário, data, identificação de integridade e registro de conferência. Isso não substitui a validação externa da assinatura.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Nos PDFs, procure também texto cortado, páginas vazias inesperadas, acentos incorretos e conteúdo antigo após atualização da prévia. Conteúdo institucional e correspondência com os formulários usados pela CPPD precisam de conferência humana, mesmo se o arquivo abrir sem erro.

# 21 Conferir calendário e versões administrativas

Administrador ou CPPD Central > Calendário e documentos. Faça mudanças em registros identificados como teste; alterar configuração usada por processos exige atenção à versão.

## A05 Conferir períodos do calendário   CRÍTICO

Faça: Tente cadastrar fim anterior ao início; depois cadastre um período de teste válido para um campus e outro geral. Compare um prazo pertinente que atravesse o período.

Confirme: Intervalo inválido é rejeitado. O período local afeta o campus correspondente e o geral alcança todos os campi. Use a regra de dias úteis ou corridos aplicável ao prazo verificado.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## A06 Preservar versões de modelos e exigências   CRÍTICO

Faça: Crie um modelo de teste versão 1 e depois versão 2. Para mudar documentos obrigatórios de um tipo já usado, crie a nova versão e compare um processo anterior com um novo.

Confirme: O histórico da versão anterior permanece. Processos antigos não devem ter documentos e decisões reescritos pela alteração administrativa.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## A07 Proteger tabelas de pontuação vigentes   CRÍTICO

Faça: Abra Tabelas de pontuação. Tente editar conteúdo de uma tabela ativa ou voltar a tabela ativa a rascunho. Confira a vigência e a tabela ligada a um processo antigo.

Confirme: Alterações destrutivas da versão ativa são bloqueadas. Datas civis mantêm o dia correto e processos antigos preservam a tabela que fundamenta seus cálculos.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

As referências SIPAC e SIMEC são manuais. Salvar uma referência no SEC-EBTT não significa que um processo foi enviado a outro sistema. Confira se o texto persiste e aparece no histórico, sem esperar integração automática.

O calendário depende de datas institucionais reais cadastradas. Para validar a interpretação normativa, peça à CPPD que confirme períodos, fonte e forma de contagem; o teste funcional não substitui essa confirmação.

# 22 Conferir navegação e padrão visual

Abra as telas em desktop e em uma largura próxima de 390 px, ou no celular pela rede local. Em outro dispositivo, localhost aponta para o próprio dispositivo; use o endereço do computador que executa o sistema.

## V01 Comparar cards com a tela de Usuários

Faça: Compare Usuários, Campi e comissões, Calendário e documentos, perfil, titulações e requisitos dos processos.

Confirme: Os cards usam fundo branco, borda suave e cantos arredondados. Campos e botões são consistentes; títulos, textos e ações mantêm hierarquia legível.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## V02 Conferir celular e textos longos

Faça: Abra menu, troque abas, expanda o formulário de diploma e o dos sete indicados. Use nomes e e-mails longos nos dados de teste.

Confirme: O conteúdo não vaza para fora da página. Tabelas rolam dentro de sua área e o menu permite chegar às ações. Os botões importantes continuam utilizáveis.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## V03 Conferir navegação e atualização

Faça: Vá à biblioteca pelo perfil, volte ao processo e selecione um diploma. Recarregue e use Voltar nos formulários e listas.

Confirme: A biblioteca é encontrável e a seleção atualiza os detalhes sem depender de recarga. Cancelar não salva mudança e voltar não duplica operação.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

## V04 Distinguir cache de erro funcional

Faça: Se o visual estiver antigo, use Ctrl + F5. Se o frontend estiver em modo de produção, confirme se houve build e reinício da instância que atende a porta 3000.

Confirme: O navegador carrega a versão atual. Não conclua que os arquivos não mudaram apenas porque uma aba manteve a versão antiga; registre endereço e imagem da versão observada.

Registro: [ ] A [ ] R [ ] B [ ] NT | Evidência: ____________________

Registre separadamente um defeito visual e um bloqueio funcional. Um nome de tipo ainda em inglês é uma inconsistência de apresentação; acesso a documentos de outra pessoa, pontuação errada ou decisão liberada sem requisito são defeitos críticos.

# 23 Registrar resultados e encerrar a rodada

A homologação só pode ser declarada completa para os cenários efetivamente executados. Não transforme bloqueio de preparação, dependência institucional ou teste não realizado em aprovação.

| Conferência de saída | Resultado e evidência |
|---|---|
| Login, sessão e isolamento de dados | ____________________________ |
| Progressão e Promoção com atualização funcional | ____________________________ |
| Datas e pontuação mínima reconhecida | ____________________________ |
| RSC com quatro pareceres e regra de três votos | ____________________________ |
| Recurso RSC com outra banca e etapa CPRSC | ____________________________ |
| Titular memorial e Titular tese até decisão final | ____________________________ |
| Sete indicados, defesa, reavaliação e prazos | ____________________________ |
| Assinaturas, versões e documentos gerados | ____________________________ |
| Cadastros, versões administrativas e celular | ____________________________ |

Para relatar uma falha, preencha:
Código do teste e título: ______________________________________________
Perfil e conta de teste: _______________________________________________
Processo e endereço da página: _______________________________________
Passos executados: __________________________________________________
Resultado esperado: __________________________________________________
Resultado observado e mensagem: ____________________________________
Captura ou arquivo de evidência: ______________________________________

Pare a conclusão de um caso se encontrar acesso indevido, mudança funcional incorreta, cálculo errado, perda de arquivo ou decisão liberada sem requisito. Guarde as evidências antes de repetir a ação. Continue os testes independentes quando isso não prejudicar o registro da falha.

Resumo da rodada
Aprovados ____  Reprovados ____  Bloqueados ____  Não testados ____
Pendências críticas: __________________________________________________
Responsável pela conferência: ____________________  Data: ____/____/______
