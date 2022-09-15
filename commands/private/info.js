import { EmbedMaker } from '../../lib/messageMaker.js';
import { Snowflake } from '../../lib/snowflake.js';
import { getFrenchDate } from '../../lib/date.js';
import { BaseChannel, Guild, Role, User } from 'discord.js';
import { CommandLevelOptions, ReceivedCommand } from '../../bot/command/received.js';

const snowflakeLink = 'https://discord.js.org/#/docs/main/stable/typedef/Snowflake';

export default {
	name: 'info',
	description: 'Informations sur le snowflake de la cible',

	security: {
		place: 'private',
		interaction: true,
	},

	options: [
		{
			name: 'snowflake',
			description: "Informations d'un snowflake (id)",
			type: 1,
			options: [
				{
					name: 'snowflake',
					description: 'Informations du snowflake (id)',
					type: 3,
					required: true,
				},
			],
			executeAttribute: executeSnowflake,
		},
		{
			name: 'user',
			description: "Informations d'un utilisateur",
			type: 1,
			options: [
				{
					name: 'user',
					description: "Informations d'un utilisateur",
					type: 6,
				},
			],
			execute: executeInfoUser,
		},
		{
			name: 'channel',
			description: "Informations d'un salon",
			type: 1,
			options: [
				{
					name: 'channel',
					description: "Informations d'un salon",
					type: 7,
				},
			],
			execute: executeInfoChannel,
		},
		{
			name: 'role',
			description: "Informations d'un role",
			type: 1,
			options: [
				{
					name: 'role',
					description: "Informations d'un role",
					type: 8,
					required: true, //il n'y a pas de role 'actuel'
				},
			],
			executeAttribute: executeInfoRole,
		},
		{
			name: 'guild',
			description: 'Informations du serveur',
			type: 1,
			execute: executeInfoGuild,
		},
	],
};

/**
 * Make an embed message with `Info` as title
 * @param {string} description The content
 */
function makeMessage(description) {
	return new EmbedMaker('Info', description);
}
/**
 * Make an embed message with `Info` as title and a red color
 * @param {string} description The content
 */
function makeError(description) {
	return EmbedMaker.Error('Info', description);
}

/**
 * Get a mention/name of the target
 * @param {string|Guild|BaseChannel|User|Role} target The target
 * @returns {string} A mention or a name to identify the target
 */
function getTargetName(target) {
	if (typeof target === 'string') return target;

	if (target.username) return target.username;
	if (target.name) return target.name;
	if (target.id) return target.id;

	if (typeof target.toString === 'function') return target.toString();

	if (process.env.WIPOnly) {
		console.warn(`getTargetName can't find name`.yellow, target);
	}
	return target;
}

/**
 * Get basic informations for the target
 * @param {string} targetTitle The type of the target
 * @param {Guild|BaseChannel|User|Role} target The target
 */
function getBasicInfo(targetTitle, target) {
	const snowflake = new Snowflake(target.id);
	const date = getFrenchDate(snowflake.msecSinceEpoch);
	//si target est pas chargé ça affiche [object Object]

	const targetName = getTargetName(target);
	return makeMessage(
		`${targetName ? `Informations ${targetTitle} ${targetName}` : ''}
		Snowflake : ${target.id}
		Créé ${date}`
	);
}

/**
 * Get inforamtions about the target and his snowflake
 * @param {string} targetTitle The type of the target
 * @param {Guild|BaseChannel|User|Role} target The target
 */
function getInfo(targetTitle, target) {
	const snowflake = new Snowflake(target.id);
	const time = snowflake.msecSinceDiscord;

	var info = getBasicInfo(targetTitle, target);
	info.addField(
		'Snowflake',
		`time : ${time} (${time.toString(2)})
		worker : ${snowflake.worker}
		pid : ${snowflake.pid}
		increment : ${snowflake.increment}
		(${snowflakeLink})`
	);
	return info;
}

