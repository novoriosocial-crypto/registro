'use strict';

const { REST, Routes } = require('discord.js');
const { config } = require('./config');

const comandos = [{ name: 'painel', description: 'Envia o painel de registro policial.' }];

async function registrarComandos(token, aplicativoId) {
  if (!token) throw new Error('Cadastre a variável TOKEN no Railway com o token do novo bot.');
  const rest = new REST({ version: '10' }).setToken(token);
  if (!aplicativoId) {
    const aplicativo = await rest.get(Routes.oauth2CurrentApplication());
    aplicativoId = aplicativo.id;
  }
  await rest.put(Routes.applicationGuildCommands(aplicativoId, config.servidor), { body: comandos });
  return aplicativoId;
}

module.exports = { registrarComandos };
