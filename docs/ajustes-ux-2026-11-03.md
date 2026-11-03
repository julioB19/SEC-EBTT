# Ajustes de usabilidade do SEC-EBTT

Fonte: [Ajustes SEC-EBTT no Notion](https://app.notion.com/p/40ddc7267a4280bfaaf8cf81afe7b470).

Implementação local em 3 de novembro de 2026, sobre o checkout já utilizado pelo usuário. As alterações anteriores foram preservadas.

## Cobertura dos pedidos

| Pedido | Implementação |
| --- | --- |
| Voltar como padrão | Controle compartilhado nos layouts dos quatro módulos e nas telas públicas de cadastro, recuperação e perfil. O destino é uma página interna conhecida, inclusive em acesso direto. As páginas iniciais dos módulos não exibem um retorno circular. Cancelar edição continua disponível nos formulários que já o ofereciam. |
| Avisos centralizados | Componente Modal único para mensagens de sucesso, erro e informação, com diálogo central, foco no botão, fechamento por Escape e restauração do foco. Os avisos soltos de estado foram integrados ao mesmo canal. |
| Confirmação de ações | Cliente de requisições comum confirma mutações concluídas e apresenta falhas, preservando o corpo e a resposta da requisição. Uma mensagem específica da tela substitui o aviso genérico. Renovações de sessão, leituras de situação e chamadas de identidade não produzem confirmações de gravação. |
| Máscaras e críticas | Campos comuns com CPF formatado e dígitos verificadores, telefone com DDD, UF, SIAPE numérico, códigos de seis dígitos e suporte a CEP. Datas e números mantêm as restrições de seus formulários. O servidor continua validando os dados. |
| Processos por etapas | Guias nas telas de abertura, detalhes, pontuação, avaliação da CPPD, parecer e comissão. A abertura tem três blocos numerados; avaliação e parecer da CPPD também identificam suas etapas. O fluxo de Meu parecer permanece em três passos. |
| Motivos dos bloqueios | Botões, entradas, seletores e áreas de texto bloqueados usam a mesma dica, acessível com mouse e teclado. As mensagens explicam espera, edição em andamento, documentação, escolha anterior, falta de perfil ou restrição da etapa. CPF somente para consulta tem explicação própria. |
| Responsáveis nos históricos | Histórico documental passa a mostrar ação, data e hora e nome do responsável. A consulta busca apenas ID e nome dos autores dos eventos acessíveis no processo. Registros antigos sem autor resolvido são identificados sem inventar um responsável. O histórico do rito de Titular mantém o autor e apresenta ações em português. |

## Correções encontradas na validação

- Telefone opcional vazio agora pode ser mantido ou retirado no perfil sem rejeitar null. O cadastro público continua exigindo telefone.
- Críticas genéricas de preenchimento retornadas pelo servidor são apresentadas em português.
- Falha de conexão no login informa o erro e libera uma nova tentativa.
- Funções da comissão na lista de avaliações são apresentadas em português.

## Verificação completa das rotas e dos componentes

- Navegação no sistema local: todas as 46 rotas de página foram percorridas, com 55 registros de tela/estado, usando administrador, CPPD local, CPPD Central, docente, avaliador externo e acesso sem sessão. Acesso negado e indisponibilidade por situação do processo também foram conferidos.
- Interface: compilação de tipos, verificação do padrão e 24 testes automatizados aprovados, executáveis por npm test no frontend. Os testes usam componentes reais com React e DOM, incluindo a tela real de pesquisa por usuários.
- Conferência do código: 238 entradas, 42 seletores, 14 áreas de texto e seis guias de processo. Nenhum campo nativo ou botão nativo bloqueado fora dos componentes compartilhados, nem alerta/confirmação/prompt nativo do navegador. A verificação passa a fazer parte de npm test, por meio de npm run check:ux.
- Regressões cobertas: CPF inválido e correção programática, seletor/texto obrigatório, repetição da mesma crítica, avisos próximos de ações distintas, falhas sem confirmação falsa, preservação de FormData, restauração do foco, Escape durante gravação, dicas fora de áreas recortadas e busca por nome preservando letras.
- Servidor: permanecem aprovados os 259 testes em 38 suítes executados na primeira etapa, incluindo autoria do histórico e telefone opcional. Esta revisão complementar alterou apenas a interface e seus testes.
- Evidência detalhada: [rotas, estados e critérios conferidos](evidencias/ux-2026-11-03.json).

## Exceções corrigidas na revisão complementar

- Removidos controles Voltar duplicados na edição de usuários/docentes e na gestão de campi/comissões.
- Incluído o retorno também na etapa inicial de conclusão do convite.
- Todos os seletores e áreas de texto passaram a apresentar a crítica central em português.
- Unificados os popups de confirmação e os avisos em um diálogo nativo compartilhado, com contenção do foco e bloqueio de fechamento enquanto a gravação ocorre.
- Aceite/recusa de avaliação, motivo de recusa, recuperação de acesso e remoção de membro da comissão deixam de usar caixas nativas do navegador.
- Corrigidas críticas repetidas que não reapareciam e avisos próximos que se substituíam.
- Corrigida a validade obsoleta de campos após correção por carregamento ou atualização de dados.
- Corrigida a máscara de CPF aplicada indevidamente às buscas livres de usuários da administração e da CPPD.
- Corrigidos estados de avaliação/parecer indisponível, antes com mensagens em inglês ou conteúdo sem orientação após fechar o aviso.
- A atualização da prévia só informa sucesso quando realmente retorna dados; sua consulta inicial não é tratada como gravação.
- Dicas de bloqueio passam a ser exibidas fora do recorte de tabelas/painéis, também pelo teclado.
- Corrigido o bloqueio da seleção de módulo após falha de conexão e o foco do seletor de perfil ao pressionar Escape com seu menu fechado.

A cobertura manual se refere às rotas e aos estados existentes na base demonstrativa. A avaliação de carreira, sem processo enviado nessa base, foi conferida em seu estado indisponível; a seleção de múltiplos perfis não tinha conta demonstrativa correspondente. As validações e os componentes compartilhados são exercitados separadamente nos testes. Isso não representa testar manualmente todas as combinações possíveis de permissão e etapa de negócio.

Nenhum processo novo foi criado ou submetido nesta revisão. O processo demonstrativo 15 permaneceu deferido com 64 pontos. Não houve alteração das regras de decisão nem das permissões. A sessão foi restaurada para a conta demonstrativa da CPPD local.
