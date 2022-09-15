import { SecurityPlaces, SecurityCommand } from './security.js';
import { EmbedMaker } from '../../lib/messageMaker.js';
import { CommandLevelOptions, CommandContext, ReceivedCommand } from './received.js';
import { ApplicationCommandOptionType, ApplicationCommand as DiscordApplicationCommand, ApplicationCommandType } from 'discord.js';
import Discord from 'discord.js';
import { indentString, indentNextLines, strToFlatStr } from '../../lib/utils.js';

export const ApplicationCommandOptionTypes = {
	APPLICATION_COMMAND: 0,
	SUB_COMMAND: ApplicationCommandOptionType.Subcommand,
	SUB_COMMAND_GROUP: ApplicationCommandOptionType.SubcommandGroup,
	STRING: ApplicationCommandOptionType.String,
	INTEGER: ApplicationCommandOptionType.Integer,
	BOOLEAN: ApplicationCommandOptionType.Boolean,
	USER: ApplicationCommandOptionType.User,
	CHANNEL: ApplicationCommandOptionType.Channel,
	ROLE: ApplicationCommandOptionType.Role,
	MENTIONABLE: ApplicationCommandOptionType.Mentionable,
	NUMBER: ApplicationCommandOptionType.Number,
	ATTACHMENT: ApplicationCommandOptionType.Attachment

};

class AbstractCommandOption {
	//https://discord.com/developers/docs/interactions/application-commands
	name;
	flatName;
	get type() {
		throw `AbstractCommandOption is an abstract class`;
	}
	isAllowedOptionType() { }
	description;
	/**
	 * Get the full Help for this command
	 * @param {CommandContext} context The context where you need this help
	 * @returns {string} The description
	 */
	getHelpDescription(context) { }
	/**
	 * Get the description of this command
	 * @param {CommandContext} context
	 * @returns {string} The description in one (or two) line
	 */
	getHelpSmallDescription(context) { }

	parent;

	/**
	 * @param {string} name
	 * @param {string} description
	 * @param {AbstractCommandOption} parent The parent of the command
	 */
	constructor(name, description, parent) {
		this.parent = parent;
		this.name = name;
		this.flatName = strToFlatStr(this.name);
		this.description = description;

		if (!this.name) console.warn(`Option '/${this.commandLine}' has no name`.yellow);
		if (!this.description) console.warn(`Option '/${this.commandLine}' has no description`.yellow);
	}

	/**
	 * @type {string}
	 */
	get commandLine() {
		const parentLine = this.parent?.commandLine;
		if (parentLine) return parentLine + ' ' + this.name;
		return this.name;
	}

	/**
	 * @param {string} name The name of the command
	 */
	isOptionName(name) {
		return this.name == name || this.flatName == strToFlatStr(name);
	}

	getJSON() {
		const json = {
			name: this.name,
			description: this.description,
			type: this.type,
		};
		// ne pas mettre pour ApplicationCommand
		if (!this.type) delete json.type;

		return json;
	}

	/**
	 * Is this command match with an other command?
	 * @param {DiscordApplicationCommand} command
	 */
	matchWith(command) {
		if (!command) return false;
		// Pour l'Api discord ApplicationCommandOptionTypes.APPLICATION_COMMAND est passé de 0 à 1
		if ((this.type || 1) != command.type) return false;
		return this.name == command.name && this.description == command.description;
	}
}

