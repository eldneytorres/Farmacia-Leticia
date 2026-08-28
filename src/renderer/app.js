'use strict';

const ROTULO_STATUS = {
  no_prazo: 'No prazo',
  proximo: 'Próximo do vencimento',
  vencido: 'Vencido',
  sem_validade: 'Sem validade',
};

let fotosNovas = []; // caminhos temporários de mídia a anexar no próximo salvamento

// ---------- Navegação ----------
function mostrarView(nome) {
  document.querySelectorAll('.nav-item').forEach((b) =>
    b.classList.toggle('ativo', b.dataset.view === nome));
  document.querySelectorAll('.view').forEach((v) =>
    v.classList.toggle('ativa', v.id === 'view-' + nome));
  if (nome === 'inicio') carregarInicio();
  if (nome === 'lista') carregarLista();
  if (nome === 'cadastro') prepararCadastro();
  if (nome === 'config') carregarConfig();
}

document.querySelectorAll('.nav-item').forEach((b) =>
  b.addEventListener('click', () => mostrarView(b.dataset.view)));

// ---------- Utilidades ----------
function fmtData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function textoValidade(med) {
  const dias = med.diasParaVencer;
  if (dias === null) return 'Sem validade';
  if (dias < 0) return `Venceu há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return 'Vence hoje';
  return `Vence em ${dias} dia(s) — ${fmtData(med.validade)}`;
}
function primeiraFoto(med) {
  if (med.fotos && med.fotos.length) {
    const nome = med.fotos.find((f) => !/\.(mov|mp4|m4v|webm)$/i.test(f)) || med.fotos[0];
    if (!/\.(mov|mp4|m4v|webm)$/i.test(nome)) return `farmaphoto://p/${nome}`;
  }
  return null;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- Início ----------
async function carregarInicio() {
  const resumo = await window.api.resumo();
  document.getElementById('r-total').textContent = resumo.total;
  document.getElementById('r-noprazo').textContent = resumo.noPrazo;
  document.getElementById('r-proximos').textContent = resumo.proximos;
  document.getElementById('r-vencidos').textContent = resumo.vencidos;

  const meds = await window.api.listar();
  const vencidos = meds.filter((m) => m.status === 'vencido')
    .sort((a, b) => a.diasParaVencer - b.diasParaVencer);
  const proximos = meds.filter((m) => m.status === 'proximo')
    .sort((a, b) => a.diasParaVencer - b.diasParaVencer);

  const alertas = document.getElementById('alertas');
  alertas.innerHTML = '';
  alertas.appendChild(blocoAlerta('perigo', '⛔ Medicamentos vencidos', vencidos, 'Nenhum medicamento vencido. 👍'));
  alertas.appendChild(blocoAlerta('aviso', '⚠️ Vencem nos próximos 15 dias', proximos, 'Nada vencendo em breve. 👍'));
}

function blocoAlerta(classe, titulo, lista, vazio) {
  const div = document.createElement('div');
  div.className = 'bloco-alerta ' + classe;
  let html = `<h2>${titulo}</h2>`;
  if (lista.length === 0) {
    html += `<div class="vazio">${vazio}</div>`;
  } else {
    for (const m of lista) {
      html += `<div class="linha-alerta" data-id="${m.id}">
        <span>${esc(m.nome)}</span>
        <span class="venc">${esc(textoValidade(m))}</span></div>`;
    }
  }
  div.innerHTML = html;
  div.querySelectorAll('.linha-alerta').forEach((el) =>
    el.addEventListener('click', () => abrirDetalhe(el.dataset.id)));
  return div;
}

