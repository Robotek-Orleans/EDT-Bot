import { Message } from 'discord.js';
import { extractPrefix } from '../../lib/commandTools.js';
import { ReceivedMessage } from './received.js';
import commandHandler from '../command/commandHandler.js';
import DiscordBot from '../bot.js';

/**
 * Read every messages that the bot can read
 * @param {DiscordBot} bot
 * @param {Message} message
 */
export default async function messageHandler(bot, message) {
	if (isCommand(message) && bot.commandEnabled) {
		const cmdData = new ReceivedMessage(message, bot);

		try {
			await commandHandler(cmdData);
		} catch (error) {
			message.reply(`Sorry I've had an error while sending the answer: ${error}`);
			process.consoleLogger.error(`Error while sending an answer for '${cmdData.commandLine}' ${error}`.red);
		}
	}
}

/**
 * Preparer le message pour les commandes
 * @param {Message} message
 */
function isCommand(message) {
	if (message.isCommand) return true;

	const [content, prefix] = extractPrefix(message.content);
	if (prefix == undefined) return;

	message.content = content;
	message.prefix = prefix;
	message.isCommand = true;
	return true;
}
