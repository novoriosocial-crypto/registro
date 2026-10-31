'use strict';

const fs = require('node:fs');
const path = require('node:path');

class Registros {
  constructor(arquivo) {
    this.arquivo = arquivo;
    this.dados = new Map();
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    if (fs.existsSync(arquivo)) {
      // Arquivo inválido interrompe a inicialização, sem apagar os dados.
      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (!dados || Array.isArray(dados) || typeof dados !== 'object') {
        throw new Error('O arquivo de registros está inválido. Confira o volume antes de iniciar.');
      }
      this.dados = new Map(Object.entries(dados));
    }
  }

  get(id) { return this.dados.get(id); }

  set(id, dados) {
    const novos = new Map(this.dados);
    novos.set(id, structuredClone(dados));
    this.salvar(novos);
  }

  delete(id) {
    const novos = new Map(this.dados);
    novos.delete(id);
    this.salvar(novos);
  }

  salvar(novos) {
    const temporario = `${this.arquivo}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(Object.fromEntries(novos), null, 2), { mode: 0o600 });
    fs.renameSync(temporario, this.arquivo);
    this.dados = novos;
  }
}

module.exports = { Registros };
