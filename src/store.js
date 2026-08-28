'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Armazenamento persistente simples em arquivo JSON, gravado de forma atômica
// (grava num arquivo temporário e renomeia) para não corromper em caso de queda.

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'farmacinha.json');
    this.photosDir = path.join(dir, 'fotos');
    this.settingsFile = path.join(dir, 'config.json');
    fs.mkdirSync(this.photosDir, { recursive: true });
    this.data = this._carregar();
  }

  _carregar() {
    try {
      const bruto = fs.readFileSync(this.file, 'utf-8');
      const obj = JSON.parse(bruto);
      if (!Array.isArray(obj.medicamentos)) obj.medicamentos = [];
      return obj;
    } catch (e) {
      return { versao: 1, medicamentos: [] };
    }
  }

  _gravar() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmp, this.file);
  }

  listar() {
    return this.data.medicamentos.slice();
  }

  obter(id) {
    return this.data.medicamentos.find((m) => m.id === id) || null;
  }

  // Cria (sem id) ou atualiza (com id existente).
  salvar(med) {
    const agora = new Date().toISOString();
    if (med.id) {
      const idx = this.data.medicamentos.findIndex((m) => m.id === med.id);
      if (idx === -1) throw new Error('Medicamento não encontrado: ' + med.id);
      const anterior = this.data.medicamentos[idx];
      this.data.medicamentos[idx] = {
        ...anterior,
        ...med,
        criadoEm: anterior.criadoEm,
        atualizadoEm: agora,
      };
      this._gravar();
      return this.data.medicamentos[idx];
    }
    const novo = {
      ...med,
      id: crypto.randomUUID(),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.data.medicamentos.push(novo);
    this._gravar();
    return novo;
  }

  excluir(id) {
    const med = this.obter(id);
    const idx = this.data.medicamentos.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    this.data.medicamentos.splice(idx, 1);
    this._gravar();
    // remove as fotos associadas do disco
    if (med && Array.isArray(med.fotos)) {
      for (const nome of med.fotos) {
        try { fs.unlinkSync(path.join(this.photosDir, nome)); } catch (_) {}
      }
    }
    return true;
  }

  // ---- Configurações (chave de API, modelo) ----
  lerConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
    } catch (e) {
      return { apiKey: '', modelo: 'claude-opus-5', pastaExport: '', exportarAuto: true };
    }
  }

  salvarConfig(cfg) {
    const atual = this.lerConfig();
    const novo = { ...atual, ...cfg };
    const tmp = this.settingsFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(novo, null, 2), 'utf-8');
    fs.renameSync(tmp, this.settingsFile);
    return novo;
  }

  // Move um arquivo temporário de mídia para a pasta de fotos e devolve o nome.
  guardarFoto(caminhoOrigem, extensao) {
    const nome = crypto.randomUUID() + (extensao || path.extname(caminhoOrigem) || '.jpg');
    const destino = path.join(this.photosDir, nome);
    fs.copyFileSync(caminhoOrigem, destino);
    return nome;
  }

  // Grava um buffer como foto e devolve o nome do arquivo.
  guardarFotoBuffer(buffer, extensao) {
    const nome = crypto.randomUUID() + (extensao || '.jpg');
    fs.writeFileSync(path.join(this.photosDir, nome), buffer);
    return nome;
  }

  caminhoFoto(nome) {
    return path.join(this.photosDir, path.basename(nome));
  }
}

module.exports = { Store };
