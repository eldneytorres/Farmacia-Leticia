'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { BrowserWindow } = require('electron');

// Gera um PDF "Minha Farmácia" e salva numa pasta (por padrão, no OneDrive),
// para consultar pelo celular mesmo com o computador desligado.

const NOME_ARQUIVO = 'Minha Farmacia.pdf';

const ROT_STATUS = {
  vencido: 'VENCIDO',
  proximo: 'Vence em breve',
  no_prazo: 'No prazo',
  sem_validade: 'Sem validade',
};
const ORDEM = { vencido: 0, proximo: 1, no_prazo: 2, sem_validade: 3 };

// Descobre a pasta do OneDrive no Windows.
function pastaOneDrive() {
  const od = process.env.OneDrive || process.env.OneDriveConsumer || process.env.OneDriveCommercial;
  const base = od || path.join(os.homedir(), 'OneDrive');
  return path.join(base, 'Farmacinha Leticia');
}

function temOneDrive() {
  return !!(process.env.OneDrive || process.env.OneDriveConsumer || process.env.OneDriveCommercial);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtData(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function textoValidade(m) {
  const d = m.diasParaVencer;
  if (d === null || d === undefined) return 'Sem validade';
  if (d < 0) return `Venceu há ${Math.abs(d)} dia(s) (${fmtData(m.validade)})`;
  if (d === 0) return 'Vence hoje';
  return `Vence em ${d} dia(s) — ${fmtData(m.validade)}`;
}

function htmlRelatorio(medicamentos, resumo) {
  const agora = new Date().toLocaleString('pt-BR');
  const lista = medicamentos.slice().sort((a, b) => {
    const oa = ORDEM[a.status] ?? 9;
    const ob = ORDEM[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });

  const itens = lista.map((m) => `
    <div class="item ${m.status}">
      <div class="cab">
        <span class="nome">${esc(m.nome)}</span>
        <span class="tag ${m.status}">${ROT_STATUS[m.status] || ''}</span>
      </div>
      <div class="meta">${esc(m.formaFarmaceutica)} &middot; ${esc(String(m.quantidade))} unidade(s) &middot; ${esc(textoValidade(m))}</div>
      ${m.paraQueServe ? `<div class="c"><b>Para que serve:</b> ${esc(m.paraQueServe)}</div>` : ''}
      ${m.dosagemAdulto ? `<div class="c"><b>Dosagem (adulto):</b> ${esc(m.dosagemAdulto)}</div>` : ''}
      ${m.contraindicacoes ? `<div class="c"><b>Contraindicações:</b> ${esc(m.contraindicacoes)}</div>` : ''}
    </div>`).join('');

  const vazio = lista.length === 0
    ? '<div class="nenhum">Nenhum medicamento cadastrado ainda.</div>' : '';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #1f2937; margin: 0; padding: 28px 30px; }
  h1 { font-size: 22px; color: #0f766e; margin: 0 0 2px; }
  .gerado { color: #64748b; font-size: 12px; margin-bottom: 14px; }
  .resumo { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
  .resumo span { font-size: 12px; padding: 5px 12px; border-radius: 999px; background: #f1f5f9; color: #334155; }
  .resumo .p { background: #fef3c7; color: #b45309; }
  .resumo .v { background: #fee2e2; color: #dc2626; }
  .resumo .o { background: #dcfce7; color: #16a34a; }
  .como-buscar { background: #ecfeff; border: 1px solid #a5e8f0; color: #0e6b7a; border-radius: 8px;
    padding: 10px 14px; font-size: 12px; margin-bottom: 16px; line-height: 1.45; }
  .item { border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; border-radius: 8px; padding: 10px 14px; margin-bottom: 9px; page-break-inside: avoid; }
  .item.vencido { border-left-color: #dc2626; }
  .item.proximo { border-left-color: #d97706; }
  .item.no_prazo { border-left-color: #16a34a; }
  .cab { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .nome { font-size: 15px; font-weight: 700; }
  .tag { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .tag.vencido { background: #fee2e2; color: #dc2626; }
  .tag.proximo { background: #fef3c7; color: #b45309; }
  .tag.no_prazo { background: #dcfce7; color: #16a34a; }
  .tag.sem_validade { background: #e2e8f0; color: #64748b; }
  .meta { font-size: 12px; color: #475569; margin: 3px 0 6px; }
  .c { font-size: 12px; line-height: 1.4; margin-top: 2px; }
  .nenhum { color: #64748b; font-size: 14px; }
  .rodape { margin-top: 22px; font-size: 10.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style></head><body>
  <h1>💊 Minha Farmácia — Leticia</h1>
  <div class="gerado">Atualizado em ${esc(agora)}</div>
  <div class="resumo">
    <span>Total: ${resumo.total}</span>
    <span class="o">No prazo: ${resumo.noPrazo}</span>
    <span class="p">Vencem em breve: ${resumo.proximos}</span>
    <span class="v">Vencidos: ${resumo.vencidos}</span>
  </div>
  <div class="como-buscar">🔍 <b>Para procurar um remédio:</b> toque na <b>lupa</b> do leitor de PDF e digite o nome — ou toque no <b>microfone 🎤</b> do teclado do celular e <b>fale</b> o nome do medicamento.</div>
  ${itens}${vazio}
  <div class="rodape">Gerado automaticamente pela Farmacinha Leticia. As informações são para organização doméstica — confira sempre a bula e consulte um profissional de saúde.</div>
</body></html>`;
}

// Gera o PDF e grava no caminho indicado.
async function exportarPDF(destinoPdf, medicamentos, resumo) {
  const dir = path.dirname(destinoPdf);
  fs.mkdirSync(dir, { recursive: true });

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false, javascript: false },
  });
  try {
    const html = htmlRelatorio(medicamentos, resumo);
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { marginType: 'default' },
    });
    fs.writeFileSync(destinoPdf, pdf);
    return destinoPdf;
  } finally {
    win.destroy();
  }
}

module.exports = { exportarPDF, htmlRelatorio, pastaOneDrive, temOneDrive, NOME_ARQUIVO };
