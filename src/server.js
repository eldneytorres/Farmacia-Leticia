'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

// Servidor HTTP local que roda dentro do app. O celular (na mesma rede Wi-Fi)
// abre este endereço, tira a foto/grava o vídeo e envia de volta para o PC.

function ipLocal() {
  const ifaces = os.networkInterfaces();
  const candidatos = [];
  for (const nome of Object.keys(ifaces)) {
    for (const iface of ifaces[nome] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidatos.push(iface.address);
      }
    }
  }
  // Prioriza faixas comuns de rede doméstica.
  const preferido = candidatos.find((ip) => ip.startsWith('192.168.'))
    || candidatos.find((ip) => ip.startsWith('10.'))
    || candidatos.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip));
  return preferido || candidatos[0] || '127.0.0.1';
}

function iniciarServidor({ porta = 41789, uploadDir, onArquivos, buscar }) {
  const app = express();
  const token = crypto.randomBytes(8).toString('hex'); // pareamento simples
  const ip = ipLocal();

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'upload-' + crypto.randomUUID() + ext);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 80 * 1024 * 1024, files: 8 },
  });

  app.use(express.static(path.join(__dirname, 'phone')));

  // Página de captura (o token é validado no envio).
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'phone', 'capture.html'));
  });

  app.get('/ping', (req, res) => res.json({ ok: true }));

  app.post('/upload', upload.array('midia', 8), (req, res) => {
    if (req.body.token !== token) {
      return res.status(403).json({ ok: false, erro: 'Código inválido.' });
    }
    const arquivos = (req.files || []).map((f) => f.path);
    if (arquivos.length === 0) {
      return res.status(400).json({ ok: false, erro: 'Nenhum arquivo recebido.' });
    }
    if (typeof onArquivos === 'function') onArquivos(arquivos);
    res.json({ ok: true, quantidade: arquivos.length });
  });

  // Página de consulta pelo celular.
  app.get('/consultar', (req, res) => {
    res.sendFile(path.join(__dirname, 'phone', 'consultar.html'));
  });

  // Busca de medicamentos (usada pela página de consulta no celular).
  app.get('/api/buscar', (req, res) => {
    if (req.query.t !== token) {
      return res.status(403).json({ ok: false, erro: 'Código inválido.' });
    }
    const resultados = typeof buscar === 'function' ? buscar(req.query.q || '') : [];
    res.json({ ok: true, resultados });
  });

  return new Promise((resolve) => {
    const servidor = app.listen(porta, '0.0.0.0', () => {
      const info = {
        ip,
        porta,
        token,
        url: `http://${ip}:${porta}/?t=${token}`,
        urlConsulta: `http://${ip}:${porta}/consultar?t=${token}`,
        parar: () => servidor.close(),
      };
      resolve(info);
    });
    servidor.on('error', (err) => {
      // Se a porta estiver ocupada, tenta a próxima.
      if (err.code === 'EADDRINUSE' && porta < 41799) {
        iniciarServidor({ porta: porta + 1, uploadDir, onArquivos }).then(resolve);
      } else {
        throw err;
      }
    });
  });
}

module.exports = { iniciarServidor, ipLocal };
