# Bot de registro policial

Bot configurado para o servidor **1360772568436576536**. Os dados anteriores não acompanham este pacote.

## O que foi configurado

- Análise: `1566155916120957150`.
- Aprovados e recusados: `1566169481347076317`.
- Três companhias e as 13 patentes com os IDs enviados.
- Mesmos nomes de patentes do código original, incluindo `T.Coronel`, `1° Ten`, `2° Ten` e `Sub Tenente`.
- Apelido no mesmo formato: `Patente PM. Nome TipoSanguíneo`.
- Sem os IDs dos emojis personalizados do servidor anterior. Os emojis comuns dos botões continuam.
- As opções antigas `Al Soldado` e `Conscrito` foram retiradas, pois não receberam IDs novos.
- `config.js` concentra os IDs e as regras; `deploy.js` e o início automático usam a mesma configuração.

## Distribuição de cargos

Todos recebem o cargo da patente escolhida, o da companhia escolhida e o cargo comum `1563236861198082178`.

| Patentes | Cargos extras |
| --- | --- |
| Aspirante, 2° Ten, 1° Ten, Capitão, Major, T.Coronel e Coronel | QOEM, CFO e CFS |
| 3° Sgt, 2° Sgt, 1° Sgt e Sub Tenente | QOPM e CFS |
| Cabo e Soldado | QOPM e o cargo conjunto Cabo e Soldado |

Foi considerado **Aspirante incluído em QOEM/CFO**. CFS é cumulativo para todas as patentes acima de Cabo, inclusive oficiais. Ao aprovar uma troca de patente/companhia, o bot substitui os cargos que ele gerencia e preserva os demais cargos do membro.

## Quem pode publicar o painel, aprovar e recusar

O ID indicado para aprovar também foi indicado como cargo para todos. Por isso, a configuração exige:

- **Administrador**; ou
- Cargo `1563236861198082178` **e** permissão **Gerenciar cargos**.

O cargo comum sozinho não autoriza decisões. A permissão Gerenciar cargos deve ficar com os responsáveis. Caso queira um cargo exclusivo de aprovador, altere `cargoAprovador` em `config.js`. Isso pode ser diferente do cargo comum.

## Configurar o novo bot no Discord

1. Abra [Discord Developer Portal](https://discord.com/developers/applications) e crie ou selecione a aplicação do novo bot.
2. Em **Bot**, obtenha o token. Ele será usado somente na variável `TOKEN` do Railway. Não coloque o token no código nem no GitHub.
3. Em **Bot → Privileged Gateway Intents**, ative **Server Members Intent**. O código usa GuildMembers. Message Content Intent não é necessário.
4. Em **OAuth2 → URL Generator**, selecione os escopos `bot` e `applications.commands`.
5. Selecione as permissões **Ver canais**, **Enviar mensagens**, **Inserir links/Embed Links**, **Ler histórico de mensagens**, **Gerenciar cargos** e **Gerenciar apelidos**. Use o link gerado para adicionar o bot ao servidor configurado.
6. No Discord, coloque o cargo próprio do bot **acima de todas as patentes, companhias e cargos extras** que ele precisa atribuir ou remover. Dê também acesso aos canais de análise e resultados.

Não é preciso preencher um CLIENT_ID: o aplicativo é identificado automaticamente pelo token. O nome e a foto do novo bot são definidos no Developer Portal, não pelos IDs de cargos.

## Hospedar no Railway

1. Extraia este ZIP e coloque os arquivos da pasta `bot-registro-main` na raiz do repositório GitHub destinado a este primeiro bot. `package.json`, `index.js` e `railway.json` devem ficar juntos na raiz.
2. No Railway, crie um projeto/serviço usando esse repositório. Este bot deve ter seu próprio serviço; o segundo bot será configurado separadamente.
3. Em **Variables**, adicione **TOKEN** com o token do novo bot, sem aspas.
4. Conecte um **Volume** ao serviço e monte em **`/data`**. O bot detecta `RAILWAY_VOLUME_MOUNT_PATH` automaticamente. Isso preserva as fichas pendentes entre deploys. Sem o volume, o arquivo local pode desaparecer quando o serviço for recriado.
5. Use **uma única réplica**. A persistência em JSON não foi feita para múltiplos processos simultâneos.
6. O comando de início já está definido: **`npm start`**. A versão de Node está definida no `package.json` como 24, a partir de 24.17.0.
7. Faça o deploy e confira nos logs a mensagem de bot online e `/painel` registrado.
8. No Discord, use **`/painel`** em um canal que o bot possa acessar, com um usuário autorizado. O painel pode ser utilizado pelos membros para preencher a ficha.

Este é um serviço de bot, sem página web: não precisa criar domínio público nem configurar uma porta HTTP.

### Arquivo de dados

As fichas ficam no arquivo `registros-1360772568436576536.json`, dentro do volume. Para um volume montado em `/data`, o caminho é `/data/registros-1360772568436576536.json`. Opcionalmente, a variável `DATA_DIR` pode indicar outro diretório. Não coloque dados antigos nesse diretório se deseja começar do zero.

Fichas enviadas não podem ser sobrescritas enquanto aguardam decisão. O botão de aprovação é vinculado à mensagem correspondente; decisões concorrentes e repetidas são bloqueadas. Depois da decisão, os botões são desativados e a ficha temporária é removida.

### Se algo impedir uma aprovação

- Se os cargos não puderem ser aplicados, não há anúncio de aprovação; a ficha continua pendente.
- Se apenas o apelido não puder ser alterado, os cargos são aplicados e o responsável recebe aviso com o apelido para ajuste manual. O Discord restringe alterações no dono do servidor e em membros acima do bot.
- Apelidos acima de 32 caracteres são recusados antes do envio. Use um Nome de Guerra mais curto.
- Se o log de resultado falhar depois da decisão, o responsável recebe aviso e a concessão de cargos não é repetida.

## Rodar localmente

Com Node.js 24.17.0 ou superior, dentro da série 24:

```bash
npm ci
npm test
npm start
```

Para o teste local do bot online, crie um arquivo `.env` a partir de `.env.example` e coloque `TOKEN` nele. Esse arquivo é ignorado pelo Git. Os testes automatizados funcionam sem token e não conectam ao Discord.

O comando opcional `npm run deploy` registra o `/painel` usando o mesmo token e servidor. Normalmente é desnecessário, pois `npm start` já registra o comando ao entrar online.

## Referências

- [Documentação discord.js 14.26.4](https://discord.js.org/docs/packages/discord.js/14.26.4)
- [Permissões e hierarquia do Discord](https://docs.discord.com/developers/topics/permissions)
- [Gateway Intents do Discord](https://docs.discord.com/developers/events/gateway)
- [Variáveis do Railway](https://docs.railway.com/variables)
- [Comando de início do Railway](https://docs.railway.com/deployments/start-command)
- [Volumes do Railway](https://docs.railway.com/volumes)
