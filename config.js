'use strict';

const path = require('node:path');

const config = {
  servidor: '1360772568436576536',
  canais: {
    analise: '1566155916120957150',
    aprovados: '1566169481347076317',
    recusados: '1566169481347076317'
  },
  cargoAprovador: '1563236861198082178',
  // O cargo aprovador também é entregue a todos: exige Gerenciar cargos.
  aprovadorExigeGerenciarCargos: true,
  companhias: {
    '1° CIA - Unidade de Controle de Distúrbios': { cargo: '1563236859113644113' },
    '2° CIA - Grupamento Tático de Ações Rápidas': { cargo: '1563236860120137840' },
    '3° CIA - Companhia de Guarda': { cargo: '1566170654557081772' }
  },
  // Nomes exibidos e usados no apelido mantidos como no bot original.
  patentes: {
    'Coronel': { cargo: '1566173298197405706', nivel: 13 },
    'T.Coronel': { cargo: '1563236837651255556', nivel: 12 },
    'Major': { cargo: '1563236838926450791', nivel: 11 },
    'Capitão': { cargo: '1563236840088150037', nivel: 10 },
    '1° Ten': { cargo: '1563236841333989567', nivel: 9 },
    '2° Ten': { cargo: '1563236842361331783', nivel: 8 },
    'Aspirante': { cargo: '1563236843611357295', nivel: 7 },
    'Sub Tenente': { cargo: '1563236844563337427', nivel: 6 },
    '1° Sgt': { cargo: '1563236846257963028', nivel: 5 },
    '2° Sgt': { cargo: '1563236847357001819', nivel: 4 },
    '3° Sgt': { cargo: '1563236848485011576', nivel: 3 },
    'Cabo': { cargo: '1563236849634381995', nivel: 2 },
    'Soldado': { cargo: '1563236850846670858', nivel: 1 }
  },
  cargosExtras: {
    qoem: '1563236853531025498',
    qopm: '1563236856664166471',
    cfs: '1563236865619001549',
    caboESoldado: '1563236867372089435',
    cfo: '1563236863559475330'
  },
  cargosParaTodos: ['1563236861198082178']
};

function cargosDaFicha(dados) {
  if (!dados || !Object.hasOwn(config.patentes, dados.patente) ||
      !Object.hasOwn(config.companhias, dados.companhia)) {
    throw new Error('Companhia ou patente inválida. Inicie novamente o registro.');
  }
  const patente = config.patentes[dados.patente];
  const cargos = [patente.cargo, config.companhias[dados.companhia].cargo,
    ...config.cargosParaTodos];
  // Aspirante pertence ao grupo de oficiais nesta configuração.
  if (patente.nivel >= config.patentes.Aspirante.nivel) {
    cargos.push(config.cargosExtras.qoem, config.cargosExtras.cfo);
  } else {
    cargos.push(config.cargosExtras.qopm);
  }
  // CFS cumulativo: também entregue aos oficiais, acima de Cabo.
  cargos.push(patente.nivel > config.patentes.Cabo.nivel
    ? config.cargosExtras.cfs : config.cargosExtras.caboESoldado);
  return [...new Set(cargos)];
}

function apelidoDaFicha(dados) {
  const apelido = `${dados.patente} PM. ${dados.nome} ${dados.tiposanguineo}`;
  if (apelido.length > 32) {
    throw new Error('O apelido ultrapassa 32 caracteres. Use um Nome de Guerra mais curto e refaça a ficha.');
  }
  return apelido;
}

const cargosGerenciados = new Set([
  ...Object.values(config.companhias).map(cia => cia.cargo),
  ...Object.values(config.patentes).map(patente => patente.cargo),
  ...Object.values(config.cargosExtras),
  ...config.cargosParaTodos
]);
const diretorioDados = path.resolve(process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data'));
const arquivoRegistros = path.join(diretorioDados, `registros-${config.servidor}.json`);

module.exports = { config, cargosDaFicha, apelidoDaFicha, cargosGerenciados, arquivoRegistros };
