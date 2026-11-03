const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src');
const sharedControls = new Set(['FormInput.tsx', 'FormControls.tsx', 'ActionButton.tsx']);
const issues = [];
const counts = { pages: 0, inputs: 0, selects: 0, textareas: 0 };
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
for (const filename of files(sourceRoot).filter(filename => filename.endsWith('.tsx'))) {
  const text = fs.readFileSync(filename, 'utf8');
  const relative = path.relative(sourceRoot, filename);
  const shared = filename.startsWith(path.join(sourceRoot, 'components/ui') + path.sep) && sharedControls.has(path.basename(filename));
  if (path.basename(filename) === 'page.tsx') counts.pages++;
  if (/window\.(alert|confirm|prompt)\s*\(/.test(text)) issues.push(`${relative}: use o diálogo compartilhado em vez do diálogo do navegador.`);
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute).map(attr => attr.name.getText(source));
      if (tag === 'FormInput') counts.inputs++;
      if (tag === 'FormSelect') counts.selects++;
      if (tag === 'FormTextarea') counts.textareas++;
      if (!shared && ['input', 'select', 'textarea'].includes(tag)) issues.push(`${relative}: campo ${tag} sem a validação e o feedback compartilhados.`);
      if (!shared && tag === 'button' && attrs.includes('disabled')) issues.push(`${relative}: botão bloqueado sem o componente de dica compartilhado.`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log(`Padrão de interface conferido: ${counts.pages} rotas, ${counts.inputs} entradas, ${counts.selects} seletores e ${counts.textareas} áreas de texto. Nenhuma exceção encontrada.`);
