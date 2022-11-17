import { ReceivedInteraction } from './received.js';
import { getDateSinceEpoch as getSnowflakeTimestamp } from '../../lib/snowflake.js';
import commandHandler from '../command/commandHandler.js';

/**
 * Set a timer to display the interaction if the command is too long
 * @param {ReceivedInteraction} cmdData
 * @returns The timer
 */
async function safeInteractionAnswer(cmdData) {
	const timestampId = getSnowflakeTimestamp(cmdData.commandSource.id);
	//ne fonctionne que si la commande fonctionne au await (pas au sleep des dates)
	const timeRemaining = 3000 + timestampId - Date.now();
	return setTimeout(async () => {
		if (cmdData.answeredAt || cmdData.needAnswer == false) return;
		console.warn(`Interaction is too long, an acknowledgement will be sent (for '/${cmdData.commandLine}')`);
		try {
			await cmdData.interaction.deferReply({ ephemeral: true }); //accepte l'intéraction (et attend le retour)
		} catch (error) {
		}
	}, timeRemaining - 1000); //on a 3s pour répondre à l'interaction (et le bot peut être désyncro de 1s...)
}

/**
 * Read every interactions handled by the bot
 * @param {ReceivedInteraction} cmdData
 */
export default async function interactionHandler(cmdData) {
	const safeTimeout = safeInteractionAnswer(cmdData);

	try {
		await commandHandler(cmdData);
	} catch (error) {
		process.consoleLogger.internalError(`an interaction`, error);
	}
	clearTimeout(safeTimeout);
}
