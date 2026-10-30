
### Pré-requisitos

- [Node.js](https://nodejs.org/en/download/prebuilt-installer)
- [MySQL](https://www.oracle.com/mysql/technologies/mysql-enterprise-edition-downloads.html) ou [Docker compose](https://docs.docker.com/compose/install/)

### Primeiros passos

Clone o repositorio com o seguinte comando:
```bash
git clone https://github.com/DiogoBasso/SEC-EBTT.git
```

### Configurando o ambiente

Acesse o diretório em sua IDE de preferencia e insira o seguinte comando para instalar as dependencias:
```bash
npm install

npm run husky:init
```

Crie um arquivo `.env` e copie o conteúdo do arquivo `.env.example` (frontend e backend), adaptando conforme necessidade. O arquivo de exemplo do backend contém a DATABASE_URL para se conectar ao banco usando um container docker a partir do arquivo docker-compose.yaml. 

> Caso queira usar o MySQL instalado na máquina, altere o usuário e a senha na URL de conexão.

Inicie o banco e aguarde o healthcheck:
```
cd backend
npm run db:up
```

Em desenvolvimento, crie/aplique as migrações do Prisma:
```bash
npm run migrate
```

Para aplicar migrations já versionadas, inclusive em homologação ou produção, use o comando não interativo:
```bash
npm run migrate:deploy
```

O estado da cadeia pode ser consultado sem alterar o banco:
```bash
npm run migrate:status
```

Defina `CPF_ENCRYPTION_KEY` no `.env` do backend com uma chave aleatória de pelo menos 32 caracteres. Essa chave deve ser preservada entre implantações; sua perda impede a leitura dos CPFs criptografados.

Ao atualizar um banco que já contém usuários, execute uma vez a migração dos CPFs legados:
```bash
npm run migrate:cpf
```

### Teste Manual

Inicie o backend em modo de desenvolvimento:
```bash
npm run start:dev
```

Para popular o banco de dados:
```bash
npm run seeds
```

Inicie o frontend em modo de desenvolvimento:
```bash
npm run dev
```


### Conclusão dos quatro processos — 17/10/2026

Consulte [o checklist atualizado](Documentacao/checklist-adequacao-cppd.md) e [as instruções das funções acrescentadas](Documentacao/conclusao-quatro-processos-2026-10-17.md).

Após obter esta versão, regenere o cliente Prisma com `npx prisma generate` e aplique as migrações versionadas com `npm run migrate:deploy`. Em bancos existentes, faça uma cópia de segurança antes da atualização. Não execute seeds de teste sobre dados de uso.

O calendário institucional deve ser cadastrado por Administrador ou CPPD Central em “Calendário e documentos”. Assinaturas são realizadas na plataforma institucional e recebidas pelo sistema para conferência da CPPD.
