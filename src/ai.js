'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (_) {
  ffmpegPath = null;
}

const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VIDEO_EXT = ['.mov', '.mp4', '.m4v', '.webm', '.avi', '.mkv', '.3gp'];
const MAX_IMAGENS = 6;

function mediaTypePorExt(ext) {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

// Extrai alguns quadros de um vídeo usando o ffmpeg empacotado.
function extrairQuadros(caminhoVideo) {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error(
      'Não foi possível processar o vídeo: componente de vídeo (ffmpeg) indisponível. ' +
      'Tente enviar uma foto da embalagem.'
    );
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'farmacinha-'));
  const padrao = path.join(tmp, 'quadro-%02d.jpg');
  // 1 quadro por segundo, no máximo 4 quadros, qualidade boa.
  const res = spawnSync(
    ffmpegPath,
    ['-y', '-i', caminhoVideo, '-vf', 'fps=1', '-frames:v', '4', '-q:v', '3', padrao],
    { encoding: 'utf-8' }
  );
  if (res.status !== 0) {
    throw new Error('Falha ao extrair quadros do vídeo. ' + (res.stderr || '').slice(-300));
  }
  return fs.readdirSync(tmp)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .map((f) => path.join(tmp, f));
}

// Converte uma imagem em formato desconhecido (ex.: HEIC do iPhone) para JPEG.
function converterParaJpeg(caminho) {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) return null;
  const destino = path.join(os.tmpdir(), 'farmacinha-' + crypto.randomUUID() + '.jpg');
  const res = spawnSync(ffmpegPath, ['-y', '-i', caminho, '-q:v', '3', destino], { encoding: 'utf-8' });
  if (res.status !== 0 || !fs.existsSync(destino)) return null;
  return destino;
}

// Recebe uma lista de caminhos (fotos e/ou vídeos) e devolve blocos de imagem
// prontos para enviar ao Claude.
function prepararImagens(caminhos) {
  const blocos = [];
  for (const caminho of caminhos) {
    const ext = path.extname(caminho).toLowerCase();
    if (VIDEO_EXT.includes(ext)) {
      for (const q of extrairQuadros(caminho)) {
        blocos.push({ caminho: q, media_type: 'image/jpeg' });
      }
    } else if (IMG_EXT.includes(ext)) {
      blocos.push({ caminho, media_type: mediaTypePorExt(ext) });
    } else {
      // formato desconhecido (ex.: .heic) — tenta converter
      const jpeg = converterParaJpeg(caminho);
      if (jpeg) blocos.push({ caminho: jpeg, media_type: 'image/jpeg' });
    }
  }
  return blocos.slice(0, MAX_IMAGENS).map((b) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: b.media_type,
      data: fs.readFileSync(b.caminho).toString('base64'),
    },
  }));
}

const PROMPT = `Você é um assistente que lê fotos/vídeos de embalagens de medicamentos e organiza as informações para um controle doméstico de farmácia.

Analise TODAS as imagens fornecidas (podem ser ângulos diferentes da mesma embalagem) e extraia as informações do medicamento.

Responda APENAS com um objeto JSON válido, sem texto antes ou depois, com exatamente estas chaves:
{
  "nome": "nome comercial e princípio ativo, ex.: 'Dipirona Monoidratada 500mg (Novalgina)'",
  "formaFarmaceutica": "ex.: comprimido, cápsula, xarope, gotas, pomada, solução injetável",
  "quantidade": número inteiro de unidades na embalagem (ou null se não der para ver),
  "validade": "data de validade no formato YYYY-MM-DD (ou null se não estiver visível/legível)",
  "paraQueServe": "para que serve o medicamento, em linguagem simples (1 a 3 frases)",
  "dosagemAdulto": "dosagem recomendada usual para adulto, se conhecida (1 a 3 frases)",
  "contraindicacoes": "principais contraindicações e cuidados importantes",
  "indicacoes": "palavras-chave de indicações/sintomas para facilitar buscas, separadas por vírgula",
  "confianca": "alta, media ou baixa — quão confiante você está na leitura da embalagem"
}

Regras:
- Use exatamente o formato YYYY-MM-DD para a validade. Se a embalagem mostrar apenas mês/ano (MM/AAAA), use o último dia daquele mês.
- Preencha "paraQueServe", "dosagemAdulto" e "contraindicacoes" com informação geral e amplamente conhecida sobre o princípio ativo, mesmo que não esteja impresso na caixa. Seja prudente e conservador.
- Se não conseguir identificar o medicamento com segurança, use "confianca": "baixa" e preencha o que for possível.
- Toda a resposta em português do Brasil.`;

function extrairJson(texto) {
  const inicio = texto.indexOf('{');
  const fim = texto.lastIndexOf('}');
  if (inicio === -1 || fim === -1) throw new Error('Resposta da IA sem JSON: ' + texto.slice(0, 200));
  return JSON.parse(texto.slice(inicio, fim + 1));
}

// Função principal: dado config e caminhos de mídia, devolve os campos extraídos.
async function extrairMedicamento({ apiKey, modelo }, caminhos) {
  if (!apiKey) {
    throw new Error('Chave de API do Claude não configurada. Vá em Configurações e informe sua chave.');
  }
  const imagens = prepararImagens(caminhos);
  if (imagens.length === 0) {
    throw new Error('Nenhuma imagem pôde ser lida a partir da mídia enviada.');
  }

  const client = new Anthropic({ apiKey });
  const resposta = await client.messages.create({
    model: modelo || 'claude-opus-5',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [...imagens, { type: 'text', text: PROMPT }],
      },
    ],
  });

  const bloco = resposta.content.find((b) => b.type === 'text');
  if (!bloco) throw new Error('A IA não retornou texto.');
  const dados = extrairJson(bloco.text);

  return {
    nome: dados.nome || '',
    formaFarmaceutica: dados.formaFarmaceutica || '',
    quantidade: Number.isFinite(dados.quantidade) ? dados.quantidade : (parseInt(dados.quantidade, 10) || ''),
    validade: /^\d{4}-\d{2}-\d{2}$/.test(dados.validade || '') ? dados.validade : '',
    paraQueServe: dados.paraQueServe || '',
    dosagemAdulto: dados.dosagemAdulto || '',
    contraindicacoes: dados.contraindicacoes || '',
    indicacoes: dados.indicacoes || '',
    confianca: dados.confianca || 'baixa',
  };
}

module.exports = { extrairMedicamento };