class CommandParameter extends AbstractCommandOption {
	type; //type: 3-8
	isOptionParameter = true;
	isAllowedOptionType() {
		return false;
	} //aucun autorisé en option
	static Types = [
		ApplicationCommandOptionTypes.STRING,
		ApplicationCommandOptionTypes.INTEGER,
		ApplicationCommandOptionTypes.BOOLEAN,
		ApplicationCommandOptionTypes.USER,
		ApplicationCommandOptionTypes.CHANNEL,
		ApplicationCommandOptionTypes.ROLE,
		ApplicationCommandOptionTypes.MENTIONABLE,
		ApplicationCommandOptionTypes.NUMBER,
	];
	required;
	/**
	 * @type {{name:string, value:string, description?:string}[]}
	 */
	choices; //only for string and Integer
	getParameterDisplayName() {
		if (!this.required) {
			return `(${this.name})`;
		} else {
			return `<${this.name}>`;
		}
	}
	/**
	 * Get the description of this option
	 * @param {CommandContext} context
	 * @returns The description in one (or two) line
	 */
	getHelpSmallDescription(context) {
		var smallDesc = this.getParameterDisplayName() + ' : ' + this.description;
		if (this.choices?.length) {
			if (this.required) {
				const choices_desc = [];
				this.choices.forEach((c, i) => {
					if (i > 10) return;
					choices_desc.push(`\`${c.value}\` : ${c.description || 'Pas de description'}`);
				});
				const choices_str = indentString(choices_desc.join('\n'));
				smallDesc += '\n' + choices_str;
			} else {
				const choices_nb = this.choices.length;
				const choices_list = this.choices.map(c => c.value);

				var max_choices = 4;
				if (this.choices.length < max_choices + 2) max_choices = this.choices.length;

				const choices_str = choices_list.splice(0, max_choices).join(', ');
				const choices_plus = this.choices.length > max_choices ? `, et ${this.choices.length - max_choices} autres...` : '';

				smallDesc += ` (choix : ${choices_str}${choices_plus})`;
			}
		}
		return smallDesc;
	}

	/**
	 * @param {{name:string, description:string, type:number, required:boolean, choices:{name:string, value:string}[]}} commandConfig The config of the command (like Discord format)
	 * @param {AbstractCommandExtendable} parent The parent of this option
	 */
	constructor(commandConfig, parent) {
		super(commandConfig.name, commandConfig.description, parent);
		this.required = commandConfig.required;
		this.type = commandConfig.type;
		if (commandConfig.options) console.warn(`CommandParameter shouldn't have options (in '/${this.commandLine}')`.yellow);

		if (commandConfig.choices) {
			this.choices = commandConfig.choices.sort((a, b) => a.name.localeCompare(b.name));
			this.choices.forEach(c => c.value == undefined && (c.value = c.name));
		}
	}
	get commandLine() {
		const parentLine = this.parent?.commandLine;
		return parentLine + ' ' + this.getParameterDisplayName();
	}

	getJSON() {
		const json = super.getJSON();
		if (this.required) json.required = this.required;
		if (this.choices)
			json.choices = this.choices.map(c => {
				return { name: c.name, value: c.value };
			});
		return json;
	}

	/**
	 * Is this command match with an other command?
	 * @param {DiscordApplicationCommand} command
	 */
	matchWith(command) {
		if (!super.matchWith(command)) return false;
		if (this.required ^ command.required) return false;
		if (this.choices) {
			if (this.choices.length != command.choices?.length) return false;
			for (const cIntern of this.choices) {
				const cExtern = command.choices.find(c => c.name == cIntern.name);
				if (!cExtern) return false;
				if (cIntern.name != cExtern.name || cIntern.value != cExtern.value) return false;
			}
		}
		return true;
	}
}

class AbstractCommandExtendable extends AbstractCommandOption {
	#execute;
	#executeAttribute;
	/**
	 * suboptions of the option
	 * @type {AbstractCommandExtendable[]}
	 */
	options = [];
	/**
	 * suboptions of the option
	 * @type {CommandParameter[]}
	 */
	parameters = [];
	/**
	 * @type {(AbstractCommandExtendable|CommandParameter)[]}
	 */
	get discordOptions() {
		return [...this.options.filter(option => option.security.interaction !== false && !option.security.hidden), ...this.parameters];
	}
	/**
	 * Get the full Help for this command
	 * @param {CommandContext} context The context where you need this help
	 * @param {string} spaces The indentation of the description
	 * @returns The description
	 */
	getHelpDescription(context) {
		if (!this.security.isAllowedToSee(context)) return;

		const parametersNames = this.parameters.map(a => a.getParameterDisplayName());
		const parameterStr = parametersNames.length ? ` ${parametersNames.join(' ')}` : '';
		const commandLine = this.commandLine + parameterStr;

		const descriptionOptions = this.options.map(o => indentString(o.getHelpSmallDescription(context))).filter(o => o != undefined);
		const descriptionParameters = this.parameters.map(o => indentString(o.getHelpSmallDescription(context))).filter(o => o != undefined);
		const descriptionStr = [this.description, ...descriptionParameters, ...descriptionOptions].join('\n');

		const retour = new EmbedMaker(`Help : ${commandLine}`, descriptionStr);

		return retour;
	}
	/**
	 * Get the description of this command
	 * @param {CommandContext} context
	 * @returns The description in one (or two) line
	 */
	getHelpSmallDescription(context) {
		if (!this.security.isAllowedToSee(context) || this.security.hidden) return;
		return indentNextLines(`${this.commandLine} : ${this.description}`);
	}