// Chave enxuta do nome (igual à do sistema) para detectar nomes repetidos.
function chaveNome(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ---------- Lista ----------
async function carregarLista() {
  const termo = document.getElementById('busca').value;
  const todos = await window.api.listar();
  const meds = termo ? await window.api.buscar(termo) : todos;

  // Conta quantas vezes cada nome aparece, para marcar possíveis duplicados.
  const contagem = {};
  for (const m of todos) {
    const k = chaveNome(m.nome);
    if (k) contagem[k] = (contagem[k] || 0) + 1;
  }

  const lista = document.getElementById('lista');
  lista.innerHTML = '';
  if (meds.length === 0) {
    lista.innerHTML = '<div class="vazio">Nenhum medicamento encontrado.</div>';
    return;
  }
  meds.sort((a, b) => (a.diasParaVencer ?? 1e9) - (b.diasParaVencer ?? 1e9));
  for (const m of meds) {
    const card = document.createElement('div');
    card.className = 'card-med';
    const foto = primeiraFoto(m);
    const mini = foto ? `<img class="miniatura" src="${foto}" />` : `<div class="miniatura">💊</div>`;
    const ehDup = contagem[chaveNome(m.nome)] > 1;
    card.innerHTML = `${mini}
      <div class="info">
        <h3>${esc(m.nome)}</h3>
        <div class="meta">${esc(m.formaFarmaceutica)} · ${m.quantidade} un.</div>
        <div class="meta">${esc(textoValidade(m))}</div>
        <span class="badge ${m.status}">${ROTULO_STATUS[m.status]}</span>
        ${ehDup ? '<span class="badge dup">⚠️ Possível duplicado</span>' : ''}
      </div>`;
    card.addEventListener('click', () => abrirDetalhe(m.id));
    lista.appendChild(card);
  }
}
let buscaTimer = null;
document.getElementById('busca').addEventListener('input', () => {
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(carregarLista, 180);
});

// ---------- Detalhe (modal) ----------
let medsCache = [];
async function abrirDetalhe(id) {
  medsCache = await window.api.listar();
  const m = medsCache.find((x) => x.id === id);
  if (!m) return;
  const fotos = (m.fotos || []).map((f) => {
    if (/\.(mov|mp4|m4v|webm)$/i.test(f)) return `<div class="fake-video" title="vídeo">🎬</div>`;
    return `<img src="farmaphoto://p/${f}" />`;
  }).join('');

  document.getElementById('modal-conteudo').innerHTML = `
    <div class="det-titulo">${esc(m.nome)}</div>
    <span class="badge ${m.status}">${ROTULO_STATUS[m.status]}</span>
    ${fotos ? `<div class="det-fotos">${fotos}</div>` : ''}
    <div class="det-campo"><div class="rot">Forma farmacêutica</div><div class="val">${esc(m.formaFarmaceutica)}</div></div>
    <div class="det-campo"><div class="rot">Quantidade em estoque</div><div class="val">${m.quantidade} unidade(s)</div></div>
    <div class="det-campo"><div class="rot">Validade</div><div class="val">${fmtData(m.validade)} — ${esc(textoValidade(m))}</div></div>
    <div class="det-campo"><div class="rot">Para que serve</div><div class="val">${esc(m.paraQueServe)}</div></div>
    <div class="det-campo"><div class="rot">Dosagem para adulto</div><div class="val">${esc(m.dosagemAdulto)}</div></div>
    <div class="det-campo"><div class="rot">Principais contraindicações</div><div class="val">${esc(m.contraindicacoes)}</div></div>
    ${m.indicacoes ? `<div class="det-campo"><div class="rot">Indicações</div><div class="val">${esc(m.indicacoes)}</div></div>` : ''}
    <div class="det-acoes">
      <button class="btn primary" id="det-editar">Editar</button>
      <button class="btn perigo" id="det-excluir">Excluir</button>
    </div>`;
  document.getElementById('modal').classList.remove('oculto');
  document.getElementById('det-editar').onclick = () => { fecharModal(); editar(m); };
  document.getElementById('det-excluir').onclick = () => excluir(m);
}
function fecharModal() { document.getElementById('modal').classList.add('oculto'); }
document.getElementById('modal-fechar').onclick = fecharModal;
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') fecharModal();
});

async function excluir(m) {
  if (!confirm(`Excluir "${m.nome}"? Esta ação não pode ser desfeita.`)) return;
  await window.api.excluir(m.id);
  fecharModal();
  mostrarView('lista');
}

// ---------- Cadastro / edição ----------
function prepararCadastro() {
  document.getElementById('titulo-cadastro').textContent = 'Cadastrar medicamento';
  document.getElementById('metodos-cadastro').classList.remove('oculto');
  document.getElementById('form-med').classList.add('oculto');
  document.getElementById('ia-status').classList.add('oculto');
  carregarQR();
}

function limparForm() {
  ['f-id', 'f-nome', 'f-forma', 'f-quantidade', 'f-validade', 'f-para', 'f-dosagem', 'f-contra', 'f-indicacoes']
    .forEach((id) => { document.getElementById(id).value = ''; });
  fotosNovas = [];
  document.getElementById('fotos-form').innerHTML = '';
  document.getElementById('form-med').dataset.fotos = '[]';
}

function abrirForm() {
  document.getElementById('metodos-cadastro').classList.add('oculto');
  document.getElementById('form-med').classList.remove('oculto');
}

