const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const frontend=path.resolve(__dirname,'..');
const req=Module.createRequire(path.join(frontend,'package.json'));
const {JSDOM}=req('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLTextAreaElement','HTMLDialogElement','Event','MouseEvent','KeyboardEvent','FocusEvent'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
const React=req('react'),{act}=React,{createRoot}=req('react-dom/client'),ts=req('typescript');
const loaded=new Map();
function load(name,from=path.join(frontend,'src/index.ts')){
 const base=name.startsWith('@/')?path.join(frontend,'src',name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(from),name):null;
 if(!base)return name==='next/link'?{__esModule:true,default:props=>React.createElement('a',props)}:req(name);
 const filename=['','.ts','.tsx'].map(s=>base+s).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 if(!filename)throw Error('Módulo não encontrado: '+name);
 if(loaded.has(filename))return loaded.get(filename).exports;
 const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m.require=n=>load(n,filename);loaded.set(filename,m);
 m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,filename);return m.exports;
}
const FormInput=load('@/components/ui/FormInput').default;
const {FormSelect,FormTextarea}=load('@/components/ui/FormControls');
const ConfirmModal=load('@/components/ConfirmModal').default;
const Modal=load('@/components/Modal').default;
const Provider=load('@/components/AppFeedbackProvider').default;
const UserList=load('@/app/admin/usuarios/page').default;
const {useFeedbackState}=load('@/hooks/useFeedbackState');
const bus=load('@/lib/feedback');
let container,root;
const h=React.createElement;
beforeEach(()=>{bus.cancelFallbackFeedback();while(bus.feedbackSnapshot())bus.dismissFeedback();container=document.createElement('div');document.body.append(container);root=createRoot(container)});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();bus.cancelFallbackFeedback();while(bus.feedbackSnapshot())bus.dismissFeedback()});
async function render(element){await act(async()=>root.render(element))}
async function click(element){await act(async()=>element.click())}
async function input(element,value){await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}))})}

test('CPF digitado recebe máscara, crítica e validade real no formulário',async()=>{
 function Form(){const [value,setValue]=React.useState('');return h('form',null,h(FormInput,{fieldKind:'cpf',value,onChange:e=>setValue(e.target.value),required:true,'aria-label':'CPF'}))}
 await render(h(Form));const field=container.querySelector('input');await input(field,'11111111111');assert.equal(field.value,'111.111.111-11');assert(!field.validity.valid);await input(field,'52998224725');assert.equal(field.value,'529.982.247-25');assert(field.validity.valid);
});
test('correção programática de um campo elimina a crítica e a validade obsoletas',async()=>{
 await render(h(FormInput,{fieldKind:'cpf',value:'111.111.111-11',onChange(){}}));let field=container.querySelector('input');await act(async()=>{field.focus();field.blur()});assert(!field.validity.valid);
 await render(h(FormInput,{fieldKind:'cpf',value:'529.982.247-25',onChange(){}}));field=container.querySelector('input');assert(field.validity.valid,'Correção feita por carregamento não pode manter o bloqueio antigo');assert(!container.textContent.includes('CPF inválido'));
});
test('seletor obrigatório usa o aviso centralizado em vez do balão nativo',async()=>{
 await render(h(FormSelect,{required:true,defaultValue:'','aria-label':'Tipo de processo'},h('option',{value:''},'Selecione'),h('option',{value:'RSC'},'RSC')));
 const field=container.querySelector('select');await act(async()=>field.checkValidity());assert(bus.feedbackSnapshot(),'O seletor inválido precisa publicar a crítica');assert.equal(bus.feedbackSnapshot().kind,'error');
});
test('texto obrigatório usa o mesmo aviso de validação',async()=>{
 await render(h(FormTextarea,{required:true,'aria-label':'Parecer'}));await act(async()=>container.querySelector('textarea').checkValidity());assert.equal(bus.feedbackSnapshot()?.kind,'error');
});
test('textarea somente para consulta também explica seu bloqueio',async()=>{
 await render(h(FormTextarea,{readOnly:true,value:'Parecer enviado',disabledReason:'O parecer já foi enviado.'}));assert.equal(container.querySelector('[role="tooltip"]')?.textContent,'O parecer já foi enviado.');
});
test('a mesma crítica pode ser apresentada novamente em outra tentativa',async()=>{
 function Form(){const [,setError]=useFeedbackState('', 'error');return h(Provider,null,h('button',{onClick:()=>setError('Confira os dados do processo.')},'Validar'))}
 await render(h(Form));await click(container.querySelector('button'));assert(bus.feedbackSnapshot());await click(container.querySelector('dialog button'));assert.equal(bus.feedbackSnapshot(),null);await click(container.querySelector('button'));assert(bus.feedbackSnapshot(),'Uma crítica repetida não pode desaparecer silenciosamente');
});
test('avisos de duas ações próximas não se apagam mutuamente',()=>{
 bus.notifyFeedback('Primeira ação salva.','success');bus.notifyFeedback('Segunda ação salva.','success');assert.equal(bus.feedbackSnapshot().message,'Primeira ação salva.');bus.dismissFeedback();assert.equal(bus.feedbackSnapshot()?.message,'Segunda ação salva.');
});
test('sucesso independente depois de um erro continua disponível',()=>{
 bus.notifyFeedback('Erro na primeira ação.','error');bus.notifyFeedback('Segunda ação salva.','success');assert.equal(bus.feedbackSnapshot().kind,'error');bus.dismissFeedback();assert.equal(bus.feedbackSnapshot()?.message,'Segunda ação salva.');
});
test('dois retornos automáticos de gravação são preservados',async()=>{
 bus.scheduleFallbackFeedback('Primeira gravação concluída.','success');bus.scheduleFallbackFeedback('Falha na segunda gravação.','error');await new Promise(resolve=>setTimeout(resolve,400));assert.equal(bus.feedbackSnapshot()?.message,'Primeira gravação concluída.');bus.dismissFeedback();assert.equal(bus.feedbackSnapshot()?.message,'Falha na segunda gravação.');
});
test('diálogo de informação recebe foco e o devolve após fechar',async()=>{
 function Form(){const [open,setOpen]=React.useState(false);return h(React.Fragment,null,h('button',{onClick:()=>setOpen(true)},'Salvar'),h(Modal,{open,title:'Ação confirmada',message:'Registro salvo.',onClose:()=>setOpen(false)}))}
 await render(h(Form));const opener=container.querySelector('button');opener.focus();await click(opener);assert(container.querySelector('dialog[open]'));assert.equal(document.activeElement.textContent,'Entendi');await click(container.querySelector('dialog button'));assert.equal(document.activeElement,opener);
});
test('confirmação e aviso compartilham o diálogo com contenção de foco nativa',async()=>{
 await render(h(ConfirmModal,{open:true,title:'Confirmar a ação?',onCancel(){},onConfirm(){}}));assert(container.querySelector('dialog[open]'),'A confirmação também deve utilizar o diálogo padrão');
});
test('confirmação ocupada impede fechamento por Escape',async()=>{
 let canceled=0;await render(h(ConfirmModal,{open:true,title:'Confirmar a ação?',loading:true,onCancel(){canceled++},onConfirm(){}}));let event=new Event('cancel',{cancelable:true});await act(async()=>container.querySelector('dialog').dispatchEvent(event));assert(event.defaultPrevented);assert.equal(canceled,0);assert([...container.querySelectorAll('button')].every(button=>button.disabled));
});

