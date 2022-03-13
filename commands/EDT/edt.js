import DiscordBot from '../../bot/bot.js';
import fs from 'fs';
import { CommandLevelOptions, ReceivedCommand } from '../../bot/command/received.js';
import https from 'https';
import { EmbedMaker } from '../../lib/messageMaker.js';
import { getDurationTime, getFrenchDate } from '../../lib/date.js';

/**
 * @type {DiscordBot}
 */
var bot;
/**
 * @type {EDTManager}
 */
var manager;

const EDT_DIR = './.cache/EDT';

export default {
	name: 'edt',
	description: 'Emploi du temps Polytech',

	security: {
		interaction: true,
		place: 'public',
	},

	options: [
		{
			name: 'download',
			description: 'Recharger les emplois du temps',
			type: 1,

			/**
			 * @param {ReceivedCommand} cmdData
			 */
			async execute(cmdData) {
				if (await manager.downloadEDTs())
					return new EmbedMaker('EDT', 'Téléchargement terminé');
				else
					return new EmbedMaker('EDT', 'Impossible de télécharger les emplois du temps.');
			}
		},
		{
			name: 'info',
			description: "Informations de l'EDT",
			type: 1,
			/**
			 * @param {ReceivedCommand} cmdData
			 */
			execute(cmdData) {

				var description = manager.lastUpdate ?
					`Les EDTs ont été actualisé ${getFrenchDate(manager.lastUpdate)}` :
					`Les EDTs n'ont pas été actualisés depuis plus de ${getDurationTime(process.uptime() * 1000)}`;

				description += `\nLes EDTs utilisés sont ceux de 2021-2022.`;

				var embed = new EmbedMaker('EDT', description);

				return embed;
			}
		}
	],

	/**
	 * @param {DiscordBot} b
	 */
	setBot(b) {
		bot = b;
		manager = new EDTManager();
		bot.edtManager = manager;
	}
}

function DateFromVCSDate(evDate) {
	if (!evDate) return new Date(0);
	const match = evDate.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
	return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
}

export class EDTEvent {
	/** @type {Date} */
	DTSTART;
	/** @type {Date} */
	DTEND;
	/** @type {Date} */
	CREATED;
	/** @type {Date} */
	LAST_MODIFIED;
	/** @type {string} */
	SUMMARY
	/** @type {string[]} */
	LOCATION;
	/** @type {string} */
	DESCRIPTION;
	get SPE() {
		this.DESCRIPTION.split('\\n').filter(l => !l.find(/^[A-Z]{3}/));
	}

	get PROFS() {
		// starts with 3 maj
		this.DESCRIPTION.split('\\n').filter(l => l.find(/^[A-Z]{3}/));
	}
	/** @param {string} vevent */
	static fromVCS(vevent) {
		var event = new EDTEvent();

		var lines = vevent.split('\n').filter(o => o !== '');
		var options = {};
		var latest_option = '';
		for (const line of lines) {
			if (line.startsWith(' '))
				options[latest_option] += line.substring(1);
			else {
				latest_option = line.substring(0, line.indexOf(':')).replace('-', '_');
				options[latest_option] = line.substring(latest_option.length + 1);
			}
		}
		event.DTSTART = DateFromVCSDate(options.DTSTART);
		event.DTEND = DateFromVCSDate(options.DTEND);
		event.CREATED = DateFromVCSDate(options.CREATED);
		event.LAST_MODIFIED = DateFromVCSDate(options.LAST_MODIFIED);
		event.SUMMARY = options.SUMMARY;
		event.LOCATION = options.LOCATION.split(', ');
		event.DESCRIPTION = options.DESCRIPTION;

		return event;
	}

	/**
	 * @param {Date} date
	 */
	isDuringEvent(date) {
		return this.DTSTART <= date && date <= this.DTEND;
	}
}

class EDTSpe {
	name;
	CN;
	DTSTAMP;
	weekEvents;
	LAST_MODIFIED;
	event_count;

	/**
	 * @param {string} file
	 */
	constructor(file) {
		var buffer = fs.readFileSync(EDT_DIR + '/' + file);
		var data = buffer.toString();
		this.name = file.match(/EDT-Univ-Orleans-(.+)\.vcs/)?.[1] || file;
		this.CN = data.match(/.*\nCN:"(.+)\n.*"/)?.[1];
		this.DTSTAMP = DateFromVCSDate(data.match(/.*\nDTSTAMP:([^\n]+)\n.*/)?.[1]);
		const events = data.split('BEGIN:VEVENT').filter((ev, i) => i != 0).map(ev => EDTEvent.fromVCS(ev));

		const msForOneDay = 83400e3;
		this.weekEvents = events.filter(ev => (Date.now() - 30 * msForOneDay) <= ev.DTEND.getTime() && ev.DTSTART.getTime() <= (Date.now() + 60 * msForOneDay));
		this.LAST_MODIFIED = events.map(ev => ev.LAST_MODIFIED).filter(a => a).reduce((a, b) => a < b ? b : a, new Date(0));
		this.event_count = events.length;
	}
}

export class EDTManager {

	/**
	 * @type {Date}
	 */
	lastUpdate;

	/**
	 * @type {EDTSpe[]}
	 */
	currentEDT = [];

	constructor() {
		setTimeout(() => process.env.WIPOnly ? this.reloadCurrentEDT() : this.downloadEDTs(), 1000);
	}