	security;

	/**
	 * @param {{name:string, description:string, security:{place:string,interaction:boolean,wip:boolean}, options:*[]}} commandConfig The config of the command (like Discord format)
	 * @param {AbstractCommandExtendable} parent The parent of the command (can only be a CommandExtendable)
	 */
	constructor(commandConfig, parent) {
		super(commandConfig.name, commandConfig.description, parent);
		this.security = SecurityCommand.Create(commandConfig.security, this.parent?.security);
		this.#execute = commandConfig.execute;
		this.#executeAttribute = commandConfig.executeAttribute;

		for (const subCommandConfig of commandConfig.options || []) {
			const subType = subCommandConfig.type;
			if (!this.isAllowedOptionType(subType)) {
				console.warn(
					`Option ${subCommandConfig.name} (type: ${subCommandConfig.type}) not allowed under '/${this.commandLine}' (type: ${this.type}) :`
				);
				continue;
			}

			var subCommand;
			var isParameter = false;
			if (subType == ApplicationCommandOptionTypes.SUB_COMMAND) {
				subCommand = new ApplicationSubCommand(subCommandConfig, this);
			} else if (subType == ApplicationCommandOptionTypes.SUB_COMMAND_GROUP) {
				subCommand = new ApplicationSubCommandGroup(subCommandConfig, this);
			} else if (CommandParameter.Types.includes(subType)) {
				subCommand = new CommandParameter(subCommandConfig, this);
				isParameter = true;
			} else {
				console.error(`Type unknow for option ${subCommandConfig.name} : ${subType}`.red);
				continue;
			}
			if (isParameter) {
				this.parameters.push(subCommand);
			} else {
				this.options.push(subCommand);
			}
		}
		if (this.options?.length && this.parameters?.length) {
			console.warn(`Command '/${this.commandLine}' has options AND parameters, which might be incorrect for discord.`.yellow);
		}
		this.options = this.options.sort((a, b) => a.name.localeCompare(b.name));
	}