function editar(m) {
  mostrarView('cadastro');
  document.getElementById('metodos-cadastro').classList.add('oculto');
  document.getElementById('ia-status').classList.add('oculto');
  document.getElementById('titulo-cadastro').textContent = 'Editar medicamento';
  limparForm();
  document.getElementById('f-id').value = m.id;
  document.getElementById('f-nome').value = m.nome || '';
  document.getElementById('f-forma').value = m.formaFarmaceutica || '';
  document.getElementById('f-quantidade').value = m.quantidade ?? '';
  document.getElementById('f-validade').value = m.validade || '';
  document.getElementById('f-para').value = m.paraQueServe || '';
  document.getElementById('f-dosagem').value = m.dosagemAdulto || '';
  document.getElementById('f-contra').value = m.contraindicacoes || '';
  document.getElementById('f-indicacoes').value = m.indicacoes || '';
  document.getElementById('form-med').dataset.fotos = JSON.stringify(m.fotos || []);
  renderFotosForm(m.fotos || []);
  abrirForm();
}

function renderFotosForm(existentes) {
  const cont = document.getElementById('fotos-form');
  cont.innerHTML = '';
  for (const f of existentes) {
    if (/\.(mov|mp4|m4v|webm)$/i.test(f)) {
      cont.insertAdjacentHTML('beforeend', `<div class="fake-video">🎬</div>`);
    } else {
      cont.insertAdjacentHTML('beforeend', `<img src="farmaphoto://p/${f}" />`);
    }
  }
  for (const c of fotosNovas) {
    cont.insertAdjacentHTML('beforeend', `<div class="fake-video" title="nova mídia">🆕</div>`);
  }
}

document.getElementById('btn-manual').onclick = () => {
  document.getElementById('titulo-cadastro').textContent = 'Cadastrar medicamento';
  limparForm();
  abrirForm();
};

document.getElementById('btn-arquivo').onclick = async () => {
  const caminhos = await window.api.escolherArquivo();
  if (caminhos && caminhos.length) processarMidia(caminhos);
};

document.getElementById('btn-cancelar').onclick = () => prepararCadastro();

document.getElementById('form-med').addEventListener('submit', async (e) => {
  e.preventDefault();
  const existentes = JSON.parse(document.getElementById('form-med').dataset.fotos || '[]');
  const med = {
    id: document.getElementById('f-id').value || undefined,
    nome: document.getElementById('f-nome').value,
    formaFarmaceutica: document.getElementById('f-forma').value,
    quantidade: document.getElementById('f-quantidade').value,
    validade: document.getElementById('f-validade').value,
    paraQueServe: document.getElementById('f-para').value,
    dosagemAdulto: document.getElementById('f-dosagem').value,
    contraindicacoes: document.getElementById('f-contra').value,
    indicacoes: document.getElementById('f-indicacoes').value,
    fotos: existentes,
    fotosNovas: fotosNovas,
  };
  // Ao cadastrar um novo (sem id), avisa se já existe um parecido.
  if (!med.id && med.nome.trim()) {
    const dups = await window.api.duplicados(med.nome, null);
    if (dups.length > 0) { mostrarDialogoDuplicado(dups, med); return; }
  }
  await salvarMed(med);
});

async function salvarMed(med) {
  const res = await window.api.salvar(med);
  if (!res.ok) { alert(res.erro); return; }
  fotosNovas = [];
  mostrarView('lista');
}

// Diálogo quando já existe um medicamento parecido.
function mostrarDialogoDuplicado(dups, med) {
  const linhas = dups.map((d) => `
    <div class="dup-item">
      <div class="dup-info">
        <b>${esc(d.nome)}</b>
        <div class="meta">${esc(d.formaFarmaceutica)} · ${d.quantidade} un. · ${esc(textoValidade(d))}</div>
      </div>
      <button class="btn primary dup-ed" data-id="${d.id}">Editar este</button>
    </div>`).join('');

  document.getElementById('modal-conteudo').innerHTML = `
    <div class="det-titulo">⚠️ Já existe um medicamento parecido</div>
    <p>Encontrei ${dups.length === 1 ? 'este medicamento já cadastrado' : 'estes medicamentos já cadastrados'} com nome parecido com <b>“${esc(med.nome)}”</b>:</p>
    <div class="dup-lista">${linhas}</div>
    <p style="margin-top:16px">Você pode <b>editar o já cadastrado</b> (por exemplo, atualizar a quantidade ou a validade) ou <b>cadastrar assim mesmo</b> como um item separado.</p>
    <div class="det-acoes">
      <button class="btn ghost" id="dup-novo">Cadastrar assim mesmo</button>
      <button class="btn ghost" id="dup-cancelar">Cancelar</button>
    </div>`;
  document.getElementById('modal').classList.remove('oculto');

  document.querySelectorAll('.dup-ed').forEach((b) =>
    b.addEventListener('click', async () => {
      const alvo = (await window.api.listar()).find((x) => x.id === b.dataset.id);
      fecharModal();
      if (alvo) { fotosNovas = []; editar(alvo); }
    }));
  document.getElementById('dup-novo').onclick = () => { fecharModal(); salvarMed(med); };
  document.getElementById('dup-cancelar').onclick = fecharModal;
}

