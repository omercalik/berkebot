require("dotenv").config();

const { Configuration, OpenAIApi } = require("openai");

const { Client, GatewayIntentBits, Routes } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
} = require("@discordjs/voice");
const { join } = require("node:path");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");

const openApiKey = process.env["OpenAPIKey"];
const discordKey = process.env["DiscordKey"];
const openAiOrg = process.env["OpenAIOrg"];
const CLIENT_ID = process.env["CLIENT_ID"];
const GUILD_ID = process.env["GUILD_ID"];
const fs = require("fs");

const directory = fs.opendirSync("./voices");

let voices = [];

while ((file = directory.readSync()) !== null) {
  const dotIndex = file.name.indexOf(".");

  voices.push(file.name.slice(0, dotIndex));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const rest = new REST({ version: "10" }).setToken(discordKey);

//Setup OpenAI

const configuration = new Configuration({
  organization: openAiOrg,
  apiKey: openApiKey,
});

function buildSlashCommands() {
  return voices.map((voice) =>
    new SlashCommandBuilder().setName(voice).setDescription("desc")
  );
}

const player = createAudioPlayer();

const playAudio = (interaction, command) => {
  try {
    const voiceChannel = interaction.member.voice.channel;

    if (voiceChannel) {
      let resource = createAudioResource(
        join(__dirname, `/voices/${command}.mp3`)
      );
      player.play(resource);

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.member.guild.id,
        adapterCreator: interaction.member.guild.voiceAdapterCreator,
      });

      const subscription = connection.subscribe(player);

      if (subscription) {
        setTimeout(() => subscription.unsubscribe(), 10000);
      }
    } else {
      interaction.reply("Message is not in a voice channel!");
    }
  } catch (err) {
    console.error(err);
  }
};

let isReady = true;

const openai = new OpenAIApi(configuration);

client.on("interactionCreate", (interaction) => {
  if (interaction.isChatInputCommand()) {
    playAudio(interaction, interaction.commandName);
  }
});
// test
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (message.content.startsWith("!berkebot") && isReady) {
      isReady = false;
      const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: message.content.slice(9),
        temperature: 0.9,
        max_tokens: 4000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0.6,
        stop: [" Human:", " AI:"],
      });

      message.reply(`${response.data.choices[0].text}`);
    }
  } catch (error) {
    console.log(error);
  } finally {
    isReady = true;
  }
});

async function main() {
  const commands = buildSlashCommands().map((command) => command.toJSON());

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    client.login(discordKey);
  } catch (err) {
    console.log(err);
  }
}

main();
