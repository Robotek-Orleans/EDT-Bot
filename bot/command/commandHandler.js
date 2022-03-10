import { ReceivedCommand } from './received.js';
import { EmbedMaker } from '../../lib/messageMaker.js';

/**
 * Execute the command and return the result
 * @param {ReceivedCommand} cmdData
 * @returns The result of the execution
 */
async function executeCommand(cmdData) {
	const command = cmdData.bot.commandMgr.getCommand(cmdData.commandName);
	if (!command) return;

	try {
		/**
		 * @type {EmbedMaker}
		 */
		const retour = await new Promise((res, rej) => {
			command.execute(cmdData, cmdData.levelOptions).then(res).catch(rej); //try to solve with it
			setTimeout(() => cmdData.answeredAt == null && rej('timeout'), 60000); //more than 60s
		});
		if (!retour && cmdData.needAnswer != false) {
			console.warn(`Command '/${cmdData.commandLine}' has no answer`.yellow);
		}

		return retour;
	} catch (error) {
		process.consoleLogger.commandError(cmdData.commandLine, error);
		return EmbedMaker.Error('', `Sorry I've had an error (${error})`);
	}
}

/**
 * Called when any commands are catched
 * @param {ReceivedCommand} cmdData - The command
 */
export default async function commandHandler(cmdData) {
	var timeoutLogged = false;
	const timeoutLog = setTimeout(() => {
		console.log(`Command #${cmdData.id} by ${cmdData.author.username} : '${cmdData.commandLine}' not finished yet`.gray);
		timeoutLogged = true;
	}, 30000); //30s pour répondre, sinon il envoit un message d'info

	const answerMessage = await executeCommand(cmdData);
	const answer = answerMessage ? cmdData.sendAnswer(answerMessage) : undefined;
	const answered = await answer;

	clearTimeout(timeoutLog);
	if (!timeoutLogged) {
		if (answered) {
			console.log(
				`Command #${cmdData.id} by ${cmdData.author.username} : '${cmdData.commandLine}' done in ${cmdData.answeredAt - cmdData.receivedAt} / ${
					Date.now() - cmdData.receivedAt
				} msec`.gray
			);
		}
	} else {
		console.log(`Command #${cmdData.id} done in ${cmdData.answeredAt - cmdData.receivedAt} / ${Date.now() - cmdData.receivedAt} msec`.gray);
	}

	return answered;
}