test('pesquisa livre mantém nomes, e-mails e partes de CPF sem máscara restritiva',async()=>{
 function Search(){const [value,setValue]=React.useState('');return h(FormInput,{type:'search',value,onChange:e=>setValue(e.target.value),'aria-label':'Buscar usuários'})}
 await render(h(Search));const field=container.querySelector('input');await input(field,'Marina 123 email@if.edu.br');assert.equal(field.value,'Marina 123 email@if.edu.br');assert(field.validity.valid);
});

test('dica de bloqueio sai da área recortada da tabela e funciona pelo teclado',async()=>{
 await render(h('div',{style:{overflow:'hidden',height:20}},h(FormInput,{disabled:true,value:'CPF','aria-label':'CPF',disabledReason:'O CPF identifica a conta e não pode ser alterado.'})));
 const anchor=container.querySelector('[role="group"]');await act(async()=>anchor.focus());const tip=document.getElementById(anchor.getAttribute('aria-describedby'));assert.equal(tip.parentElement,document.body);assert.equal(tip.style.position,'fixed');assert.equal(tip.textContent,'O CPF identifica a conta e não pode ser alterado.');await act(async()=>anchor.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert(container.querySelector('[role="tooltip"].sr-only'));
});

test('bloqueios de avaliação retornados pelo servidor aparecem em português',()=>{
 bus.notifyFeedback('Process is not available for CPPD evaluation','error');assert.match(bus.feedbackSnapshot().message,/ainda não está disponível para avaliação da CPPD/);
});

test('a tela real de usuários filtra o nome digitado sem perder letras',async()=>{
 const original=global.fetch;global.fetch=async()=>Response.json({status:'success',data:[{idUser:1,name:'Marina Lopes',email:'marina@example.edu.br',cpf:'52998224725',active:true,roles:['CPPD_MEMBER'],docenteProfile:{siape:'12345'}},{idUser:2,name:'Outro docente',email:'outro@example.edu.br',cpf:'11144477735',active:true,roles:['DOCENTE'],docenteProfile:{siape:'98765'}}]});
 try {await render(h(UserList));const search=container.querySelector('input[type="search"]');await input(search,'Marina');assert.equal(search.value,'Marina');assert(container.querySelector('tbody').textContent.includes('Marina Lopes'));assert(!container.querySelector('tbody').textContent.includes('Outro docente'));} finally {global.fetch=original}
});

test('Escape de uma confirmação disponível solicita o cancelamento padrão',async()=>{
 let canceled=0;await render(h(ConfirmModal,{open:true,title:'Confirmar?',onCancel(){canceled++},onConfirm(){}}));await act(async()=>container.querySelector('dialog').dispatchEvent(new Event('cancel',{cancelable:true})));assert.equal(canceled,1);
});