	get EDT_Export() { return "https://www.univ-orleans.fr/EDTWeb/export"; }
	get EDTs2022() {
		return [
			['A1', '4810'],
			['A1-STI2D', '13152'],
			['A1-STI2D-A', '796'],
			['A2', '3164'],
			['A2-STI2D', '799'],
			['A2-STI2D-A', '800'],
			['A3-GC', '28501'],
			['A3-GPSE', '28550'],
			['A3-ICM', '8018'],
			['A3-MUNDUS', '3464'],
			['A3-PROD', '6516'],
			['A3-SB', '1924'],
			['A3-TEAM', '28498'],
			['A4-GC', '28452'],
			['A4-GPSE', '28471'],
			['A4-ICM', '2849'],
			['A4-PROD', '2022'],
			['A4-SB', '8164'],
			['A4-TEAM', '2890'],
			['A5-GC', '1890'],
			['A5-GPSE', '1339'],
			['A5-ICM', '2903'],
			['A5-PROD', '6521'],
			['A5-SB', '10326'],
			['A5-TEAM', '3176'],
			['A6-CDE', '23609'],
			['IoT', '23'],
			['Master-AESM', '1656'],
		];
		/** JavaScript pour renouveler les ressources sur l'ent (sélectionner Polytech et inspecter une des spé pour pouvoir détecter select[name=filieres])
			var f = document.querySelector('select[name=filieres]')
			var child = Array.from(f.children)
			var calendars = child.map(option => [option.innerHTML.replaceAll(' ', '-'), option.value])
			console.log(calendars.map(c => `['${c[0]}' '${c[1]}'],`).join('\n')));
		 */
	}


	getEDTPath(name) {
		return EDT_DIR + `/EDT-Univ-Orleans-${name}.vcs`;
	}

	/**
	 * @param {string} name
	 * @param {string} ressource
	 */
	downloadEDT(name, ressource) {
		const url = this.EDT_Export + `?project=2021-2022&resources=${ressource}&type=ical`;

		return new Promise((res, rej) => {
			const req = https.get(url, result => {
				if (result.statusCode !== 200) {
					rej(`error: ${result.statusCode} : ` + result.statusMessage);
					return;
				}
				/** @type {Buffer} */
				var data = undefined;
				result.on('data', /** @param {Buffer} chunk */ chunk => {
					if (data)
						data += chunk;
					else
						data = chunk;

					if (result.complete || data.includes('END:VCALENDAR')) {
						fs.writeFileSync(this.getEDTPath(name), data.toString());
						res(true);
					}
				});
			});
			req.on('error', rej);
			req.on('close', rej);
			req.end();
		});
	}

	async downloadEDTs() {
		if (Date.now() - this.lastUpdate?.getTime() < 10000)
			return;
		this.lastUpdate = new Date();

		if (!fs.existsSync(EDT_DIR)) {
			fs.mkdirSync(EDT_DIR, { recursive: true });
		}

		try {
			await Promise.all(this.EDTs2022.map(EDT => this.downloadEDT(EDT[0], EDT[1])));
			this.reloadCurrentEDT();

			bot.consoleLogger.log('EDT Downloaded');
			return true;
		}
		catch (err) {
			bot.consoleLogger.error("EDT Can't be downloaded", err);
			return false;
		}
	}

	/**
	 * @param {ReceivedCommand} cmdData
	 */
	async downloadAndAknowledge(cmdData) {
		const lastUpdate = this.lastUpdate;
		await this.downloadEDTs();
		if (lastUpdate < this.lastUpdate) {
			cmdData.sendAnswer(new EmbedMaker('EDT', `Les emplois du temps ont été actualisés. Vous pouvez retenter votre commande.`));
		}
	}

	reloadCurrentEDT() {
		if (!fs.existsSync(EDT_DIR)) {
			fs.mkdirSync(EDT_DIR, { recursive: true });
		}
		const edtFiles = fs.readdirSync(EDT_DIR).filter(f => f.endsWith('.vcs'));
		this.currentEDT = edtFiles.map(file => new EDTSpe(file));
		if (!this.lastUpdate)
			this.lastUpdate = this.currentEDT[0]?.DTSTAMP;
	}

	/**
	 * @param {{locations:string[], from:Date, to:Date, now:number, fromH:number, toH:number}} filter
	 * @param {ReceivedCommand} cmdData
	 */
	getRecentEvents(filter, cmdData) {
		if (this.lastUpdate?.getTime() + 7 * 86400e3 < Date.now()) {
			this.downloadAndAknowledge(cmdData); // Update after the command
		}
		const now = filter.now || Date.now();
		const from = filter?.from || new Date(now + (filter.fromH || -0.6) * 3600e3);
		const to = filter?.to || new Date(now + (filter.toH || 5) * 3600e3);
		var events = this.currentEDT
			.map(spe => spe.weekEvents.filter(ev => from <= ev.DTEND && ev.DTSTART <= to)).reduce((a, b) => [...a, ...b], [])
		if (filter.locations)
			events = events.filter(ev => filter.locations.find(salle => ev.LOCATION.includes(salle)));

		return events;
	}

	/**
	 * @param {EDTEvent[]} events
	 */
	joinEventsPeriod(events) {
		const min = new Date(events.map(ev => ev.DTSTART.getTime()).reduce((a, b) => Math.sign(a - b), 0));
		const max = new Date(events.map(ev => ev.DTEND.getTime()).reduce((a, b) => Math.sign(b - a), 0));
		const eventsSorted = events.sort((a, b) => Math.sign(a.DTSTART.getTime() - b.DTSTART.getTime()));
		var periods = [];
		var last = undefined;
		const demi_heure = 1800e3;
		for (const event of eventsSorted) {
			if (last && event.DTSTART.getTime() <= last.DTEND.getTime() + demi_heure) {
				last.DTEND = event.DTEND;
			}
			else {
				last = { DTSTART: event.DTSTART, DTEND: event.DTEND };
				periods.push(last);
			}
		}
		return periods;
	}
}
