import './setup.js';

import DiscordBot from './bot/bot.js';
const bot = new DiscordBot(); //id du bot:<@!949043541227757569>

process.bot = bot;

bot.start();