/**
 * `info user` was called
 * @param {ReceivedCommand} cmdData
 * @param {CommandLevelOptions} levelOptions
 * @returns informations about the user targeted or the user who executed this command
 */
async function executeInfoUser(cmdData, levelOptions) {
	/**
	 * @type {string}
	 */
	var user_id = levelOptions?.getArgument('user', 0)?.getArgumentValue(CommandLevelOptions.OptionTypes.USER);

	if (user_id?.match(/<@&(\d+)>/)) {
		return makeError(`Mention invalide, essayez de retapper la mention.`);
	}

	const user = await (user_id ? cmdData.bot.users.fetch(user_id) : cmdData.context.getFullAuthor());
	if (!user) {
		return makeMessage(`L'utilisateur \`<#${user_id}>\` est introuvable`);
	}

	return getBasicInfo("de l'utilisateur", user);
}
/**
 * `info channel` was called
 * @param {ReceivedCommand} cmdData
 * @param {CommandLevelOptions} levelOptions
 * @returns informations about the channel targeted or the channel where this command is executed
 */
async function executeInfoChannel(cmdData, levelOptions) {
	/**
	 * @type {string}
	 */
	const channel_id = levelOptions?.getArgument('channel', 0)?.getArgumentValue(CommandLevelOptions.OptionTypes.CHANNEL) || cmdData.context.channel_id;

	var channel;
	try {
		channel = await cmdData.bot.channels.fetch(channel_id);
	} catch (error) { }
	if (!channel) return makeMessage(`Le channel \`<#${channel_id}>\` est introuvable`);

	var channelTitle = 'du channel';
	if (channel.type == 'DM') channelTitle = 'de la conversation privée avec';
	if (channel.type == 'GROUP_DM') channelTitle = 'de la conversation de groupe';
	const info = getBasicInfo(channelTitle, channel);
	if (channel.type != 'DM' && channel.type != 'GROUP_DM' && channel.type != 'UNKNOWN') {
		// Class extends from GuildChannel
		info.addField('', `Guild : ${channel.guild} (${channel.guild.id})\nMembres (minimum) : ${channel.members.size}`);
	}
	return info;
}
/**
 * `info role` was called
 * @param {ReceivedCommand} cmdData
 * @param {CommandLevelOptions} levelOptions
 * @returns informations about the role targeted
 */
async function executeInfoRole(cmdData, levelOptions) {
	const role_id = levelOptions.getArgument('role', 0)?.getArgumentValue(CommandLevelOptions.OptionTypes.ROLE);

	const role = role_id ? await (await cmdData.context.getGuild())?.roles.fetch(role_id) : undefined;
	if (!role) return makeMessage(`Le role \`<@&${role_id}>\` est introuvable`);

	return getBasicInfo('du role', role).addField('', `Membres (minimum) : ${role.members.size}`);
}
/**
 * `info guild` was called
 * @param {ReceivedCommand} cmdData
 * @returns informations about the guild
 */
async function executeInfoGuild(cmdData) {
	const guild = await cmdData.context.getGuild();

	if (!guild) return EmbedMaker.Error('Info', "Vous n'êtes pas dans un serveur. Essayez `/info channel`.");

	return getBasicInfo('du serveur', guild).addField('', `Membres : ${guild.memberCount}`);
}

/**
 * `info snowflake` was called
 * @param {ReceivedCommand} cmdData
 * @param {CommandLevelOptions} levelOptions
 * @returns informations about the snowflake
 */
function executeSnowflake(cmdData, levelOptions) {
	const snowflakeArgument = levelOptions.getArgument('snowflake', 0);
	const snowflake = snowflakeArgument.getSnowflake();
	if (snowflake == undefined) {
		return new EmbedMaker(
			'Snowflake',
			`Préciser un snowflake
		(${snowflakeLink})`
		);
	}

	return getInfo('Snowflake', { id: snowflake });
}
