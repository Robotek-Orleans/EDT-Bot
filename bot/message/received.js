import { Message } from 'discord.js';
import { EmbedMaker } from '../../lib/messageMaker.js';
import DiscordBot from '../bot.js';
import { CommandContext, CommandContent, makeSafeMessage, ReceivedCommand } from '../command/received.js';

class CommandContextMessage extends CommandContext {
	message;

	/**
	 * Make a CommandContext from a message
	 * @param {Message} message
	 */
	constructor(message, bot) {
		super(bot);
		this.message = message;
	}

	get guild_id() {
		return this.message.guildId;
	}
	getGuild() {
		return this.message.guild;
	}
	get channel_id() {
		return this.message.channelId;
	}
	getChannel() {
		return this.message.channel;
	}
	get author_id() {
		return this.message.author.id;
	}
	getAuthor() {
		return this.message.author;
	}
}

export class ReceivedMessage extends ReceivedCommand {
	/**
	 * @type {CommandContextMessage}
	 */
	get context() {
		return super.context;
	}

	get message() {
		return this.context.message;
	}
	get commandSource() {
		return this.context.message;
	}

	/**
	 * @param {Message} message
	 * @param {DiscordBot} bot
	 */
	constructor(message, bot) {
		super(CommandContent.fromMessage(message), new CommandContextMessage(message, bot));
	}

	get isMessage() {
		return true;
	}
	get isPrivateMessage() {
		return this.message.channel.type == 'DM' || this.message.channel.type == 'GROUP_DM' || this.message.channel.type == 'UNKNOWN';
	}

	/**
	 * Send the answer to the command
	 * @param {EmbedMaker} answer The answer
	 */
	async sendAnswer(answer) {
		answer = makeSafeMessage(answer);
		if (!answer) return false;

		this.answeredAt = Date.now();
		if (answer.type == 3) {
			//don't reply
			return await this.message.channel.send(answer.getForMessage());
		}
		return await this.message.reply(answer.getForMessage());
	}

	/**
	 * @param {string | MessagePayload | EmbedMaker} options The answer
	 */
	async reply(options) {
		this.setReplied();
		return await this.message.reply(options);
	}
}
