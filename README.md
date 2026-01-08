
### Pré-requisitos

- [Node.js](https://nodejs.org/en/download/prebuilt-installer)
- [MySQL](https://www.oracle.com/mysql/technologies/mysql-enterprise-edition-downloads.html) ou [Docker compose](https://docs.docker.com/compose/install/)

### Primeiros passos

Clone o repositorio com o seguinte comando:
```bash
git clone https://github.com/DiogoBasso/TCC.git
```

### Configurando o ambiente

Acesse o diretório em sua IDE de preferencia e insira o seguinte comando para instalar as dependencias:
```bash
npm install

npm run husky:init
```

Crie um arquivo `.env` e copie o conteúdo do arquivo `.env.example`, adaptando conforme necessidade. O arquivo de exemplo contém a DATABASE_URL para se conectar ao banco usando um container docker a partir do arquivo docker-compose.yaml. 

> Caso queira usar o MySQL instalado na máquina, altere o usuário e a senha na URL de conexão.

Inicie o container do docker:
```
docker compose up
```

Em seguida, execute as migrações do Prisma:
```bash
npm run migrate
```

### Teste Manual

Inicie a aplicação em mode de desenvolvimento:
```bash
npm run start:dev
```

Para popular o banco de dados:
```bash
npm run seeds
```
