# SEC-EBTT

Sistema de apoio à CPPD do IFFar na tramitação dos processos de carreira docente EBTT: Progressão, Promoção, Reconhecimento de Saberes e Competências (RSC) e Promoção à Classe Titular.

Este repositório é a versão desenvolvida no TCC II de Julio Cesar da Rocha Barratto, *Desenvolvimento de módulos para RSC e Promoção à Classe Titular na carreira EBTT no software SEC-EBTT*. Ela parte do [SEC-EBTT de Diogo Basso](https://github.com/DiogoBasso/SEC-EBTT), que implementou a base de Progressão e Promoção, e acrescenta os fluxos de RSC e Classe Titular: critérios versionados, comprovantes em PDF, Comissão Especial, pareceres, defesas, recursos e documentos do processo.

A aplicação usa Next.js/React no frontend, Node.js com Express e TypeScript no backend, Prisma e MySQL 8.

## Pré-requisitos

- [Node.js](https://nodejs.org/en/download/prebuilt-installer)
- [MySQL 8](https://dev.mysql.com/downloads/mysql/) ou [Docker Compose](https://docs.docker.com/compose/install/)
- LibreOffice, para a conversão de alguns documentos gerados pelo sistema

## Instalação

Clone o repositório:

```bash
git clone https://github.com/julioB19/SEC-EBTT.git
cd SEC-EBTT
```

Instale as dependências do backend e do frontend:

```bash
cd backend
npm install
npm run husky:init
cd ../frontend
npm install
```

Crie um arquivo `.env` em `backend/` e outro em `frontend/` a partir dos respectivos `.env.example`. A `DATABASE_URL` de exemplo conecta ao MySQL do `backend/docker-compose.yaml`. Para usar um MySQL instalado na máquina, ajuste o usuário e a senha na URL.

Defina `CPF_ENCRYPTION_KEY` no `.env` do backend com uma chave aleatória de pelo menos 32 caracteres. Preserve essa chave entre implantações: sem ela, os CPFs criptografados não podem ser lidos.

## Banco de dados

Os comandos abaixo rodam em `backend/`.

Inicie o MySQL pelo Docker e aguarde o healthcheck:

```bash
npm run db:up
```

Aplique as migrações versionadas:

```bash
npm run migrate:deploy
```

Para consultar o estado das migrações sem alterar o banco, use `npm run migrate:status`. Em desenvolvimento, `npm run migrate` cria e aplica novas migrações.

Ao atualizar um banco que já tinha usuários antes da criptografia de CPF, execute uma vez `npm run migrate:cpf`.

## Executar

Backend, em `backend/`:

```bash
npm run start:dev
```

Frontend, em `frontend/`:

```bash
npm run dev
```

O frontend abre em `http://localhost:3000` e o backend responde em `http://localhost:3333`.

## Base demonstrativa

Para avaliar o sistema com dados fictícios, carregue os cenários de demonstração em `backend/`:

```bash
npm run seed:demo
```

A carga prepara a base (perfis, campus, tipos de processo e catálogos), cria 22 contas e 12 processos, três de cada tipo, e gera o guia `backend/tmp/demo/GUIA-ORIENTADOR.md` com o CPF, a senha inicial, o perfil e o número do processo de cada cenário. Os cenários prioritários do TCC II são:

- **DEMO-RSC-3:** processo de RSC-III em avaliação pela Comissão Especial.
- **DEMO-FULL_PROFESSOR-2:** processo de Classe Titular por memorial, com análise prévia, comissão, defesa, ata e recurso.

O guia [Base demonstrativa](docs/base-demonstrativa.md) explica os dados carregados, o reset (`npm run db:reset:demo`) e os backups. O [manual de uso](docs/manual-uso/Manual_de_Uso_SEC_EBTT.pdf) mostra as tarefas de cada perfil. Os dados, documentos e assinaturas da demonstração são fictícios.

## Testes

Em `backend/`:

```bash
npm run test:unit
```

Os testes de integração (`npm run test:integration`) precisam de um banco de teste exclusivo, preparado com `npm run test:db:setup`. `npm run test:demo` valida a carga demonstrativa em um banco temporário.

Em `frontend/`:

```bash
npm test
```

## Documentação

- [Requisitos completos](Documentacao/requisitos-completos-sec-ebtt.md)
- [Vocabulário e invariantes do domínio](CONTEXT.md)
- [Como testar manualmente](Documentacao/como-testar-manualmente.md)
- [Checklist de adequação à CPPD](Documentacao/checklist-adequacao-cppd.md)
- [Regulamentos e modelos oficiais usados como referência](Documentacao/reference/)

Após atualizar para uma versão nova, regenere o cliente Prisma com `npx prisma generate` e aplique as migrações com `npm run migrate:deploy`. Em bancos com dados de uso, faça um backup antes e não execute as seeds de teste.

O calendário institucional é cadastrado por Administrador ou CPPD Central em “Calendário e documentos”. As assinaturas são feitas na plataforma institucional, e o sistema recebe os documentos assinados para conferência da CPPD.

## Fora do escopo

GECC, Licença Capacitação, RT, Desenvolvimento em Serviço, processos administrativos genéricos e integrações automáticas com SIPAC/SIMEC não fazem parte desta versão.
