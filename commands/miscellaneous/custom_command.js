import { Collection } from 'discord.js';
import DiscordBot from '../../bot/bot.js';
import CommandStored from '../../bot/command/commandStored.js';
import { CommandLevelOptions, ReceivedCommand } from '../../bot/command/received.js';
import { isCustomCommandPrivilege } from '../../bot/command/security.js';
import { DatabaseTable } from '../../lib/database.js';
import { getFrenchDate, getFrenchTime } from '../../lib/date.js';
import { EmbedMaker } from '../../lib/messageMaker.js';

/**
 * @type {DiscordBot}
 */
var bot;
/**
 * @type {DatabaseTable}
 */
var commandsTable;
/**
 * @type {Collection<string, string} Custom command & callback
 */
var commandsCallback = new Collection();

const optionCommandName = {
	name: 'commande',
	description: 'Nom de la commande',
	type: 3,
	required: true,
};

export default {
	name: 'custom_command',
	description: 'Créer des commandes custom',

	alts: ['cc'],

	security: {
		interaction: true,
		place: 'public',
		isAllowedToUse: isCustomCommandPrivilege,
	},

	// format: get [name], set [name] [content], exec [name]
	options: [
		{
			name: 'get',
			description: 'Récupérer une commande',
			type: 1,
			options: [optionCommandName],

			/**
			 * Executed with option(s)
			 * @param {ReceivedCommand} cmdData
			 * @param {CommandLevelOptions} levelOptions
			 */
			async executeAttribute(cmdData, levelOptions) {
				const commande = levelOptions.getArgument('commande', 0).value.toLowerCase();
				const content = getCustomCommand(commande);
				if (content) return new EmbedMaker(`Custom Command '${commande}'`, '```\n' + content + '\n```');
				else return new EmbedMaker(`Custom Command '${commande}'`, 'Commande inconnue');
			},
		},
		{
			name: 'set',
			description: 'Modifier une commande',
			type: 1,
			options: [
				optionCommandName,
				{
					name: 'message',
					description: 'Contenu de la commande',
					type: 3,
					required: true,
				},
			],

			/**
			 * Executed with option(s)
			 * @param {ReceivedCommand} cmdData
			 * @param {CommandLevelOptions} levelOptions
			 */
			async executeAttribute(cmdData, levelOptions) {
				/** @type {string} */
				var commande = levelOptions.getArgument('commande', 0).value;
				levelOptions.options.shift();
				var content = levelOptions.options.map(o => o.value).join(' ');
				if (commande.match(/\s/)) {
					const match = commande.match(/\s/);
					content = commande.substring(match.index + 1) + ' ' + content;
					commande = commande.substring(0, match.index);
				}

				commande = commande.toLowerCase();
				if (bot.commandMgr.commands.has(commande) || bot.commandMgr.altCommands.has(commande)) {
					return new EmbedMaker.Error(`Custom Command ${commande}`, `Ce nom est déjà utilisé par une commande du bot. Choisissez autre chose.`);
				}

				return setCustomCommand(commande, content);
			},
		},
		{
			name: 'exec',
			description: 'Executer une commande',
			type: 1,
			options: [optionCommandName],

			/**
			 * Executed with option(s)
			 * @param {ReceivedCommand} cmdData
			 * @param {CommandLevelOptions} levelOptions
			 */
			async executeAttribute(cmdData, levelOptions) {
				const commande = levelOptions.getArgument('commande', 0).value.toLowerCase();
				levelOptions.options.shift();
				const args = levelOptions.options.map(o => o.value);

				return execCommand(commande, cmdData, args);
			},
		},
	],

	/**
	 * Executed when there is no valid option
	 * @param {ReceivedCommand} cmdData
	 */
	async execute(cmdData) {
		if (commandsCallback.size) {
			const commandsName = Array.from(commandsCallback.keys()).map(c => ' - ' + c);
			return new EmbedMaker('Custom Commande', `Il y a ${commandsCallback.size} commandes custom disponibles :\n${commandsName.join('\n')}`);
		} else {
			return new EmbedMaker('Custom Commande', `Il n'y a pas encore de commandes custom disponibles`);
		}
	},

	/**
	 * @param {DiscordBot} b
	 */
	setBot: async b => {
		bot = b;
		commandsTable = new DatabaseTable(bot.database, 'custom_commands');
		await commandsTable.initTable('id SERIAL PRIMARY KEY', 'name TEXT', 'content TEXT');
		await loadCustomCommands();
	},
};

async function loadCustomCommands() {
	const commands = await commandsTable.get('', 'name,content');

	bot.commandMgr.customCommands.clear();
	commandsCallback.clear();
	for (const command of commands) {
		/**
		 * @type {string}
		 */
		const name = DatabaseTable.decodeText(command.name);
		/**
		 * @type {string}
		 */
		const content = DatabaseTable.decodeText(command.content);

		commandsCallback.set(name, content);
		bot.commandMgr.customCommands.set(name, commandHandler);
	}
	bot.consoleLogger.log(`Custom Commands : reloaded with ${bot.commandMgr.customCommands.size} commands`.green);
}

/**
 * @param {string} name
 */
function getCustomCommand(name) {
	return commandsCallback.get(name.toLowerCase());
}

/**
 * @param {string} name
 * @param {string} content
 */
