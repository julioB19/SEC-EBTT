export default {
  client: {
    // Opção 1: Acesso direto ao banco local
    adapter: {
      provider: "mysql",
      url: process.env.DATABASE_URL!,
    },
  },
  migrate: {
    // De onde o migrate vai pegar a connection string
    connectionString: process.env.DATABASE_URL!,
  },
} as const