	getJSON() {
		return {
			...super.getJSON(),
			options: [
				...this.discordOptions.map(option => option.getJSON()),
			],
		};
	}
	/**
	 * Is this command match with an other command?
	 * @param {DiscordApplicationCommand} command
	 */
	matchWith(command) {
		if (!super.matchWith(command)) return false;

		const discordOptions = this.discordOptions;
		if (discordOptions) {
			if (discordOptions.length != (command.options?.length || 0)) return false;
			for (const oIntern of discordOptions) {
				const oExtern = command.options.find(o => o.name == oIntern.name);
				if (!oIntern.matchWith(oExtern)) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Execute the command or the subcommand
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions Options
	 * @returns {Promise<EmbedMaker>} The answer of the command
	 */
	async execute(cmdData, levelOptions) {
		if (levelOptions && levelOptions.length) {
			//find the suboption
			const [subCommand, subOptionsLevel] = this.getSubCommand(levelOptions);
			if (subCommand != this) return subCommand.execute(cmdData, subOptionsLevel);
		}

		//terminus => #execute
		if (!(await this.security?.isAllowedToUse?.(cmdData.context))) {
			return EmbedMaker.Error('', cmdData.context.NotAllowedReason || "Sorry you can't do that");
		}

		if (typeof levelOptions == 'object' && levelOptions.length) {
			if (typeof this.#executeAttribute == 'function') {
				return this.#executeAttribute(cmdData, levelOptions); //on est sur d'avoir des arguments
			}
		}

		if (typeof this.#execute == 'function') {
			return this.#execute(cmdData, levelOptions);
		}
		return this.getHelpDescription(cmdData.context);
	}

	/**
	 * Get the lowest command for levelOptions
	 * @param {CommandLevelOptions} levelOptions Options
	 * @returns {[AbstractCommandExtendable,CommandLevelOptions]} The command and remaning levelOptions
	 */
	getSubCommand(levelOptions) {
		if (this.options.length === 0) return [this, levelOptions]; // no subcommand
		const [optionAtThisLevel, nextLevelOptions] = levelOptions.getNextLevelOptions();
		if (!optionAtThisLevel || optionAtThisLevel.type >= 3) return [this, levelOptions];

		const optionName = optionAtThisLevel.getNameOrValue();

		const option = this.options.find(option => option.isOptionName(optionName));

		if (option) {
			return option.getSubCommand(nextLevelOptions);
		} else {
			if (process.env.WIPOnly) {
				console.warn(`Option '${optionName}' not found in '/${this.commandLine}'`);
			}
			return [this, levelOptions];
		}
	}
}

class ApplicationSubCommand extends AbstractCommandExtendable {
	get type() {
		return ApplicationCommandOptionTypes.SUB_COMMAND;
	}
	/**
	 * @param {ApplicationCommandOptionTypes} commandOptionType
	 */
	isAllowedOptionType(commandOptionType) {
		return CommandParameter.Types.includes(commandOptionType);
	}
	/**
	 * Get the lowest command for levelOptions
	 * @param {CommandLevelOptions} levelOptions Options
	 * @returns {[AbstractCommandExtendable,CommandLevelOptions]} The command and remaning levelOptions
	 */
	getSubCommand(levelOptions) {
		return [this, levelOptions]; // SUB_COMMAND n'a que des CommandAttribute
	}
}

class ApplicationSubCommandGroup extends AbstractCommandExtendable {
	get type() {
		return ApplicationCommandOptionTypes.SUB_COMMAND_GROUP;
	}
	/**
	 * @param {ApplicationCommandOptionTypes} commandOptionType
	 */
	isAllowedOptionType(commandOptionType) {
		return commandOptionType == ApplicationCommandOptionTypes.SUB_COMMAND;
	}
}

class ApplicationCommand extends AbstractCommandExtendable {
	get type() {
		return ApplicationCommandOptionTypes.APPLICATION_COMMAND;
	}
	/**
	 * @param {ApplicationCommandOptionTypes} type
	 */
	isAllowedOptionType(type) {
		return Object.values(ApplicationCommandOptionTypes).includes(type);
	}
	get interaction() {
		return this.security.interaction;
	}
	/**
	 * Alternative names
	 * @type {string[]}
	 */
	alts;

	/**
	 * Get the full Help for this command
	 * @param {CommandContext} context The context where you need this help
	 * @returns The description
	 */
	getHelpDescription(context) {
		const retour = super.getHelpDescription(context);
		if (this.alts?.length) retour.addField('Alias', [this.name, ...this.alts].join(', '), true);
		return retour;
	}

	/**
	 * @param {{name:string,
	 * 			description:string,
	 * 			security:{place:string,interaction:boolean,wip:boolean},
	 * 			options:Discord.ApplicationCommandOption[],
	 * 			alts:string[]}} commandConfig The config of the command (like Discord format)
	 */
	constructor(commandConfig) {
		super(commandConfig);
		this.alts = commandConfig.alts;

		if (!commandConfig.security) {
			console.warn(`Command '/${this.name}' has no security`.yellow);
		}
		if (this.security.wip) {
			console.warn(`Command '/${this.name}' is WIP`.yellow);
		}
	}

	get allowedPlacesToCreateInteraction() {
		if (!this.interaction) return SecurityPlaces.NONE;
		return this.security.place;
	}

	/**
	 * @param {string} flatName The name of the command
	 */
	isCommandName(flatName) {
		return this.flatName == flatName || this.alts?.includes(flatName);
	}

	getJSON() {
		//the JSON Param used by the Discord API
		return { ...super.getJSON(), type: ApplicationCommandType.ChatInput };
	}
}

export default class CommandStored extends ApplicationCommand {
	filename;
	/**
	 * @param {{name:string,
	 * 			description:string,
	 * 			security:{place:string,interaction:boolean,wip:boolean},
	 * 			options:Discord.ApplicationCommandOption[]}} commandConfig The config of the command (like Discord format)
	 * @param {string} filename The filename of the command
	 */
	constructor(commandConfig, filename) {
		super(commandConfig);
		this.filename = filename;
	}
}
