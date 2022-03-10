import { EmbedMaker } from '../../lib/messageMaker.js';
import { CommandArgument, CommandContext, CommandLevelOptions, ReceivedCommand } from '../../bot/command/received.js';
import LocalApplicationCommand from '../../bot/command/commandStored.js';
import { Collection } from 'discord.js';
import { indentString } from '../../lib/utils.js';

/**
 * Make a Help message
 * @param {string} description
 */
function makeMessage(description) {
	return new EmbedMaker('Help', description);
}
/**
 * Make a Help message
 * @param {string} description
 */
function makeError(description) {
	return EmbedMaker.Error('Help', description);
}

/**
 * get a command base on the option given
 * @param {ReceivedCommand} cmdData
 * @param {CommandLevelOptions} levelOptions
 */
function getCommandToHelp(cmdData, levelOptions) {
	const [{ value: commandName }, nextLevelOptions] = levelOptions.getNextLevelOptions();

	const command = cmdData.bot.commandMgr.getCommand(commandName, true);
	if (!command) return;

	const [subCommand] = command.getSubCommand(nextLevelOptions);
	if (!subCommand.security.isAllowedToSee(cmdData.context)) {
		return `You can't do that`;
	}
	return subCommand;
}

export default {
	name: 'help',
	description: 'Affiche les commandes disponibles',

	security: {
		place: 'public',
		interaction: true,
	},

	options: [
		{
			name: 'command',
			description: 'Détaille une commande (/help "bot info")',
			type: 3,
			required: false,
		},
	],

	/**
	 * Executed with option(s)
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions
	 */
	executeAttribute(cmdData, levelOptions) {
		//split options with spaces
		var levelOptions2 = new CommandLevelOptions([]);
		levelOptions.options.forEach(option => {
			levelOptions2.options.push(...option.value.split(' ').map(v => new CommandArgument({ name: v, value: v })));
		});
		const command = getCommandToHelp(cmdData, levelOptions2);

		if (typeof command == 'string') {
			return makeError(command);
		}
		if (!command) {
			return this.execute(cmdData);
		}
		if (!command.description) {
			return console.warn(`${command.name} has no description`.yellow);
		}
		const helpDesc = command.getHelpDescription(cmdData.context);
		if (helpDesc.constructor == EmbedMaker) return helpDesc;
		return makeMessage(helpDesc);
	},

	/**
	 * Executed when there is no valid option
	 * @param {ReceivedCommand} cmdData
	 */
	execute(cmdData) {
		return makeMessage(getFullDescription(cmdData, cmdData.bot.commandMgr.commands));
	},
};

/**
 * get a readable description of options
 * @param {CommandContext} context
 * @param {Collection<string,LocalApplicationCommand>} commands
 */
function getFullDescription(context, commands) {
	//every commands
	const commandsSmallDesc = commands
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(command => command.getHelpSmallDescription(context))
		.filter(c => c != undefined);
	var commandsDesc = indentString(commandsSmallDesc.join('\n'), '\xa0 \xa0 \xa0 \xa0 ');

	const botDesc = "Préfix du bot : '!', '@EDT-Bot', compatible avec les interactions";
	if (!commandsDesc) return botDesc;
	return botDesc + '\n' + commandsDesc;
}
