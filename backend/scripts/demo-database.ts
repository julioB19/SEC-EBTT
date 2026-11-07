import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { createHash, randomUUID } from "crypto"
import { spawnSync } from "child_process"
import fs from "fs"
import path from "path"

export function assertResetTarget(value = process.env.DATABASE_URL) {
  if (!value) throw new Error("DATABASE_URL não configurada")
  const url = new URL(value)
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    (url.port && url.port !== "3306") || url.pathname !== "/TCC" || url.search) {
    throw new Error("Reset permitido somente no banco local TCC, porta 3306, sem parâmetros adicionais")
  }
  return url
}

export function run(program: string, args: string[], options: { input?: Buffer | string; stdinFile?: string; stdoutFile?: string; env?: NodeJS.ProcessEnv; cwd?: string } = {}) {
  const input = options.stdinFile ? fs.openSync(options.stdinFile, "r") : "pipe"
  const output = options.stdoutFile ? fs.openSync(options.stdoutFile, "wx") : "pipe"
  try {
    const result = spawnSync(program, args, { cwd: options.cwd ?? process.cwd(), windowsHide: true, input: options.input,
      env: options.env ?? process.env, stdio: [input, output, "pipe"], maxBuffer: 128 * 1024 * 1024, timeout: 300000 })
    if (result.error || result.status !== 0) {
      // Nunca imprimir a conexão ou o arquivo de autenticação nos erros.
      throw new Error(`Falha ao executar ${path.basename(program)} ${args[0] ?? ""}: ${result.error?.message ?? result.stderr?.toString().slice(-3000) ?? result.status}`)
    }
    return result.stdout?.toString() ?? ""
  } finally {
    if (typeof input === "number") fs.closeSync(input)
    if (typeof output === "number") fs.closeSync(output)
  }
}

export function dockerExecutable() {
  const windows = "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"
  return process.env.DEMO_DOCKER_PATH ?? (process.platform === "win32" && fs.existsSync(windows) ? windows : "docker")
}

export async function withMysqlTools<T>(url: URL, directory: string, action: (mysql: (args: string[], io?: { stdinFile?: string; stdoutFile?: string }) => string) => Promise<T>) {
  const docker = dockerExecutable()
  const container = "database"
  const ports = run(docker, ["port", container, "3306/tcp"])
  if (!ports.split(/\r?\n/).some(line => /:3306$/.test(line))) throw new Error("O contêiner database não expõe o MySQL local na porta 3306")
  const file = path.join(directory, `.mysql-${randomUUID()}.cnf`)
  const remote = `/tmp/sec-ebtt-demo-${randomUUID()}.cnf`
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")
  fs.writeFileSync(file, `[client]\nuser="${escape(decodeURIComponent(url.username))}"\npassword="${escape(decodeURIComponent(url.password))}"\n`, { flag: "wx", mode: 0o600 })
  try {
    run(docker, ["cp", file, `${container}:${remote}`])
    run(docker, ["exec", container, "chmod", "600", remote])
    return await action((args, io = {}) => run(docker, ["exec", "-i", container, args[0], `--defaults-extra-file=${remote}`, ...args.slice(1)], io))
  } finally {
    try { run(docker, ["exec", container, "rm", "-f", remote]) } finally { fs.unlinkSync(file) }
  }
}

export function databaseUrl(url: URL, name: string) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Nome de banco inválido")
  const target = new URL(url)
  target.pathname = `/${name}`
  return target.toString()
}

export async function tableCounts(prisma: PrismaClient) {
  const tables = await prisma.$queryRawUnsafe<Record<string, string>[]>("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")
  const counts: Record<string, number> = {}
  for (const row of tables) {
    const name = Object.values(row)[0]
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Nome de tabela inesperado")
    const result = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) AS count FROM \`${name}\``)
    counts[name] = Number(result[0].count)
  }
  return counts
}

export function fileInventory(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  if (!fs.existsSync(root)) return files
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error("O diretório de uploads não pode ser um link simbólico")
  function visit(dir: string) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name)
      if (item.isSymbolicLink()) throw new Error(`Upload com link simbólico não pode ser copiado: ${item.name}`)
      if (item.isDirectory()) visit(full)
      else files[path.relative(root, full)] = createHash("sha256").update(fs.readFileSync(full)).digest("hex")
    }
  }
  visit(root)
  return files
}

export function stopLocalApplication() {
  if (process.platform !== "win32") throw new Error("O reset local deve ser executado no Windows do projeto")
  const root = path.resolve(process.cwd(), "..").replace(/'/g, "''")
  const script = `$ErrorActionPreference='Stop'; $root='${root}'; $processes=@(Get-CimInstance Win32_Process -Filter "name='node.exe'"); $ids=@{}; foreach($p in $processes){if($p.ProcessId -ne ${process.pid} -and $p.CommandLine -and $p.CommandLine.Contains($root) -and $p.CommandLine -match '(nodemon|next|src[/\\\\]server|dist[/\\\\]src[/\\\\]server)'){$ids[$p.ProcessId]=$true}}; do{$added=$false; foreach($p in $processes){if($ids.ContainsKey($p.ParentProcessId) -and -not $ids.ContainsKey($p.ProcessId)){$ids[$p.ProcessId]=$true;$added=$true}}}while($added); foreach($id in $ids.Keys){Stop-Process -Id $id -Force -ErrorAction Stop}; Write-Output $ids.Count`
  const stopped = run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]).trim()
  console.log(`Aplicação local: ${stopped} processo(s) do projeto interrompido(s).`)
}
