'use strict';

const { registrarComandos } = require('./comandos');

registrarComandos(process.env.TOKEN?.trim())
  .then(id => console.log(`Comando /painel registrado para o aplicativo ${id}.`))
  .catch(error => {
    console.error('Não foi possível registrar /painel:', error.message);
    process.exitCode = 1;
  });
