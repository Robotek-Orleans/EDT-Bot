import {
	CommandLevelOptions,
	ReceivedCommand
} from '../../bot/command/received.js';
import { EDTEvent, EDTManager } from './edt.js';
import fs from 'fs';
import { EmbedMaker } from '../../lib/messageMaker.js';
import { getDiscordTimestamp, getDurationTime } from '../../lib/date.js';

/**
 * @type {Salle[]}
 */
const SALLES = [];

/**
 * @type {EDTManager}
 */
var manager;

export default {
	name: 'salle',
	description: 'Rechercher une salle libre',

	security: {
		interaction: true,
		place: 'public',
	},

	options: [{
		name: 'filtre',
		description: `Filtrer des salles (exemple: 'Cab', 'F23', 'F 023', 'F30')`,
		type: 3
	}],

	/**
	 * @param {ReceivedCommand} cmdData
	 */
	execute(cmdData) {
		var now = Date.now();

		const events = manager.getRecentEvents({ now }, cmdData);
		warnIfSalleUnknown(events);

		var embed = new EmbedMaker('Salle EDT', `EDTs téléchargés il y a ${getDurationTime(now - manager.lastUpdate?.getTime())}.`);
		const one_hour = 1.25 * 3600e3;
		var salles_occupees =
			"Il y a 1 h: " + (events.filter(ev => ev.isDuringEvent(new Date(now - one_hour))).map(e => e.LOCATION.join?.(',') || e.LOCATION).join(', ') || 'Pas de cours') +
			"\nMaintenant: " + (events.filter(ev => ev.isDuringEvent(new Date(now))).map(e => e.LOCATION.join?.(',') || e.LOCATION).join(', ') || 'Pas de cours') +
			"\nDans 1 h: " + (events.filter(ev => ev.isDuringEvent(new Date(now + one_hour))).map(e => e.LOCATION.join?.(',') || e.LOCATION).join(', ') || 'Pas de cours') +
			"\nDans 2 h: " + (events.filter(ev => ev.isDuringEvent(new Date(now + 2 * one_hour))).map(e => e.LOCATION.join?.(',') || e.LOCATION).join(', ') || 'Pas de cours') +
			"\nDans 3 h: " + (events.filter(ev => ev.isDuringEvent(new Date(now + 3 * one_hour))).map(e => e.LOCATION.join?.(',') || e.LOCATION).join(', ') || 'Pas de cours') +
			"\nDans 4 h: " + (events.filter(ev => ev.isDuringEvent(new Date(now + 4 * one_hour))).map(e => e.LOCATION.join?.(',') || e.LOCATION).join(', ') || 'Pas de cours')
		embed.addField('Salles occupées', salles_occupees || "Aucune d'ici 4 heures", true)
		return embed;
	},

	/**
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions
	 */
	executeAttribute(cmdData, levelOptions) {
		var filter = levelOptions.options.map(o => o.value).join(' ');

		const matchDansTemps = filter.match(/ *dans *(-?\d+) *([hHmj]) */);
		var now = Date.now();
		if (matchDansTemps) {
			filter = filter.replace(matchDansTemps[0], ' ');
			const temps = parseFloat(matchDansTemps[1]);
			switch (matchDansTemps[2]) {
				case 'm':
					now += 60e3 * temps;
					break;
				case 'h':
				case 'H':
					now += 3600e3 * temps;
					break;
				case 'j':
					now += 86400e3 * temps;
					break;
				default:
					console.warn(`Unknow time type : ${matchDansTemps[2]} for the command parameter ${matchDansTemps[0]}`);
			}
		}
		filter = filter.replace(/ *$/, '');

		var salles = getSalles({ any: filter });
		if (salles.length === 0) {
			return new EmbedMaker('Salle EDT', `Aucune salle ne correspond à votre recherche, donnez un nom ou un type de salle`);
		}
		else if (salles.length === 1) {
			return getSalleInfo(salles[0], now);
		}
		else {
			const salles_info = getSallesInfo(salles.length === SALLES.length ? undefined : salles, now);

			var description = `${salles_info.length} salles correspondent à votre recherche :`;
			const max_size = 2048 - '...'.length;
			for (let i = 0; i < salles_info.length; i++) {
				const salle_info = salles_info[i];
				if (description.length + salle_info.length <= max_size)
					description += '\n' + salle_info;
				else {
					description += '\n...';
					break;
				}
			}
			return new EmbedMaker('Salle EDT', description);
		}
	},

	setBot(bot) {
		const SallesJson = JSON.parse(fs.readFileSync('./commands/EDT/Salles.json'));
		SALLES.push(...SallesJson.amphi.map(name => new Salle(name, 'amphi')));
		SALLES.push(...SallesJson.CM.map(name => new Salle(name, 'CM')));
		SALLES.push(...SallesJson.TD.map(name => new Salle(name, 'TD')));
		SALLES.push(...SallesJson.TP.map(name => new Salle(name, 'TP')));
		manager = bot.edtManager;
	}
}

