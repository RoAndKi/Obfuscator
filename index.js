require('dotenv').config();
const { Client, GatewayIntentBits, Partials, AttachmentBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const keepAlive = require('./keep_alive');
const { generateVM } = require('./obfuscator');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

const commands = [
    new SlashCommandBuilder()
        .setName('obfuscate')
        .setDescription('Generate an IronBrew-like Lua VM Obfuscation')
        .addAttachmentOption(option => 
            option.setName('script')
                .setDescription('The .lua file to obfuscate')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (error) {}
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'obfuscate') {
        await interaction.deferReply({ ephemeral: true });

        const attachment = interaction.options.getAttachment('script');

        if (!attachment.name.endsWith('.lua') && !attachment.name.endsWith('.txt')) {
            return interaction.editReply('Invalid file format. Only .lua or .txt');
        }

        try {
            const response = await fetch(attachment.url);
            const sourceCode = await response.text();

            const obfuscatedCode = generateVM(sourceCode);

            const buffer = Buffer.from(obfuscatedCode, 'utf-8');
            const file = new AttachmentBuilder(buffer, { name: 'vm_obfuscated.lua' });

            await interaction.editReply({
                content: '🛡️ **VM Generation Complete!** Opcodes randomized and wrapped.',
                files: [file]
            });

        } catch (error) {
            await interaction.editReply('An error occurred.');
        }
    }
});

keepAlive();
client.login(process.env.DISCORD_TOKEN);
