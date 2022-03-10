export const prefixs = ['!', '<@&792172600893243392>'];

const specialChars = [
	[' ', data => (data.onStr ? data.append(' ') : data.split.push(''))],
	['"', data => (data.onStr = !data.onStr)],
];

/**
 * Split a string width command and arguments
 * @param {string} commandLine
 * @return {string[]} The command splitted
 */
export function splitCommand(commandLine) {
	var split = [''];
	const data = { split, onStr: false, append: c => (split[split.length - 1] += c) };

	for (let i = 0; i < commandLine.length; i++) {
		const char = commandLine[i];
		const nextChar = commandLine[i + 1];

		if (char == '\\') {
			if (specialChars.filter(p => p[0] == nextChar).length == 0) {
				data.append(char); //afficher le \ s'il n'y a pas de caractère spécial
			}
			data.append(nextChar); // après un \ on affiche toujours le caractère
			i++; //slip the next char
			continue;
		}

		const specialChar = specialChars.filter(p => p[0] == char)[0];
		if (specialChar?.[1]) {
			specialChar[1](data);
			continue;
		}

		data.append(char); //on ajoute le char
	}
	return split;
}

/**
 * Get the prefix of the command
 * @param {string} commandLine The command line
 * @returns {string} The prefix of the command or `undefined`
 */
export function getPrefix(commandLine = '') {
	return [...prefixs, `<@!${process.env.BOT_ID}>`].find(p => commandLine.startsWith(p));
}

/**
 * Remove the prefix of a command
 * @param {string} commandLine The command line
 * @return {[commandLine: string, prefix: string]} The command without the prefix and the prefix
 */
export function extractPrefix(commandLine) {
	commandLine = commandLine.substring(commandLine.match(/^ +/)?.[0].length || 0);
	const prefix = getPrefix(commandLine);
	commandLine = commandLine.substring(prefix?.length || 0);
	commandLine = commandLine.substring(commandLine.match(/^ +/)?.[0].length || 0);

	return [commandLine, prefix];
}

export default {
	prefixs,
	splitCommand,
	extractPrefix,
};