class Salle {
	name;
	type;

	/**
	 * @param {string} name
	 * @param {string} type
	 */
	constructor(name, type) {
		this.name = name;
		this.type = type;
	}

	/**
	 * @param {string} type
	 */
	isType(type) {
		switch (type) {
			case 'TD':
				if (this.type === 'TD') return true;
			case 'CM':
				if (this.type === 'CM') return true;
			case 'amphi':
				return this.type === 'amphi';
			case 'TP': return this.type === 'TP' || this.type === 'TD';
		}
	}

	/**
	 * @param {string} name
	 */
	isName(name) {
		if (name === this.name)
			return true;
		if (this.name.toLocaleLowerCase().startsWith(name.toLocaleLowerCase()) || this.name.toLocaleLowerCase().replace(' ', '').startsWith(name.toLocaleLowerCase()))
			return true;
		const thisCodeName = this.name.match(/(F|L|N|Nav|J) ?(-?\d{1,3})/);
		const thatCodeName = name.match(/(F|L|N|Nav|J) ?(-?\d{1,3})/);
		if (thisCodeName && thatCodeName) {
			if (thatCodeName[1] === thisCodeName[1] && thatCodeName[2] === thisCodeName[2])
				return true;
		}

		return false;
	}
}

/**
 * @param {{name:string, type:string, any:string}} filter
 */
function getSalles(filter) {
	var salles = SALLES;
	if (filter.name)
		salles = salles.filter(s => s.isName(filter.name));
	if (filter.type)
		salles = salles.filter(s => s.type === filter.type);
	if (filter.any)
		salles = salles.filter(s => s.isName(filter.any) || s.type === filter.any);
	if (salles.length === 0)
		process.consoleLogger.warn(`Salle unknown :`, filter);
	return salles;
}

/**
 * @param {Salle} salle
 * @param {number} now
 */
function getSalleInfo(salle, now) {
	const occupee = manager.getRecentEvents({ locations: [salle.name], now })
		.map(ev => `de ${getDiscordTimestamp(ev.DTSTART, 't')} à ${getDiscordTimestamp(ev.DTEND, 't')}`)
		.join('\n');
	return new EmbedMaker(`Salle ${salle.name} `, `Type: ${salle.type} `).addField('Occupée', occupee || "Libre pour au moins 4 heures", true);
}

/**
 * @param {Salle[]} salles `undefined` if no filter
 * @param {number} now
 */
function getSallesInfo(salles, now) {
	const events = manager.getRecentEvents({ locations: salles?.map(s => s.name), now });
	warnIfSalleUnknown(events);

	const occupee = (salles || SALLES).map(salle => manager.joinEventsPeriod(events.filter(ev => ev.LOCATION.includes(salle.name)))
		.map(p => `de ${getDiscordTimestamp(p.DTSTART, 't')} à ${getDiscordTimestamp(p.DTEND, 't')}`).join(', '));
	return (salles || SALLES).map((salle, i) => salle.name + ' : ' + (occupee[i] ? `Occupée ${occupee[i]}` : `Libre`));
}

/**
 * @param {EDTEvent[]} events
 */
function warnIfSalleUnknown(events) {
	const salles = events.map(ev => ev.LOCATION).reduce((a, b) => [...a, ...b], []);
	const salles_uniques = salles.filter((salle, i, salles) => salles.indexOf(salle) === i);
	const salles_inconnues = salles_uniques.filter(salle => !SALLES.find(s => s.name === salle))
		.filter(salle => !salle.match(/^(J |Joule |Nav |Navier |Lag |P |Pascal |A\d\d |Lap |Salle Souffleries|.+ Nav |Hall Darcy|Microsoft Teams)/));
	if (salles_inconnues.length > 0) console.log('Salles non répertoriées', salles_inconnues);
}