'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, protocol, dialog } = require('electron');
const QRCode = require('qrcode');

const { Store } = require('./store');
const { iniciarServidor } = require('./server');
const { extrairMedicamento } = require('./ai');
const { exportarPDF, pastaOneDrive, temOneDrive, NOME_ARQUIVO } = require('./exportar');
const meds = require('./meds');

let janela = null;
let store = null;
let infoServidor = null;

// Caminho do PDF de consulta (pasta escolhida ou OneDrive), + o nome do arquivo.
function pastaExportAtual() {
  const cfg = store.lerConfig();
  return cfg.pastaExport || pastaOneDrive();
}
function destinoPdf() {
  return path.join(pastaExportAtual(), NOME_ARQUIVO);
}

// Exporta o PDF se a exportação automática estiver ligada. Nunca lança erro.
async function exportarSeAtivo() {
  try {
    const cfg = store.lerConfig();
    if (cfg.exportarAuto === false) return;
    const lista = store.listar().map(meds.comStatus);
    await exportarPDF(destinoPdf(), lista, meds.resumir(store.listar()));
  } catch (e) {
    console.error('Falha ao exportar PDF automaticamente:', e);
  }
}

// Esquema privilegiado para servir as fotos guardadas no disco com segurança.
protocol.registerSchemesAsPrivileged([
  { scheme: 'farmaphoto', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const OBRIGATORIOS = [
  ['nome', 'Nome'],
  ['formaFarmaceutica', 'Forma farmacêutica'],
  ['quantidade', 'Quantidade em estoque'],
  ['validade', 'Data de validade'],
  ['paraQueServe', 'Para que serve'],
  ['dosagemAdulto', 'Dosagem recomendada para adulto'],
  ['contraindicacoes', 'Principais contraindicações'],
];

function validar(med) {
  const faltando = [];
  for (const [campo, rotulo] of OBRIGATORIOS) {
    const v = med[campo];
    if (v === undefined || v === null || String(v).trim() === '') faltando.push(rotulo);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(med.validade || '')) {
    if (!faltando.includes('Data de validade')) faltando.push('Data de validade (formato inválido)');
  }
  return faltando;
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'Farmacinha Leticia',
    backgroundColor: '#f1f5f9',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janela.setMenuBarVisibility(false);
  janela.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function tipoMime(nome) {
  switch (path.extname(nome).toLowerCase()) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    case '.mov': return 'video/quicktime';
    case '.mp4': case '.m4v': return 'video/mp4';
    case '.webm': return 'video/webm';
    default: return 'image/jpeg';
  }
}

app.whenReady().then(async () => {
  store = new Store(app.getPath('userData'));
  const uploadDir = path.join(app.getPath('userData'), 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  // Serve fotos guardadas: farmaphoto://p/<arquivo>
  protocol.handle('farmaphoto', async (req) => {
    try {
      const url = new URL(req.url);
      const nome = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const caminho = store.caminhoFoto(nome);
      if (!fs.existsSync(caminho)) return new Response('', { status: 404 });
      const buffer = fs.readFileSync(caminho);
      return new Response(buffer, { headers: { 'content-type': tipoMime(nome) } });
    } catch (e) {
      return new Response(String(e), { status: 500 });
    }
  });

  // Inicia o servidor local para o celular.
  try {
    infoServidor = await iniciarServidor({
      uploadDir,
      onArquivos: (arquivos) => {
        if (janela) janela.webContents.send('captura:recebida', arquivos);
      },
      buscar: (termo) =>
        store.listar().filter((m) => meds.correspondeBusca(m, termo)).map(meds.comStatus),
    });
    infoServidor.qr = await QRCode.toDataURL(infoServidor.url, { margin: 1, width: 240 });
  } catch (e) {
    console.error('Falha ao iniciar servidor local:', e);
    infoServidor = { erro: String(e && e.message || e) };
  }

  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (infoServidor && infoServidor.parar) infoServidor.parar();
  if (process.platform !== 'darwin') app.quit();
});

// ---------------- IPC ----------------

ipcMain.handle('meds:listar', () => store.listar().map(meds.comStatus));

ipcMain.handle('meds:buscar', (_e, termo) =>
  store.listar().filter((m) => meds.correspondeBusca(m, termo)).map(meds.comStatus)
);

ipcMain.handle('meds:resumo', () => meds.resumir(store.listar()));

ipcMain.handle('meds:salvar', (_e, med) => {
  const faltando = validar(med);
  if (faltando.length > 0) {
    return { ok: false, erro: 'Campos obrigatórios: ' + faltando.join(', ') };
  }
  // Copia as fotos novas (caminhos temporários) para a pasta permanente.
  const fotos = Array.isArray(med.fotos) ? med.fotos.slice() : [];
  if (Array.isArray(med.fotosNovas)) {
    for (const caminho of med.fotosNovas) {
      try {
        if (fs.existsSync(caminho)) fotos.push(store.guardarFoto(caminho, path.extname(caminho)));
      } catch (e) { console.error('Falha ao guardar foto', e); }
    }
  }
  const limpo = {
    id: med.id || undefined,
    nome: String(med.nome).trim(),
    formaFarmaceutica: String(med.formaFarmaceutica).trim(),
    quantidade: parseInt(med.quantidade, 10) || 0,
    validade: med.validade,
    paraQueServe: String(med.paraQueServe).trim(),
    dosagemAdulto: String(med.dosagemAdulto).trim(),
    contraindicacoes: String(med.contraindicacoes).trim(),
    indicacoes: String(med.indicacoes || '').trim(),
    fotos,
  };
  const salvo = store.salvar(limpo);
  exportarSeAtivo();
  return { ok: true, medicamento: meds.comStatus(salvo) };
});

ipcMain.handle('meds:excluir', (_e, id) => {
  const ok = store.excluir(id);
  exportarSeAtivo();
  return { ok };
});

ipcMain.handle('config:ler', () => store.lerConfig());
ipcMain.handle('config:salvar', (_e, cfg) => ({ ok: true, config: store.salvarConfig(cfg) }));

ipcMain.handle('servidor:info', () => {
  if (!infoServidor) return { erro: 'Servidor ainda não iniciou.' };
  // Devolve só campos serializáveis (sem a função "parar").
  const { ip, porta, url, urlConsulta, qr, erro } = infoServidor;
  return { ip, porta, url, urlConsulta, qr, erro };
});

ipcMain.handle('ia:extrair', async (_e, caminhos) => {
  try {
    const cfg = store.lerConfig();
    const dados = await extrairMedicamento(cfg, caminhos);
    return { ok: true, dados };
  } catch (e) {
    return { ok: false, erro: String(e && e.message || e) };
  }
});

// Diálogo nativo para cadastrar por arquivo (foto/vídeo já no computador).
ipcMain.handle('arquivo:escolher', async () => {
  const res = await dialog.showOpenDialog(janela, {
    title: 'Escolher foto(s) ou vídeo do medicamento',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Imagens e vídeos', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mov', 'mp4', 'm4v', 'webm'] },
    ],
  });
  return res.canceled ? [] : res.filePaths;
});

// ---- Exportação do PDF para o OneDrive ----

ipcMain.handle('export:info', () => {
  const cfg = store.lerConfig();
  const caminho = destinoPdf();
  return {
    pasta: pastaExportAtual(),
    caminho,
    auto: cfg.exportarAuto !== false,
    temOneDrive: temOneDrive(),
    existe: fs.existsSync(caminho),
  };
});

ipcMain.handle('export:salvarConfig', (_e, cfg) => {
  store.salvarConfig({
    exportarAuto: cfg.exportarAuto !== false,
    ...(cfg.pastaExport !== undefined ? { pastaExport: cfg.pastaExport } : {}),
  });
  return { ok: true };
});

ipcMain.handle('export:agora', async () => {
  try {
    const lista = store.listar().map(meds.comStatus);
    const caminho = await exportarPDF(destinoPdf(), lista, meds.resumir(store.listar()));
    return { ok: true, caminho };
  } catch (e) {
    return { ok: false, erro: String(e && e.message || e) };
  }
});

ipcMain.handle('export:escolherPasta', async () => {
  const res = await dialog.showOpenDialog(janela, {
    title: 'Escolher a pasta onde salvar o PDF (ex.: dentro do OneDrive)',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || res.filePaths.length === 0) return { ok: false };
  store.salvarConfig({ pastaExport: res.filePaths[0] });
  return { ok: true, pasta: res.filePaths[0] };
});