// ---------- Extração por IA ----------
async function processarMidia(caminhos) {
  fotosNovas = caminhos.slice();
  const status = document.getElementById('ia-status');
  status.classList.remove('oculto', 'erro');
  status.textContent = '🔎 Lendo a embalagem com a IA… isso pode levar alguns segundos.';
  document.getElementById('metodos-cadastro').classList.add('oculto');

  const res = await window.api.extrairIA(caminhos);
  if (!res.ok) {
    status.classList.add('erro');
    status.innerHTML = '⚠️ ' + esc(res.erro) + '<br>Você ainda pode preencher os campos manualmente abaixo.';
    limparFormMantendoFotos();
    abrirForm();
    return;
  }
  const d = res.dados;
  const conf = { alta: '🟢 alta', media: '🟡 média', baixa: '🔴 baixa' }[d.confianca] || d.confianca;
  status.innerHTML = `✅ Leitura concluída (confiança: ${conf}). <b>Revise os campos</b> antes de salvar.`;

  limparFormMantendoFotos();
  document.getElementById('f-nome').value = d.nome || '';
  document.getElementById('f-forma').value = d.formaFarmaceutica || '';
  document.getElementById('f-quantidade').value = d.quantidade || '';
  document.getElementById('f-validade').value = d.validade || '';
  document.getElementById('f-para').value = d.paraQueServe || '';
  document.getElementById('f-dosagem').value = d.dosagemAdulto || '';
  document.getElementById('f-contra').value = d.contraindicacoes || '';
  document.getElementById('f-indicacoes').value = d.indicacoes || '';
  abrirForm();
}

function limparFormMantendoFotos() {
  document.getElementById('f-id').value = '';
  document.getElementById('form-med').dataset.fotos = '[]';
  renderFotosForm([]);
}

// Quando o celular envia mídia:
window.api.aoReceberCaptura((caminhos) => {
  mostrarView('cadastro');
  processarMidia(caminhos);
});

// ---------- QR / servidor ----------
async function carregarQR() {
  const info = await window.api.servidorInfo();
  const area = document.getElementById('qr-area');
  if (!info || info.erro) {
    area.innerHTML = `<div class="vazio">Servidor local indisponível.<br>${esc(info && info.erro || '')}</div>`;
    return;
  }
  area.innerHTML = `<img src="${info.qr}" alt="QR Code" />
    <div class="url">${esc(info.url)}</div>`;
}

// ---------- Configurações ----------
async function carregarConfig() {
  const cfg = await window.api.lerConfig();
  document.getElementById('c-apikey').value = cfg.apiKey || '';
  document.getElementById('c-modelo').value = cfg.modelo || 'claude-opus-5';
  await carregarExport();
}

async function carregarExport() {
  const info = await window.api.exportInfo();
  document.getElementById('e-auto').checked = info.auto;
  document.getElementById('e-pasta').textContent = info.pasta;
  const od = document.getElementById('e-onedrive');
  od.textContent = info.temOneDrive
    ? 'OneDrive detectado — o PDF vai para dentro dele automaticamente.'
    : 'OneDrive não detectado. Você pode escolher a pasta manualmente em "Mudar pasta".';
}

document.getElementById('e-auto').addEventListener('change', async (e) => {
  await window.api.exportSalvarConfig({ exportarAuto: e.target.checked });
});

document.getElementById('e-exportar').addEventListener('click', async () => {
  const msg = document.getElementById('e-msg');
  msg.style.color = ''; msg.textContent = '⏳ Gerando PDF…';
  const res = await window.api.exportAgora();
  if (res.ok) {
    msg.style.color = ''; msg.textContent = '✅ PDF atualizado! Abra pelo OneDrive no celular.';
    carregarExport();
  } else {
    msg.style.color = '#dc2626'; msg.textContent = '⚠️ ' + res.erro;
  }
});

document.getElementById('e-mudar').addEventListener('click', async () => {
  const res = await window.api.exportEscolherPasta();
  if (res && res.ok) {
    document.getElementById('e-pasta').textContent = res.pasta;
    const msg = document.getElementById('e-msg');
    msg.style.color = ''; msg.textContent = '✅ Pasta alterada. Clique em "Gerar PDF agora".';
  }
});
document.getElementById('form-config').addEventListener('submit', async (e) => {
  e.preventDefault();
  await window.api.salvarConfig({
    apiKey: document.getElementById('c-apikey').value.trim(),
    modelo: document.getElementById('c-modelo').value,
  });
  const msg = document.getElementById('config-msg');
  msg.textContent = '✅ Salvo!';
  setTimeout(() => { msg.textContent = ''; }, 2500);
});

// ---------- Início ----------
mostrarView('inicio');
