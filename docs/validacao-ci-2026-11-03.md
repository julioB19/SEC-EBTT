# Validação equivalente ao CI — 03/11/2026

Workflow conferido: `.github/workflows/main.yml`.
Ambiente: Ubuntu 24.04, Node 22.23.3, npm 10.9.9, MySQL 8 e LibreOffice 24.2, com instalação limpa e banco exclusivo de testes. O sistema local e o banco dos testes manuais foram preservados.

| Diretório | Comando | Resultado |
| --- | --- | --- |
| backend | npm ci | Aprovado |
| backend | npm run test:unit | 259 testes aprovados, 38 suítes |
| backend | npm run test:db:setup | Migrações e carga inicial aprovadas |
| backend | npm run test:coverage | 277 testes aprovados, 44 suítes |
| backend | npm run build | Aprovado; verificação adicional ao workflow |
| frontend | npm ci | Aprovado |
| frontend | npm test | Tipos, padrão de interface e 24 testes aprovados |
| frontend | npm run build | Aprovado, com BACKEND_URL usado pelo CI |
| repositório | git diff --check | Sem problemas de espaços nas alterações |

Cobertura do núcleo regulatório: linhas/instruções 88,18%; funções 98,24%; ramificações 70,68%. Limites do workflow: 80%, 80% e 60%, respectivamente.

Foram ajustadas as fixtures de integração para selecionar campus e configurar explicitamente o domínio institucional usado nos cadastros. A preparação de avaliadores usa o e-mail correspondente ao destinatário e cria as contas sequencialmente, evitando interferência entre convites e conflitos transacionais durante a preparação. O teste específico de inclusão concorrente de membro na comissão permanece ativo e passou.

Estes resultados correspondem à execução local dos comandos do workflow em ambiente Linux equivalente. A execução hospedada no GitHub ocorrerá quando as alterações forem enviadas. Todos os arquivos novos necessários precisam acompanhar o commit, incluindo os testes, os componentes, os scripts e as migrações.