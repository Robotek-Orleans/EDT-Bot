export const hexRegex = /#[\dA-Fa-f]{6}/;

/**
 * @param {string} hex
 */
export function hexToDiscordColor(hex) {
	if (hex.match(hexRegex)) {
		const r = parseInt(hex.substr(1, 2), 16);
		const g = parseInt(hex.substr(3, 2), 16);
		const b = parseInt(hex.substr(5, 2), 16);
		return (r * 256 + g) * 256 + b;
	}
	return;
}

/**
 * @param {number} discordColor
 */
export function DiscordColorToHex(discordColor) {
	const r = Math.floor(discordColor / 256 / 256) % 256;
	const g = Math.floor(discordColor / 256) % 256;
	const b = Math.floor(discordColor) % 256;
	var rHex = r.toString(16);
	var gHex = g.toString(16);
	var bHex = b.toString(16);
	while (rHex.length < 2) rHex = '0' + rHex;
	while (gHex.length < 2) gHex = '0' + gHex;
	while (bHex.length < 2) bHex = '0' + bHex;

	return `#${rHex}${gHex}${bHex}`.toUpperCase();
}

class ColorConverter {
	name;
	nom;
	hex;
	get red() {
		return parseInt(this.hex.substr(1, 2), 16);
	}
	get green() {
		return parseInt(this.hex.substr(3, 2), 16);
	}
	get blue() {
		return parseInt(this.hex.substr(5, 2), 16);
	}

	get discordColor() {
		return (this.red * 256 + this.green) * 256 + this.blue;
	}

	/**
	 * @param {string} name
	 * @param {string} nom
	 * @param {string} hex
	 */
	constructor(name, nom, hex) {
		this.name = name;
		this.nom = nom;
		this.hex = hex;
	}
}

export const colorEquiv = [
	new ColorConverter('red', 'rouge', '#FF0000'),
	new ColorConverter('green', 'vert', '#00FF00'),
	new ColorConverter('blue', 'bleu', '#0000FF'),
	new ColorConverter('black', 'noir', '#000000'),
	new ColorConverter('gray', 'gris', '#888888'),
	new ColorConverter('white', 'blanc', '#FFFFFF'),
	new ColorConverter('yellow', 'jaune', '#FFFF00'),
	new ColorConverter('cyan', 'cyan', '#00FFFF'),
	new ColorConverter('pink', 'pink', '#FF00FF'),
	new ColorConverter('discord', 'discord', '#5865F2'),
	new ColorConverter('polytech', 'polytech', '#019cde'),
];

/**
 * @param {string} name Name of the color in English or in French
 */
export function getColorByName(name) {
	return colorEquiv.find(c => c.name === name || c.nom === name);
}

export const commandOptions = {
	name: 'couleur',
	description: 'Une couleur hexadécimale',
	type: 3,
	choices: [
		{ value: '#FF0000', name: 'rouge' },
		{ value: '#00FF00', name: 'vert' },
		{ value: '#0000FF', name: 'bleu' },
		{ value: '#000000', name: 'noir' },
		{ value: '#888888', name: 'gris' },
		{ value: '#FFFFFF', name: 'blanc' },
		{ value: '#FFFF00', name: 'jaune' },
		{ value: '#00FFFF', name: 'cyan' },
		{ value: '#FF00FF', name: 'violet' },
	],
};

/**
 * @param {string} name
 */
export function colorNameToHex(name) {
	return getColorByName(name.toLocaleLowerCase())?.hex;
}

export default {
	hexRegex,
	hexToDiscordColor,
	DiscordColorToHex,
	getColorByName,
	commandOptions,
	colorNameToHex,
	edtbot_color: 0x019cde,
};
