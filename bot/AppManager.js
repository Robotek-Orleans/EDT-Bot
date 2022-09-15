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

/**
 * Get commands of the target
 * @param {string} guildId the id of the target
 */
export const getCommands = guildId => bot.application?.commands.fetch({ guildId });

/**
 * Post an interaction on Discord
 * @param {CommandStored} command The command to post
 * @param {string} guildId Where you want to post the command
 * @param {boolean} force // TODO: remove it !!
 * @returns {Promise<boolean>} `true` if the command was sent, `false` if it was not sent
 */
export async function postCommand(command, guildId, force) {
	guildId = guildId || undefined;
	if (!canPostCommands && !force) return false;

	const cmdJson = command.getJSON();

	var promise = bot.application.commands.create(cmdJson, guildId);
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
 * @param {string} guildId Where you want to delete the command
 * @returns {Promise<boolean>} `true` if the command was deleted, `false` if it was not deleted
 */
export async function deleteCommand(command, guildId) {

	var promise = bot.application.commands.delete(command, guildId);

	return new Promise((resolve, reject) => {
		promise
			.then(() => resolve(true))
			.catch(error => {
				process.consoleLogger.internalError('deleteCommand', `removing command '${command.name || command.id || command}'`.red, error);
				resolve(false);
			});
	});
}

export default {
	setBot: b => (bot = b),

	getCommands,
	postCommand,
	deleteCommand,
};
