/**
 * @param {string} str
 * @param {string} spaces
 * @return str indented with 4 spaces
 */
export function indentString(str, spaces = '\xa0 \xa0 ') {
	return str?.replace(/(^|\n)(.)/g, `$1${spaces}$2`);
}

/**
 * @param {string} str
 * @param {string} spaces
 * @return str indented with 4 spaces (but not the first line)
 */
export function indentNextLines(str, spaces = '\xa0 \xa0 ') {
	return str?.replace(/\n/g, `\n${spaces}`);
}

/**
 * Remove accents from characters
 * @param {string} str The string to 'flat'
 * @returns The flat string
 */
export function strToFlatStr(str) {
	if (typeof str != 'string') return '';
	return str
		.toLowerCase()
		.replace(/[áàâä]/g, 'a')
		.replace(/[éèêë]/g, 'e')
		.replace(/[íìîï]/g, 'i')
		.replace(/[óòôö]/g, 'o')
		.replace(/[úùûü]/g, 'u')
		.replace(/ýÿ/g, 'y')
		.replace(/ñ/g, 'n');
}
