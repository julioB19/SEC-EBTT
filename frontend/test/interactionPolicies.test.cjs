const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const loaded = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '../src', relative);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), name + '.ts'))) : original(name);
  loaded.set(filename, mod);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  return mod.exports;
}
const input = load('utils/inputValidation.ts');
const bus = load('lib/feedback.ts');
const { clientFetch, isUserMutation } = load('lib/clientFetch.ts');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; delete global.window; bus.cancelFallbackFeedback(); while (bus.feedbackSnapshot()) bus.dismissFeedback(); });

test('CPF: verifica dígitos, recusa repetições e aceita endereço formatado', () => {
  for (const cpf of ['52998224725', '11144477735', '65033520008']) assert(input.validCpf(cpf));
  for (const cpf of ['11111111111', '12345678900', '123', '52998224724']) assert(!input.validCpf(cpf));
  assert.equal(input.formatField('52998224725', 'cpf'), '529.982.247-25');
  assert(input.validCpf('529.982.247-25'));
  assert(input.fieldError('529.982.247-24', 'cpf').includes('CPF inválido'));
});
test('máscaras de telefone, CEP, UF e SIAPE preservam o formato esperado', () => {
  assert.equal(input.formatField('55999999999', 'phone'), '(55) 99999-9999');
  assert.equal(input.formatField('5532223333', 'phone'), '(55) 3222-3333');
  assert.equal(input.formatField('rs', 'uf'), 'RS');
  assert.equal(input.formatField('12a34', 'siape'), '1234');
  assert.equal(input.formatField('97105000', 'cep'), '97105-000');
  assert(input.fieldError('XX', 'uf'));
  assert(input.fieldError('(55) 12', 'phone'));
});
test('distingue gravações de leituras, renovação de sessão e chamadas externas', () => {
  global.window = { location: { origin: 'http://localhost:3000' } };
  assert(isUserMutation('/api/sec-ebtt/cases/15/signatures', { method: 'POST' }));
  assert(isUserMutation('/api/admin/usuarios/1', { method: 'DELETE' }));
  assert(!isUserMutation('/api/processos/15', { method: 'GET' }));
  assert(!isUserMutation('/api/auth/refresh', { method: 'POST' }));
  assert(!isUserMutation('/api/acesso/status', { method: 'POST' }));
  assert(!isUserMutation('https://other.example/api/test', { method: 'POST' }));
});
test('confirma gravação, mantém FormData intacto e não consome a resposta do chamador', async () => {
  global.window = { location: { origin: 'http://localhost:3000' } };
  const body = new FormData(); body.set('documentKind', 'CONSOLIDATED_OPINION');
  global.fetch = async (_url, init) => { assert.equal(init.body, body); assert(!init.headers); return Response.json({ status: 'success', message: 'Documento registrado.' }); };
  const response = await clientFetch('/api/sec-ebtt/cases/15/signatures', { method: 'POST', body });
  assert.equal((await response.json()).message, 'Documento registrado.');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(bus.feedbackSnapshot().kind, 'success');
});
test('falha nunca vira confirmação de sucesso', async () => {
  global.window = { location: { origin: 'http://localhost:3000' } };
  global.fetch = async () => Response.json({ status: 'INVALID_INPUT', message: 'Registre e valide o parecer consolidado.' }, { status: 400 });
  await clientFetch('/api/cppd/processos/15/comissao/decisao', { method: 'POST' });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(bus.feedbackSnapshot().kind, 'error');
  assert.match(bus.feedbackSnapshot().message, /consolidado/);
});
test('a mensagem específica substitui a confirmação genérica, sem dois popups', async () => {
  global.window = { location: { origin: 'http://localhost:3000' } };
  global.fetch = async () => Response.json({ status: 'success' });
  await clientFetch('/api/processos/15', { method: 'PUT' });
  bus.notifyFeedback('Dados do processo salvos.', 'success');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(bus.feedbackSnapshot().message, 'Dados do processo salvos.');
  bus.dismissFeedback();
  assert.equal(bus.feedbackSnapshot(), null);
});
test('cancelamento de requisição não apresenta erro de comunicação', async () => {
  global.window = { location: { origin: 'http://localhost:3000' } };
  global.fetch = async () => { throw new DOMException('cancelled', 'AbortError'); };
  await assert.rejects(clientFetch('/api/processos/15', { method: 'PUT' }), { name: 'AbortError' });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(bus.feedbackSnapshot(), null);
});
