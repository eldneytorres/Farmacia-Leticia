'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listar: () => ipcRenderer.invoke('meds:listar'),
  buscar: (termo) => ipcRenderer.invoke('meds:buscar', termo),
  resumo: () => ipcRenderer.invoke('meds:resumo'),
  duplicados: (nome, id) => ipcRenderer.invoke('meds:duplicados', { nome, id }),
  salvar: (med) => ipcRenderer.invoke('meds:salvar', med),
  excluir: (id) => ipcRenderer.invoke('meds:excluir', id),

  lerConfig: () => ipcRenderer.invoke('config:ler'),
  salvarConfig: (cfg) => ipcRenderer.invoke('config:salvar', cfg),

  servidorInfo: () => ipcRenderer.invoke('servidor:info'),
  extrairIA: (caminhos) => ipcRenderer.invoke('ia:extrair', caminhos),
  escolherArquivo: () => ipcRenderer.invoke('arquivo:escolher'),

  exportInfo: () => ipcRenderer.invoke('export:info'),
  exportSalvarConfig: (cfg) => ipcRenderer.invoke('export:salvarConfig', cfg),
  exportAgora: () => ipcRenderer.invoke('export:agora'),
  exportEscolherPasta: () => ipcRenderer.invoke('export:escolherPasta'),

  // Notificação quando o celular envia mídia.
  aoReceberCaptura: (callback) =>
    ipcRenderer.on('captura:recebida', (_e, arquivos) => callback(arquivos)),
});
