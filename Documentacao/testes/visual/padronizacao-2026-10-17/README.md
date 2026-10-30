# Padronização visual do SEC-EBTT

Concluída em 17/10/2026, usando a tela de Usuários como referência.

## Ajustes aplicados

- Campi e comissões nos módulos Administrador e CPPD: cards brancos, bordas suaves, cantos de 16 px, campos arredondados e ações principais em botões pretos com formato de pílula.
- Listagem de Campi com tabela em superfície branca e formulário alinhado ao topo. A seleção da comissão mantém um contorno mais forte para indicar o item ativo.
- Lista de comissões com rolagem própria e altura limitada, mantendo os detalhes acessíveis em telas menores.
- Calendário, modelos e documentos obrigatórios com o mesmo padrão de cards, campos e botões.
- Perfil do docente com dados pessoais e funcionais em cards e biblioteca de titulações padronizada. Informações funcionais e perfis de acesso preservados; data do interstício exibida em português.
- Painéis compartilhados de requisitos, documentação, assinaturas e recursos com bordas, fundos e botões consistentes.
- Estilos compartilhados para campos e botões; variável do fundo secundário vinculada à paleta existente.

## Verificação

Build de produção e verificação de tipos aprovados na cópia de teste e no repositório original, incluindo Turbopack. A conferência no navegador usou desktop de 1440 × 1000 e celular de 390 × 844, com dados sintéticos no banco isolado. Foram verificadas as abas, a abertura de edição, a biblioteca, o formulário de diploma e a expansão dos sete indicados. Não houve envio de alterações de cadastro ou decisões durante essa conferência visual.

Nas telas verificadas em celular, a largura útil e a largura do conteúdo foram ambas de 375 px; as tabelas preservam rolagem dentro do card. A amostra de card da comissão apresentou fundo branco, borda #e5e5e5 e raio de 16 px, como na referência.

## Imagens

- [Campi e comissões CPPD em desktop](11-cppd-comissoes-desktop.png)
- [Campi e comissões CPPD no celular](12-cppd-comissoes-celular.png)
- [Campi](03-campi-desktop.png)
- [Calendário e documentos](05-calendario-desktop.png)
- [Perfil e titulações](07-perfil-titulacoes-desktop.png)
- [Requisitos do processo](09-requisitos-processo-desktop.png)
- [Detalhes das verificações](verificacoes.json)
