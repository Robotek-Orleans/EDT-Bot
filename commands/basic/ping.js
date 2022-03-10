import { ReceivedCommand } from '../../bot/command/received.js';
import { EmbedMaker } from '../../lib/messageMaker.js';
import { Snowflake } from '../../lib/snowflake.js';

export default {
	name: 'ping',
	description: 'Pong!',

	security: {
		place: 'public',
		interaction: true,
	},

	/**
	 * Executed when there is no valid option
	 * @param {ReceivedCommand} cmdData
	 */
	async execute(cmdData) {
		const pingCreated = cmdData.commandSource.createdTimestamp || new Snowflake(cmdData.commandSource.id).timestamp; // temps du premier message d'après le serveur
		const pingReceived = cmdData.receivedAt; // temps d'envoie PrePing d'après le bot (et de reception du premier message)

		const pingBot = cmdData.bot.ws.ping;

		const serverTimeSupposedAtPingReceived = pingCreated + pingBot / 2;
		const decalage = pingReceived - serverTimeSupposedAtPingReceived;

		console.log(`Ping du bot : ${pingBot} msec`);
		return new EmbedMaker('Ping', `Pong en ${Math.round(pingBot)} msec\nDécalage avec le serveur : ${Math.round(decalage)} msec`);
	},
};
