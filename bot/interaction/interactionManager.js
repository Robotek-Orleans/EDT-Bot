import { Collection } from 'discord.js';
import { SecurityPlaces } from '../command/security.js';
import AppManager, { DiscordRequest } from '../AppManager.js';
import config from '../config.js';
import DiscordBot from '../bot.js';
import CommandStored from '../command/commandStored.js';
import { TemporaryList, TemporaryValue } from '../../lib/database.js';

export default class InteractionManager {
	bot;
	get commands() {
		return this.bot.commandMgr.commands;
	}
	interactionsOnline = new TemporaryList({ get: guild_id => AppManager.getCmdFrom(guild_id) }, 60000); //reset après une minute
	interactionsOnlineGlobal = new TemporaryValue({ get: () => AppManager.getCmdFrom() }, 60000);
	interactionsPosted = new Collection(); //commandes postées

	/**
	 * @param {DiscordBot} bot
	 */
	constructor(bot) {
		this.bot = bot;
	}

	/**
	 * Get the temporaryValue with interactions of the target
	 * @param {string} targetId Id of the guild, `undefined` for global
	 * @returns {TemporaryValue} The row linked to the target
	 */
	getGuildInteractionsRow(targetId) {
		if (!targetId) return this.interactionsOnlineGlobal;
		return this.interactionsOnline.getRow(targetId);
	}
	/**
	 * Get interactions posted in the target
	 * @param {string} targetId Id of the guild, `undefined` for global
	 * @returns {Promise<[object]>} JSON de discord TODO: plus d'info
	 */
	async getCommandsOnline(targetId) {
		return this.getGuildInteractionsRow(targetId).get();
	}
	/**
	 * Get the interaction posted in the target
	 * @param {string} commandName
	 * @param {string} targetId
	 * @returns {Promise<object>} JSON de discord TODO: plus d'info
	 */
	async getCommandOnline(commandName, targetId) {
		const interactions = await this.getCommandsOnline(targetId);
		return interactions?.find(c => c.name == commandName);
	}

	/**
	 * Post a command to Discord
	 * Please note that `postCommand` isn't linked to `commandManager::loadCommand`
	 * @param {CommandStored} command The command to post
	 * @param {DiscordRequest} target The target were you want to post
	 * @returns {Promise<boolean>} `true` if the command has been posted, `false` if it's not
	 */
	async postCommand(command, target) {
		const targetId = target.path.match(/\d+/)?.[0];
		const online = await this.getCommandOnline(command.name, targetId);
		const matchWithOnline = online ? command.matchWith(online) : false;

		if (matchWithOnline) {
			// console.log(`Interaction '${command.name}' existe déjà => pas postée`.gray);
			return 'match';
		}
		if (online) {
			console.log(`L'Intéraction pour '${command.name}' existe déjà dans ${targetId || 'global'} mais n'est pas à jour`.green);
		} else {
			console.log(`L'Intéraction pour '${command.name}' n'existe pas encore dans ${targetId || 'global'}`.green);
		}
		const posted = await AppManager.postCommand(command, target);

		//TODO database: this.resetCacheTimer(target);
		this.getGuildInteractionsRow(targetId).resetSoon(1000);

		if (posted) {
			this.interactionsPosted.set(command.name, command.getJSON());
		}
		return posted;
	}

	/**
	 * Post all commands to Discord
	 */
	async postCommands() {
		const targetGlobal = AppManager.getTarget();
		const targetPrivate = AppManager.getTarget(config.guild_test);
		var c = {
			before: this.interactionsPosted.length,
			after: 0,
			total: 0,
			public: 0,
			private: 0,
			wip: 0,
			notposted: 0,
			matched: 0,
			posted: 0,
		};

		const commandsToPost = Array.from(this.commands.values()).filter(command => {
			return command.allowedPlacesToCreateInteraction != SecurityPlaces.NONE;
		});

		const start = Date.now();
		console.log(`Posting ${commandsToPost.length} commands...`.green);

		const commandSent = commandsToPost
			.map(async command => {
				var target = undefined;
				switch (command.allowedPlacesToCreateInteraction) {
					case SecurityPlaces.PUBLIC:
						target = targetGlobal;
						break;
					case SecurityPlaces.PRIVATE:
						target = targetPrivate;
						break;
					default:
						return;
				}

				if (process.env.WIPOnly && target == targetGlobal) target = targetPrivate; //serv privé (en WIP)

				const result = await this.postCommand(command, target);
				if (result) {
					if (command.wip) c.wip++;
					switch (target) {
						case targetPrivate:
							c.private++;
							break;
						case targetGlobal:
							c.public++;
							break;
					}
					if (result === 'match') c.match++;
					else c.posted++;
				} else {
					c.notposted++;
				}
			})
			.filter(c => c != undefined);
		await Promise.all(commandSent);

		c.total = commandsToPost.length;
		//pas de différence de vitesse : 1246/1277/1369/1694/2502 ms (avec Promise) contre 1237/1267/1676/1752/2239 ms (avec await)
		console.log(
			`Posted ${c.posted} commands : ${c.public} public, ${c.private} private, ${c.wip} wip, ${c.notposted} not posted in ${Date.now() - start} msec`
				.green
		);

		c.after = this.interactionsPosted.length;
		return c;
	}

	/**
	 * Delete a command for Discord interactions
	 * Please note that this `deleteCommand` is not linked to `commandManager::removeCommand`
	 * @param {CommandStored} command The command to delete
	 * @param {Object} target Where you want to delete it
	 * @returns {Promise<boolean>} `true` if the command has been deleted, `false` if it's not
	 */
	async deleteCommand(command, target) {
		const removed = await AppManager.deleteCommand(command, target);
		//TODO: if(removed) this.resetCacheTimer(target);
		this.interactionsPosted.delete(command.name);
		return removed;
	}

	/**
	 * Clean all Discord interactions of the target
	 * @param {string} targetId Where you want to clean
	 */
	async cleanCommands(targetId) {
		const target = AppManager.getTarget(targetId);

		const commandsOnline = await this.getCommandsOnline(targetId);
		if (!commandsOnline) {
			console.warn(`Can't get commands for ${targetId ? targetId : 'Global'}`.yellow);
			return;
		}

		const commandsCleaner = commandsOnline.map(async c => ((await this.deleteCommand(c, target)) ? c : undefined));

		await Promise.all(commandsCleaner);

		const commandsRemnaining = this.getCommandsOnline(targetId);
		if (commandsRemnaining.length) {
			process.consoleLogger.commandError(`interaction clean "${targetId}"`, `${commandsRemnaining.length} Interactions remains`);
		} else {
			console.log(`All Interactions of ${target_id ? target_id : 'Global'} have been removed.`);
		}
	}
}
