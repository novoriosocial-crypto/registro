'use strict';

const {
  Client, GatewayIntentBits, Events, ModalBuilder, TextInputBuilder,
  TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits
} = require('discord.js');
const { config, cargosDaFicha, apelidoDaFicha, cargosGerenciados, arquivoRegistros } = require('./config');
const { Registros } = require('./registros');
const { registrarComandos } = require('./comandos');

function podeAprovar(membro) {
  return membro.permissions.has(PermissionFlagsBits.Administrator) || (
    membro.roles.cache.has(config.cargoAprovador) &&
    (!config.aprovadorExigeGerenciarCargos || membro.permissions.has(PermissionFlagsBits.ManageRoles))
  );
}

async function obterCanal(guild, id) {
  const canal = await guild.channels.fetch(id);
  if (!canal || !canal.isTextBased() || typeof canal.send !== 'function') {
    throw new Error(`O canal ${id} não existe ou não aceita mensagens.`);
  }
  return canal;
}

function criarHandler({ client, registros, logger = console }) {
  // Uma única instância do bot deve usar este arquivo/volume.
  const processando = new Set();

  function obterRascunho(userId) {
    if (processando.has(userId)) throw new Error('Sua ficha já está sendo processada. Aguarde.');
    const dados = registros.get(userId);
    if (!dados) throw new Error('Sua ficha não foi encontrada. Clique em Iniciar Registro.');
    if (dados.status !== 'rascunho') throw new Error('Sua ficha já foi enviada para análise. Aguarde a decisão.');
    return dados;
  }

  return async function tratarInteracao(interaction) {
    try {
      if (interaction.guildId !== config.servidor || !interaction.inCachedGuild()) {
        return await interaction.reply({ content: 'Este bot atende somente ao servidor configurado.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.isChatInputCommand() && interaction.commandName === 'painel') {
        if (!podeAprovar(interaction.member)) {
          throw new Error('Apenas administradores ou membros autorizados com Gerenciar cargos podem enviar o painel.');
        }
        const embed = new EmbedBuilder()
          .setTitle('🛡️ SISTEMA DE INCORPORAÇÃO POLICIAL')
          .setDescription('Seja bem-vindo ao departamento de cadastros.\n\nPara iniciar sua solicitação de incorporação e atualizar seus dados na corporação, clique no botão **Iniciar Registro** logo abaixo.')
          .setColor('#1d4ed8')
          .setFooter({ text: 'DIRETORIA DE RECRUTAMENTO E SELEÇÃO DE PESSOAL', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();
        const icone = interaction.guild.iconURL();
        if (icone) embed.setThumbnail(icone);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder()
          .setCustomId('abrir_registro').setLabel('Iniciar Registro')
          .setStyle(ButtonStyle.Primary).setEmoji('📝'));
        return await interaction.reply({ embeds: [embed], components: [row] });
      }

      if (interaction.isButton() && interaction.customId === 'abrir_registro') {
        if (processando.has(interaction.user.id) || registros.get(interaction.user.id)?.status === 'pendente') {
          throw new Error('Você já tem uma ficha aguardando análise. Aguarde a decisão.');
        }
        const modal = new ModalBuilder().setCustomId('modal_registro').setTitle('Ficha de Registro Policial');
        const campos = [
          ['nome', 'Nome de Guerra', 'Ex: A. Santos', 32],
          ['tiposanguineo', 'Tipo Sanguíneo', 'Ex: AB-', 3],
          ['autorizacao', 'Quem autorizou?', 'Ex: Cel. Roberto', 100]
        ];
        modal.addComponents(campos.map(([id, label, placeholder, maxLength]) =>
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id)
            .setLabel(label).setStyle(TextInputStyle.Short).setPlaceholder(placeholder)
            .setMaxLength(maxLength).setRequired(true))));
        return await interaction.showModal(modal);
      }

      if (interaction.isModalSubmit() && interaction.customId === 'modal_registro') {
        if (processando.has(interaction.user.id) || registros.get(interaction.user.id)?.status === 'pendente') {
          throw new Error('Você já tem uma ficha aguardando análise. Aguarde a decisão.');
        }
        const dados = {
          nome: interaction.fields.getTextInputValue('nome').trim().replace(/\s+/g, ' '),
          tiposanguineo: interaction.fields.getTextInputValue('tiposanguineo').trim().toUpperCase(),
          autorizacao: interaction.fields.getTextInputValue('autorizacao').trim(),
          status: 'rascunho'
        };
        if (!dados.nome || !dados.autorizacao) throw new Error('Preencha o nome e quem autorizou o registro.');
        if (!/^(?:A|B|AB|O)[+-]$/.test(dados.tiposanguineo)) {
          throw new Error('Informe o tipo sanguíneo como A+, A-, B+, B-, AB+, AB-, O+ ou O-.');
        }
        registros.set(interaction.user.id, dados);
        const menu = new StringSelectMenuBuilder().setCustomId('selecionar_companhia')
          .setPlaceholder('Escolha a sua Companhia...')
          .addOptions(Object.keys(config.companhias).map(cia => ({ label: cia, value: cia })));
        return await interaction.reply({ content: '↳ **Etapa 2/4:** Selecione a sua companhia abaixo:',
          flags: MessageFlags.Ephemeral, components: [new ActionRowBuilder().addComponents(menu)] });
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'selecionar_companhia') {
        const dados = obterRascunho(interaction.user.id);
        const companhia = interaction.values[0];
        if (!Object.hasOwn(config.companhias, companhia)) throw new Error('Companhia inválida. Refaça o registro.');
        registros.set(interaction.user.id, { ...dados, companhia, patente: undefined });
        const menu = new StringSelectMenuBuilder().setCustomId('selecionar_patente')
          .setPlaceholder('Escolha a sua Patente...')
          .addOptions(Object.keys(config.patentes).map(patente => ({ label: patente, value: patente })));
        return await interaction.update({ content: '↳ **Etapa 3/4:** Selecione a sua Patente abaixo:',
          components: [new ActionRowBuilder().addComponents(menu)] });
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'selecionar_patente') {
        const dados = obterRascunho(interaction.user.id);
        const patente = interaction.values[0];
        const ficha = { ...dados, patente };
        cargosDaFicha(ficha);
        const apelido = apelidoDaFicha(ficha);
        registros.set(interaction.user.id, ficha);
        return await interaction.update({
          content: `📋 **Tudo pronto!** Revise as informações principais:\n• Companhia: **${ficha.companhia}**\n• Patente: **${ficha.patente}**\n• Apelido: **${apelido}**\n\nClique no botão abaixo para enviar sua ficha para análise.`,
          components: [new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId('confirmar_registro').setLabel('Enviar Ficha para Análise')
            .setStyle(ButtonStyle.Success).setEmoji('✅'))], allowedMentions: { parse: [] }
        });
      }

      if (interaction.isButton() && interaction.customId === 'confirmar_registro') {
        const dados = obterRascunho(interaction.user.id);
        cargosDaFicha(dados);
        apelidoDaFicha(dados);
        processando.add(interaction.user.id);
        try {
          await interaction.deferUpdate();
          const canal = await obterCanal(interaction.guild, config.canais.analise);
          const embed = new EmbedBuilder().setTitle('⏳ AGUARDANDO APROVAÇÃO')
            .setDescription('Uma nova ficha de incorporação foi enviada e necessita de validação.')
            .setColor('#eab308').addFields(
              { name: '👤 Policial:', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)` },
              { name: '🪪 Nome de Guerra:', value: dados.nome, inline: true },
              { name: '🩸 Tipo Sanguíneo:', value: dados.tiposanguineo, inline: true },
              { name: '🔑 Autorizado por:', value: dados.autorizacao, inline: true },
              { name: '🛡️ Companhia:', value: dados.companhia, inline: true },
              { name: '🎖️ Patente Solicitada:', value: dados.patente, inline: true }
            ).setThumbnail(interaction.user.displayAvatarURL()).setTimestamp();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprovar_${interaction.user.id}`).setLabel('Aprovar Registro').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`negar_${interaction.user.id}`).setLabel('Recusar Registro').setStyle(ButtonStyle.Danger).setEmoji('❌')
          );
          const mensagem = await canal.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
          try {
            registros.set(interaction.user.id, { ...dados, status: 'pendente', mensagemId: mensagem.id });
          } catch (error) {
            await mensagem.edit({ content: 'Ficha cancelada: não foi possível salvar os dados. Reenvie o registro.', embeds: [], components: [] });
            throw error;
          }
          return await interaction.editReply({ content: '✅ **Sua ficha foi enviada com sucesso!** Aguarde a avaliação dos responsáveis.', components: [] });
        } finally {
          processando.delete(interaction.user.id);
        }
      }

      if (interaction.isButton() && /^(aprovar|negar)_\d+$/.test(interaction.customId)) {
        if (!podeAprovar(interaction.member)) {
          throw new Error('Você precisa ser administrador ou ter o cargo autorizado e a permissão Gerenciar cargos.');
        }
        const [acao, userId] = interaction.customId.split('_');
        const dados = registros.get(userId);
        if (!dados || dados.status !== 'pendente' || dados.mensagemId !== interaction.message.id) {
          throw new Error('Esta ficha já foi processada ou não corresponde ao registro atual.');
        }
        if (processando.has(userId)) throw new Error('Esta ficha já está sendo processada por outro responsável.');
        processando.add(userId);
        try {
          await interaction.deferUpdate();
          const aprovador = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
          if (!podeAprovar(aprovador)) throw new Error('Você não possui mais autorização para decidir este registro.');
          let avisoApelido = '';
          if (acao === 'aprovar') {
            const cargos = cargosDaFicha(dados);
            const apelido = apelidoDaFicha(dados);
            await interaction.guild.roles.fetch();
            const bot = await interaction.guild.members.fetchMe();
            if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) {
              throw new Error('O bot precisa da permissão Gerenciar cargos. A ficha continua pendente.');
            }
            const membro = await interaction.guild.members.fetch({ user: userId, force: true });
            // Apenas os cargos mapeados por este bot são substituídos.
            const anteriores = membro.roles.cache.filter(role => cargosGerenciados.has(role.id));
            for (const id of new Set([...cargos, ...anteriores.keys()])) {
              const cargo = interaction.guild.roles.cache.get(id);
              if (!cargo || !cargo.editable) {
                throw new Error(`O cargo ${id} não existe ou está acima do bot. Coloque o cargo do bot acima dos cargos configurados.`);
              }
            }
            const preservados = membro.roles.cache
              .filter(role => role.id !== config.servidor && !cargosGerenciados.has(role.id))
              .map(role => role.id);
            await membro.roles.set([...new Set([...preservados, ...cargos])], `Registro aprovado por ${interaction.user.tag}`);
            // A aprovação depende dos cargos; uma restrição ao apelido é informada.
            try {
              await membro.setNickname(apelido, `Registro aprovado por ${interaction.user.tag}`);
            } catch (error) {
              logger.warn('Cargos aplicados, mas o apelido não foi alterado:', error.message);
              avisoApelido = `\n⚠️ Os cargos foram aplicados, mas o Discord não permitiu mudar o apelido. Ajuste manualmente para: **${apelido}**.`;
            }
          }
          registros.set(userId, { ...dados, status: acao === 'aprovar' ? 'aprovado' : 'recusado', decididoPor: interaction.user.id });
          let avisoLog = '';
          try {
            const idCanal = acao === 'aprovar' ? config.canais.aprovados : config.canais.recusados;
            const canal = await obterCanal(interaction.guild, idCanal);
            const embed = new EmbedBuilder()
              .setTitle(acao === 'aprovar' ? '✅ CORPORAÇÃO ATUALIZADA - INCORPORADO' : '❌ SOLICITAÇÃO RECUSADA')
              .setColor(acao === 'aprovar' ? '#22c55e' : '#ef4444')
              .addFields(
                { name: '👤 Policial:', value: `<@${userId}> (\`${userId}\`)` },
                { name: '🪪 Nome de Guerra:', value: dados.nome, inline: true },
                { name: '🩸 Tipo Sanguíneo:', value: dados.tiposanguineo, inline: true },
                { name: '🛡️ Companhia:', value: dados.companhia, inline: true },
                { name: '🎖️ Patente/Cargo:', value: dados.patente, inline: true }
              ).setFooter({ text: `${acao === 'aprovar' ? 'Aprovado' : 'Recusado'} por: ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if (avisoApelido) embed.addFields({ name: 'Apelido:', value: `Alteração manual necessária: ${apelidoDaFicha(dados)}` });
            await canal.send({ embeds: [embed], allowedMentions: { parse: [] } });
          } catch (error) {
            logger.error('Decisão concluída, mas não foi possível enviar o log:', error.message);
            avisoLog = '\n⚠️ Não foi possível enviar o log. Verifique as permissões do canal de resultados.';
          }
          await interaction.editReply({ content: `${acao === 'aprovar' ? '✅' : '❌'} O registro de <@${userId}> foi **${acao === 'aprovar' ? 'aprovado' : 'recusado'}**!${avisoApelido}${avisoLog}`,
            embeds: [], components: [], allowedMentions: { parse: [] } });
          registros.delete(userId);
          return;
        } finally {
          processando.delete(userId);
        }
      }
    } catch (error) {
      logger.error('Erro ao processar interação:', error.message);
      const resposta = { content: `❌ ${error.message}`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
      try {
        if (interaction.deferred || interaction.replied) await interaction.followUp(resposta);
        else await interaction.reply(resposta);
      } catch (falha) {
        logger.error('Não foi possível responder à interação:', falha.message);
      }
    }
  };
}

async function iniciar() {
  const token = process.env.TOKEN?.trim();
  if (!token) throw new Error('Cadastre TOKEN em Variables no Railway com o token do novo bot.');
  const registros = new Registros(arquivoRegistros);
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  client.on(Events.InteractionCreate, criarHandler({ client, registros }));
  client.on(Events.Error, error => console.error('Erro do cliente Discord:', error.message));
  client.once(Events.ClientReady, () => {
    (async () => {
      const guild = await client.guilds.fetch(config.servidor);
      await guild.roles.fetch();
      const ausentes = [...cargosGerenciados].filter(id => !guild.roles.cache.has(id));
      if (ausentes.length) throw new Error(`Cargos não encontrados no servidor: ${ausentes.join(', ')}`);
      await registrarComandos(token, client.application.id);
      console.log(`✅ ${client.user.tag} online no servidor ${guild.name}. Comando /painel registrado.`);
      console.log(`Registros: ${arquivoRegistros}`);
      if (process.env.RAILWAY_ENVIRONMENT_ID && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
        console.warn('Conecte um Volume em /data para preservar fichas pendentes entre deploys.');
      }
    })().catch(error => {
      console.error('Falha na inicialização:', error.message);
      client.destroy();
      process.exitCode = 1;
    });
  });
  for (const sinal of ['SIGTERM', 'SIGINT']) {
    process.once(sinal, () => { client.destroy(); process.exit(0); });
  }
  try {
    await client.login(token);
  } catch (error) {
    client.destroy();
    throw error;
  }
}

if (require.main === module) {
  iniciar().catch(error => { console.error('Não foi possível iniciar o bot:', error.message); process.exitCode = 1; });
}

module.exports = { criarHandler, podeAprovar };