async function setCustomCommand(name, content) {
	var result;
	const dbName = DatabaseTable.encodeText(name);
	const dbContent = DatabaseTable.encodeText(content);
	if (content === '') {
		if (commandsCallback.has(name)) {
			bot.commandMgr.customCommands.delete(name);
			commandsCallback.delete(name);
			const deleteResult = await commandsTable.delete(`name='${dbName}'`);
			result = deleteResult ? `La commande a été supprimée` : `La commande n'a pas pu être supprimée`;
		} else {
			result = `La commande n'existe pas`;
		}
	} else {
		var storeResult;
		const justeUpdate = commandsCallback.has(name);
		if (justeUpdate) storeResult = await commandsTable.set(`name='${dbName}'`, `name='${dbName}',content='${dbContent}'`);
		else storeResult = await commandsTable.insert('name,content', [dbName, dbContent]);

		if (storeResult.rowCount) {
			result = `La commande a été sauvegardée`;
			commandsCallback.set(name, content);
			bot.commandMgr.customCommands.set(name, commandHandler);
		} else {
			result = `La commande n'a pas pu être sauvegardée`;
			bot.commandMgr.customCommands.delete(name);
			commandsCallback.delete(name);
			console.warn(`La commande n'a pas pu être sauvegardée`, { name, content, storeResult });
		}
	}

	return new EmbedMaker(`Custom Command '${name}'`, result);
}

/**
 * @param {string} name
 * @param {ReceivedCommand} cmdData
 * @param {string[]} args
 */
async function execCommand(name, cmdData, args) {
	var content = getCustomCommand(name);
	if (!content) return `La commande n'existe pas`;
	cmdData.customCommand = name;

	for (const replaceRule of replaceBasicRules) {
		content = await replaceContent(content, replaceRule[0], replaceRule[1], cmdData);
	}

	var choices = [];
	content = await replaceContent(content, /{choose(\d*):([^\{\}]+)}/i, match => {
		const chooseId = parseInt(match[1]) || 0;
		const chooseValues = match[2].split(';');
		choices[chooseId] = chooseValues[Math.ceil(Math.random() * chooseValues.length)];
		return '';
	});
	content = await replaceContent(content, /{choice(\d*)}/i, match => choices[parseInt(match[1]) || 0] || match[0]);

	for (const replaceRule of replaceWithHiddenAction) {
		content = await replaceContent(content, replaceRule[0], replaceRule[1], cmdData);
	}

	return new EmbedMaker(name, content);
}

/**
 * @param {string} content
 * @param {RegExp} regex
 * @param {Function} callback
 * @param {ReceivedCommand} cmdData
 */
async function replaceContent(content, regex, callback, cmdData) {
	if (content.search(regex) === -1) return content;

	if (regex.global) {
		const replaceWith = await callback(cmdData);
		return content.replace(regex, replaceWith);
	} else {
		while (content.search(regex) !== -1) {
			const match = content.match(regex);
			content = content.replace(match[0], await callback(match, cmdData));
		}
		return content;
	}
}

/** @type {[RegExp,Function][]} */
const replaceBasicRules = [
	[/{time}/gi, () => getFrenchTime(Date.now(), false)],
	[/{date}/gi, () => getFrenchDate(Date.now(), { noTimezone: true, noArticle: true, noTime: true })],
	[/{user}/gi, cmdData => `<@!${cmdData.author.id}>`],
	[/{channel}/gi, cmdData => `<#${cmdData.context.channel_id}>`],
	[/{\$(\d+)}/i, match => args[parseInt(match[1])] || ''],
];
/** @type {[RegExp,Function][]} */
const replaceWithHiddenAction = [
	[
		/{!role *<@!?(\d{10,30})> *([t\+\-]?) *<@&(\d{10,30})> *}\n?/i,
		/**
		 * @param {RegExpMatchArray} match
		 * @param {ReceivedCommand} cmdData
		 */
		async (match, cmdData) => {
			const userId = match[1];
			var action = match[2] || '+';
			const roleId = match[3];

			const guild = await cmdData.context.getGuild();
			if (!guild) return `{Not in a guild}`;
			const user = await guild.members.fetch(userId);
			if (!user) return `{Unknown User ${userId}}`;

			try {
				if (action === 't') action = user.roles.has(roleId) ? '-' : '+'; // Toggle
				if (action === '+') await user.roles.add(roleId, `Custom Command '${cmdData.customCommand}'`);
				else if (action === '-') await user.roles.remove(roleId, `Custom Command '${cmdData.customCommand}'`);
				else return `{Unknown action ${action}}`;
			} catch (error) {
				console.error(`Can't edit role <@&${roleId}> for <@!${user.id}>`);
				return '{Require roles permissions}';
			}

			return '';
		},
	],
	[
		/{!announce *<#(\d{10,30})>}\s*([^\n]*)\n?/i,
		/**
		 * @param {RegExpMatchArray} match
		 * @param {ReceivedCommand} cmdData
		 */
		async (match, cmdData) => {
			const channelId = match[1];
			const message = match[2];

			const guild = await cmdData.context.getGuild();
			const channel = (await guild?.channels?.fetch(channelId)) || (await cmdData.context.getGuild());

			if (channel) channel.send(new EmbedMaker('', message).getForMessage());
			else cmdData.sendAnswer(new EmbedMaker('', message));

			return '';
		},
	],
];

const commandHandler = new CommandStored({
	name: 'custom',
	description: `Callback for custom_command' commands`,
	security: {
		place: 'public',
		interaction: false,
		hidden: true,
	},
	/**
	 * Executed with option(s)
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions
	 */
	executeAttribute(cmdData, levelOptions) {
		const commande = cmdData.commandName;
		const args = levelOptions.options.map(o => o.value);
		return execCommand(commande, cmdData, args);
	},

	/**
	 * Executed with option(s)
	 * @param {ReceivedCommand} cmdData
	 */
	execute(cmdData) {
		const commande = cmdData.commandName;
		return execCommand(commande, cmdData, []);
	},
});
