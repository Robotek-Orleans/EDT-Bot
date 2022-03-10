import {
	CommandLevelOptions,
	ReceivedCommand
} from '../../bot/command/received.js';
import { EDTManager } from './edt.js';
import fs from 'fs';
import { EmbedMaker } from '../../lib/messageMaker.js';
import {
	getDurationTime,
	getFrenchTime
} from '../../lib/date.js';

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
		const salles_uniques = events.map(ev => ev.LOCATION).reduce((a, b) => [...a, ...b], []).filter((salle, i, salles) => salles.indexOf(salle) === i);
		const salles_inconnues = salles_uniques.filter(salle => !SALLES.find(s => s.name === salle));
		if (salles_inconnues.length > 0) console.log('Salles non répertoriées', salles_inconnues);

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
		const filter = levelOptions.options.map(o => o.value).join(' ');

		var salles = getSalles({ any: filter });
		if (salles.length === 0) {
			return new EmbedMaker('Salle EDT', `Aucune salle ne correspond à votre recherche, donnez un nom ou un type`);
		}
		else if (salles.length === 1) {
			return getSalleInfo(salles[0]);
		}
		else {
			const sallesInfo = getSallesInfo(salles);
			return new EmbedMaker('Salle EDT', `${salles.length} salles correspondent à votre recherche :\n`
				+ sallesInfo.join('\n') || "Erreur pas d'infos");
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
		if (this.name.startsWith(name) || this.name.replace(' ', '').startsWith(name))
			return true;
		const thisCodeName = this.name.match(/(F|L|N|Nav|J) ?0?(\d\d|-\d?\d)/);
		const thatCodeName = name.match(/(F|L|N|Nav|J) ?0?(\d\d|-\d?\d)/);
		if (thisCodeName && thatCodeName) {
			if (thatCodeName[1] === thisCodeName[1] && thatCodeName[2] === thisCodeName[2])
				return true;
		}

		return false;
	}
}

/**
 * @param {{name:string, type:string}} filter
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
 */
function getSalleInfo(salle) {
	const occupee = manager.getRecentEvents({ locations: [salle.name] })
		.map(ev => `de ${getFrenchTime(ev.DTSTART, false)} à ${getFrenchTime(ev.DTSTART, false)}`)
		.join('\n');
	return new EmbedMaker(`Salle ${salle.name} `, `Type: ${salle.type} `).addField('Occupée', occupee || "Pas occupée d'ici 4 heures", true);
}

/**
 * @param {Salle[]} salles
 */
function getSallesInfo(salles) {
	const events = manager.getRecentEvents({ locations: salles.map(s => s.name) });
	return salles.map(salle =>
		salle.name + ' : ' +
		(manager.joinEventsPeriod(events.filter(ev => ev.LOCATION.includes(salle.name)))
			.map(p => `de ${getFrenchTime(p.DTSTART)} à ${getFrenchTime(p.DTEND)}`).join(', ')
			|| 'Libre'));
}