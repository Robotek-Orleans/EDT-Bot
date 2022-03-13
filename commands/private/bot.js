import { EmbedMaker } from '../../lib/messageMaker.js';
import { getDurationTime, getFrenchDate } from '../../lib/date.js';
import DiscordBot from '../../bot/bot.js';
import { CommandLevelOptions, ReceivedCommand } from '../../bot/command/received.js';

const actions = [
	{
		name: 'info',
		need_id: false,
		description: 'Information sur le bot',
		/**
		 * @param {ReceivedCommand} cmdData
		 */
		execute: cmdData => getInfo(cmdData.bot),
	},
	{
		name: 'cut',
		need_id: true,
		description: 'Arrêter le bot',
		/**
		 * @param {ReceivedCommand} cmdData
		 */
		execute: cmdData => {
			cmdData.bot.stop();
			console.warn(`Stoppé par ${cmdData.author.toString()} ${getFrenchDate(new Date())}`.red);
			return new EmbedMaker('', `Stoppé par ${cmdData.author.username}`);
		},
	},
	{
		name: 'reset_id',
		need_id: true,
		description: `Changer l'id locale du bot`,
		/**
		 * @param {ReceivedCommand} cmdData
		 */
		execute: cmdData => {
			cmdData.bot.resetLocalId();
			return new EmbedMaker('', `La nouvelle id du bot sur ${getBotLocation()} est ${cmdData.bot.localId}`);
		},
	},
];

export default {
	name: 'bot',
	description: 'Commandes pour gérer le bot',
	security: {
		place: 'private',
		interaction: true,
	},

	options: [
		{
			name: 'action',
			description: 'Action du bot',
			type: 3,
			choices: actions,
			required: true,
		},
		{
			name: 'bot_id',
			description: 'Bot ciblé (id global: 0)',
			type: 4,
			required: false,
		},
	],

	/**
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions
	 */
	executeAttribute: (cmdData, levelOptions) => {
		const actionName = levelOptions.getArgument('action', 0).getValueOrName();
		const bot_id = levelOptions.getArgumentValue('bot_id', 1);
		const is_bot_id = cmdData.bot.isLocalId(bot_id);

		const action = actions.find(a => a.name === actionName);
		if (!action) return EmbedMaker.Error('', `Aucune action nommée '${actionName}'`);

		if (action.need_id && !is_bot_id) {
			if (!bot_id) {
				return new EmbedMaker(
					'',
					`Vous devez préciser l'id du bot ciblé pour cette commande.\nL'id du bot sur ${getBotLocation()} est ${cmdData.bot.localId}`
				);
			}
			cmdData.setReplied();
			return;
		}
		if (bot_id && !is_bot_id) {
			cmdData.setReplied();
			return;
		}

		return action.execute(cmdData);
	},
};

/**
 * Get a small description here the bot is
 */
function getBotLocation() {
	return process.env.HOST;
}

function getNumberWithSignificantFigure(x, number_of_figure) {
	const figure_on_left = Math.floor(Math.log10(x)) + 1;
	var figure_to_keep_on_right = Math.max(number_of_figure - figure_on_left, 0);
	var figure_decalage = Math.pow(10, figure_to_keep_on_right);
	x = Math.floor(x * figure_decalage) / figure_decalage;
	return x;
}

function getReadableOctetSize(size_octet) {
	if (size_octet < 1000) return size_octet + ' o';
	const size_ko = size_octet / 1000;
	if (size_ko < 1000) return getNumberWithSignificantFigure(size_ko, 3) + ' ko';
	const size_Mo = size_ko / 1000;
	if (size_Mo < 1000) return getNumberWithSignificantFigure(size_Mo, 3) + ' Mo';
	const size_Go = size_Mo / 1000;
	return getNumberWithSignificantFigure(size_Go, 3) + ' Go';
}

/**
 * Get info on the bot
 * @param {DiscordBot} bot
 */
function getInfo(bot) {
	const idLocal = `Id local du bot : ${bot.localId}, pid : ${process.pid}`;
	const retour = new EmbedMaker('Informations sur bot', idLocal);

	retour.addField('Guilds', `Connecté sur ${bot.guilds.cache.size} serveurs`, true);
	retour.addField('Session', `Démarré sur ${getBotLocation()}\ndepuis ${getDurationTime(process.uptime() * 1000)}`, true);

	const cpuUsage = process.cpuUsage();
	const memoryUsage = process.memoryUsage();
	retour.addField(
		'Ressources',
		`Cpu : ${cpuUsage.user} / ${cpuUsage.system}\n` +
		`Mémoire : ${getReadableOctetSize(memoryUsage.heapUsed)} / ${getReadableOctetSize(memoryUsage.heapTotal)} / ${getReadableOctetSize(
			memoryUsage.rss
		)}`
	);

	return retour;
}
