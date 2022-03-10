import { MessageEmbed as DiscordMessageEmbed, User, Constants, MessageActionRow } from 'discord.js';
import colorLib from '../lib/color.js';
const emptyChar = '||\n||'; //affiche un espace vide, est invisible et non selectionnable
const discordMaxLength = 2048;

/**
 * Get custom color with his name
 * @param {string} color
 * @return {number} The color
 */
function getColor(color) {
	if (typeof color === 'number') return color;
	if (color?.match(colorLib.hexRegex)) {
		return colorLib.hexToDiscordColor(color);
	}
	return colorLib.getColorByName(color)?.discordColor || colorLib.edtbot_color;
}

/**
 * An EmbedMessage. To send it, use `getForMessage()`.
 */
export class EmbedMaker extends DiscordMessageEmbed {
	/**
	 * @param {string} title
	 * @param {string} description
	 * @param {DiscordMessageEmbed} embedOptions
	 */
	constructor(title, description, embedOptions) {
		super({
			title,
			description,
			...embedOptions,
			color: getColor(embedOptions?.color),
		});
		if (embedOptions) {
			if (embedOptions.prefix) {
				this.description = embedOptions.prefix;
				this.addField('', description || embedOptions.description);
			}
			if (embedOptions.suffix) {
				this.addField('', embedOptions.suffix);
			}
		}
		if (this.isTooBig()) {
			const size = this.getSize();
			console.warn(`Message trop gros pour un embed : ${this.title} ${size}`);
			const chars_to_remove = discordMaxLength - size;
			this.description = this.description.substring(0, -chars_to_remove);
		}
	}

	static Error(title, description) {
		return new EmbedMaker(title, description, { color: 'red' });
	}

	setColor(color) {
		return super.setColor(getColor(color));
	}

	/** @param {User} author */
	setAuthor(author) {
		super.setAuthor(author.username, author.avatarURL?.());
	}

	/**
	 * Add a field to the embed
	 * @param {string} name Title of the field or `''` for no title
	 * @param {string} value Content of the field
	 * @param {boolean} inline Make an inline field
	 */
	addField(name, value, inline) {
		if (this.getSize() > 2000) return this; //max: 2048
		super.addField(name || emptyChar, value, inline);
		return this;
	}

	getSize() {
		var size = this.title.length + this.description.length;
		this.fields.forEach(f => (size += f.value.length));
		return size;
	}

	isTooBig() {
		const size = this.getSize();
		return discordMaxLength <= size;
	}

	/**
	 * Get the message answer for messages
	 * @param {MessageOptions} options
	 */
	getForMessage(options) {
		return new MessageOptions([this], options);
	}
}

export class MessageMaker extends EmbedMaker {
	constructor(text) {
		super('', text);
	}
}

export class MessageOptions {
	// Discord.MessageOptions
	embeds;
	components;

	/**
	 * @param {DiscordMessageEmbed} embeds
	 * @param {MessageActionRow} options
	 */
	constructor(embeds, options) {
		this.embeds = embeds;
		this.components = options?.components;
	}
}
