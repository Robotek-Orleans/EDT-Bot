import DiscordBot from './bot.js';
import CommandStored from './command/commandStored.js';

/**
 * @type {DiscordBot}
 */
var bot;
var canPostCommands = true;

//https://discord.com/developers/docs/interactions/slash-commands#get-global-application-commands
//https://stackoverflow.com/questions/65402187/new-discord-slash-commands#answer-65422307
//Global Application Command: applications/{application.id}/commands
//Guild Application Command: applications/{application.id}/guilds/{guild.id}/commands

// get: array avec les commandes
// post({data:{}}): post une commande
// patch: edit une commande (mais peut aussi être écrasé par un post)
// (id)delete: delete une commande
export class DiscordRequest {
	#path = [];
	get path() {
		return this.#path.join('/');
	}
	//TODO: bot.api peut être récup sans le bot ? ça serait plus simple
	get request() {
		return bot.api.applications(bot.user.id)[this.path];
	}
	get r() {
		return this.request;
	}

	constructor(path = '') {
		if (path && path != '') {
			this.#path = path.split('/');
		}
	}

	clone() {
		return new DiscordRequest(this.path);
	}
	/**
	 * Go to the sub link
	 * @param {string} path
	 */
	go(path) {
		if (path.length > 0) {
			this.#path = this.#path.concat(path.split('/'));
		}
		return this;
	}
	/**
	 * Go back in the link
	 */
	back() {
		this.#path.pop();
		//ou : this.path += '/..';
		// ancienne solution pour le [[Function: noop]] mais pas pratique
		return this;
	}
}

export class DiscordInteractionStored {
	/** @type {string} */ id;
	/** @type {string} */ application_id;
	/** @type {string} */ name;
	/** @type {string} */ description;
	/** @type {string} */ version;
	/** @type {string} */ guild_id;
	/** @type {[Object]} */ options;
}

/**
 * Get the link for global request
 */
export const getGlobal = () => new DiscordRequest();
/**
 * Get the link for the guild
 * @param {string} guild_id the id of the guild
 */
export const getGuild = guild_id => new DiscordRequest(guild_id ? `guilds/${guild_id}` : '');
/**
 * Get the link for the global/commands or the guild/commands
 * @param {undefined|string} guild_id the id of the target
 */
export const getTarget = guild_id => getGuild(guild_id).go('commands');
/**
 * Get commands of the target
 * @param {undefined|string} guild_id the id of the target
 * @returns {Promise<[DiscordInteractionStored]>}
 */
export const getCmdFrom = guild_id => getTarget(guild_id).request.get();

/**
 * Post an interaction on Discord
 * @param {CommandStored} command The command to post
 * @param {DiscordRequest} target Where you want to post the command
 * @param {boolean} force // TODO: remove it !!
 * @returns {Promise<boolean>} `true` if the command was sent, `false` if it was not sent
 */
export async function postCommand(command, target, force) {
	if (!target || (!canPostCommands && !force)) return false;

	/**
	 * @type {Promise<*>}
	 */
	var promise = target.r.post(command.getJSON());
	//TODO : utiliser patch si elle existe car ça supprimerais des mauvais trucs
	return new Promise((resolve, reject) => {
		promise
			.then(() => resolve(true))
			.catch(error => {
				if (!canPostCommands) return resolve(false); //on sait déjà qu'on peut pas poster

				process.consoleLogger.internalError('posting command', `'${command.name}' code: ${error.httpStatus}`.red);

				switch (error.code) {
					case 0:
						process.consoleLogger.error(error.message);
						canPostCommands = false; //on a dépassé le quota des 200 messages
						setTimeout(() => (canPostCommands = true), 10000); //peut être dans 10s
						break;
					default:
						process.consoleLogger.internalError(`posting command`, error);
						break;
				}

				resolve(false);
			});
	});
}
/**
 * Delete an interaction posted on Discord
 * @param {CommandStored} command The command to delete or its id
 * @param {DiscordRequest} target Where you want to delete the command
 * @returns {Promise<boolean>} `true` if the command was deleted, `false` if it was not deleted
 */
export async function deleteCommand(command, target) {
	if (!target) return false;
	target = target.clone(); //don't change ths path for others

	return new Promise((resolve, reject) => {
		target.go(command.id || command);
		target.r
			.delete()
			.then(() => resolve(true))
			.catch(error => {
				process.consoleLogger.internalError('deleteCommand', `removing command '${command.name || command.id || command}'`.red, error);
				resolve(false);
			});
	});
}

export default {
	setBot: b => (bot = b),

	DiscordRequest,
	DiscordInteractionStored,

	getGlobal,
	getGuild,
	getTarget,
	getCmdFrom,

	postCommand,
	deleteCommand,
};
