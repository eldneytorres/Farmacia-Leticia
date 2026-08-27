'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listar: () => ipcRenderer.invoke('meds:listar'),
  buscar: (termo) => ipcRenderer.invoke('meds:buscar', termo),
  resumo: () => ipcRenderer.invoke('meds:resumo'),
  salvar: (med) => ipcRenderer.invoke('meds:salvar', med),
  excluir: (id) => ipcRenderer.invoke('meds:excluir', id),

  lerConfig: () => ipcRenderer.invoke('config:ler'),
  salvarConfig: (cfg) => ipcRenderer.invoke('config:salvar', cfg),

  servidorInfo: () => ipcRenderer.invoke('servidor:info'),
  extrairIA: (caminhos) => ipcRenderer.invoke('ia:extrair', caminhos),
  escolherArquivo: () => ipcRenderer.invoke('arquivo:escolher'),

  // Notificação quando o celular envia mídia.
  aoReceberCaptura: (callback) =>
    ipcRenderer.on('captura:recebida', (_e, arquivos) => callback(arquivos)),
});
