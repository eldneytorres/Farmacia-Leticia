'use strict';

// Lógica de domínio pura (sem Electron), para poder ser reutilizada e testada.

const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_PROXIMO_DIAS = 15;

// Remove acentos e coloca em minúsculas, para buscas tolerantes.
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Converte "YYYY-MM-DD" numa data local à meia-noite (evita problemas de fuso).
function parseValidade(validade) {
  if (!validade) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(validade));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function hojeMeiaNoite() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

// Dias inteiros até a validade. Negativo = já venceu.
function diasParaVencer(validade) {
  const d = parseValidade(validade);
  if (!d) return null;
  return Math.round((d.getTime() - hojeMeiaNoite().getTime()) / DIA_MS);
}

// Status: 'vencido' | 'proximo' | 'no_prazo' | 'sem_validade'
function statusValidade(validade) {
  const dias = diasParaVencer(validade);
  if (dias === null) return 'sem_validade';
  if (dias < 0) return 'vencido';
  if (dias <= LIMITE_PROXIMO_DIAS) return 'proximo';
  return 'no_prazo';
}

// Enriquece um medicamento com campos calculados para exibição.
function comStatus(med) {
  return {
    ...med,
    diasParaVencer: diasParaVencer(med.validade),
    status: statusValidade(med.validade),
  };
}

// Busca por nome ou indicação (para que serve / indicações).
function correspondeBusca(med, termo) {
  const q = normalizar(termo);
  if (!q) return true;
  const alvo = normalizar(
    [med.nome, med.paraQueServe, med.indicacoes, med.formaFarmaceutica].join(' ')
  );
  return q
    .split(/\s+/)
    .every((palavra) => alvo.includes(palavra));
}

// Chave "enxuta" do nome: sem acentos, sem espaços e sem pontuação,
// para comparar nomes parecidos (ex.: "Dipirona 500mg" e "Dipirona 500 mg").
function chaveNome(nome) {
  return normalizar(nome).replace(/[^a-z0-9]/g, '');
}

// Considera duplicado quando os nomes são iguais ou um contém o outro
// (com pelo menos 4 caracteres em comum), para evitar coincidências bobas.
function possivelDuplicado(nomeA, nomeB) {
  const a = chaveNome(nomeA);
  const b = chaveNome(nomeB);
  if (!a || !b) return false;
  if (a === b) return true;
  const menor = a.length <= b.length ? a : b;
  const maior = a.length <= b.length ? b : a;
  return menor.length >= 4 && maior.includes(menor);
}

// Devolve os medicamentos já cadastrados com nome parecido (ignora o próprio id).
function encontrarDuplicados(medicamentos, nome, idAtual) {
  return medicamentos.filter(
    (m) => m.id !== idAtual && possivelDuplicado(m.nome, nome)
  );
}

// Resumo para a tela inicial.
function resumir(medicamentos) {
  const resumo = {
    total: medicamentos.length,
    noPrazo: 0,
    proximos: 0,
    vencidos: 0,
    semValidade: 0,
  };
  for (const med of medicamentos) {
    switch (statusValidade(med.validade)) {
      case 'no_prazo': resumo.noPrazo++; break;
      case 'proximo': resumo.proximos++; break;
      case 'vencido': resumo.vencidos++; break;
      default: resumo.semValidade++; break;
    }
  }
  return resumo;
}

module.exports = {
  LIMITE_PROXIMO_DIAS,
  normalizar,
  diasParaVencer,
  statusValidade,
  comStatus,
  correspondeBusca,
  possivelDuplicado,
  encontrarDuplicados,
  resumir,
};
