import DiscordBot from '../../bot/bot.js';
import fs from 'fs';
import { ReceivedCommand } from '../../bot/command/received.js';
import https from 'https';
import http from 'http';
import { EmbedMaker } from '../../lib/messageMaker.js';
import { getDiscordTimestamp } from '../../lib/date.js';

/**
 * @type {DiscordBot}
 */
var bot;
/**
 * @type {EDTManager}
 */
var manager;

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
					return new EmbedMaker('EDT', `Téléchargement terminé  (${manager.currentEDT.length}/${manager.EDTs2022.length})`);
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
				var description = manager.lastUpdate ? `Les EDTs ont été téléchargés le ${getDiscordTimestamp(manager.lastUpdate)}` : `Les EDTs ne sont pas téléchargés`;
				const dlStarted = manager.downloadStatus.downloadStartedAt;
				const dlEnded = manager.downloadStatus.downloadEndedAt;
				const downloading = dlStarted && (!dlEnded || (dlEnded < dlStarted));
				if (downloading) {
					description += `\nLe téléchargement a commencé le ${getDiscordTimestamp(dlStarted)}`;

					if (manager.downloadStatus.downloaded)
						bot.consoleLogger.error(`EDT downloading and downloaded`, dlStarted, dlEnded);
					if (manager.downloadStatus.edtDownloaded)
						description += `\nEDT téléchargés : ` + manager.downloadStatus.edtDownloaded.join(', ');
					if (manager.downloadStatus.edtDownloading)
						description += `\nEDT à télécharger : ` + manager.downloadStatus.edtDownloading.join(', ');
				} else if (dlEnded) {
					description += `\nLe téléchargement s'est terminé le ${getDiscordTimestamp(dlEnded)}`;
					if (manager.downloadStatus.downloaded)
						description += ' (Succès)';
					else
						description += ' (Échec)';
				}
				if (manager.currentEDT.length) {
					description += '\n' + manager.currentEDT.map(edt => edt.weekEvents.length).reduce((a, b) => a + b)
						+ '/' + manager.currentEDT.map(edt => edt.event_count).reduce((a, b) => a + b)
						+ ` évenements sont chargés pour ${manager.currentEDT.length} EDT`;
				}

				var embed = new EmbedMaker('EDT 2021-2022', description);

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
	/**
	   @type {Date}
	 */
	DTSTART;
	/**
	   @type {Date}
	 */
	DTEND;
	/**
	   @type {Date}
	 */
	CREATED;
	/**
	   @type {Date}
	 */
	LAST_MODIFIED;
	/**
	   @type {string}
	 */
	SUMMARY
	/**
	 * @type {string[]}
	 */
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
		var buffer = fs.readFileSync(process.env.EDT_DIR + '/' + file);
		var data = buffer.toString();
		this.name = file.match(/EDT-Univ-Orleans-(.+)\.vcs/)?.[1] || file;
		this.CN = data.match(/.*\nCN:"(.+)\n.*/)?.[1];
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
	 * @type {Date}
	 */
	lastUpdateSalles;
	/**
	 * @type {{downloaded: boolean, edtDownloaded: string[], edtDownloading: string[], downloadEndedAt: Date, downloadStartedAt: Date }}
	 */
	downloadStatus = { downloaded: false };
	/**
	 * @type {{downloaded: boolean, edtDownloaded: string[], edtDownloading: string[], downloadEndedAt: Date, downloadStartedAt: Date }}
	 */
	downloadStatusSalles = { downloaded: false };

	/**
	 * @type {EDTSpe[]}
	 */
	currentEDT = [];

	/**
	 * @type {EDTSpe[]}
	 */
	currentEDTSalles = [];

	constructor() {
		setTimeout(() => this.reloadEDT(), 1000);
		setTimeout(() => this.reloadEDTSalle(), 1000);
	}

	get EDTs2022() {
		return [
			['A1', '4810'],
			['A1-STI2D', '13152'],
			// ['A1-STI2D-A', '796'],
			['A2', '3164'],
			['A2-STI2D', '799'],
			// ['A2-STI2D-A', '800'],
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
			// ['A6-CDE', '23609'],
			['IoT', '23'],
			['Master-AESM', '1656'],
		];
		/**
		   JavaScript pour renouveler les ressources sur l'ent (sélectionner Polytech et inspecter une des spé pour pouvoir détecter select[name=filieres])
			var f = document.querySelector('select[name=filieres]')
			var child = Array.from(f.children)
			var calendars = child.map(option => [option.innerHTML.replaceAll(' ', '-'), option.value])
			console.log(calendars.map(c => `['${c[0]}' '${c[1]}'],`).join('\n')));
		 */
	}

	get EDTs2022Salles() {
		return [
			// 25201, 45918, 11732, 25374, 25173, 25151, 489, 25125, 25117, 25324, 25320, 25330, 25315, 25312, 25327, 25328, 25329, 25099, 25318, 25083, 25082, 2850, 25081, 25311, 25317, 25319, 13220, 193, 28696, 192, 25231, 7162, 446, 23573, 25323, 25321, 25094, 25093, 25087, 25314, 25136, 25133, 19347
			['Blaise', '68845'],
			['Cabannes', '69153'],
			['Turing', '25201'],
			['Hall-Accueil', '45918'],
			['Hall-Galilee', '11732'],
			// ['Personnel', '489'],
			['L-37', '25329'],
			['F022', '25125'],
			['F023', '25117'],
			['L-15', '25328'],
			['F101', '25323'],
			['F102', '25324'],
			['F105', '25320'],
			['F110', '25330'], // 12
			['F111', '25315'],
			['F201', '25312'],
			['F202', '25321'],
			['F301', '25327'],
			['L-03', '25311'],
			['L-10', '25317'],
			['L-14', '25319'],
			['L-16', '13220'],
			['L-17', '23573'],
			['L-38', '25314'],
			['L001', '193'],
			['L002', '192'],
			['L003', '25231'],
			['F112', '25136'],
			['F113', '25133'],
			['F114', '25374'],
			['F115', '25173'],
			['F116', '25151'],
			['F215', '25099'],
			['F216', '25094'],
			['F217', '25093'],
			['F218', '25087'],
			['F302', '25318'],
			['F316', '25083'],
			['F317', '25082'],
			['F317bis', '2850'],
			['F318', '25081'],
			// ['F-10', '7162'],
			// ['F207', '446'],
			// ['Salle29', '28696'],
			// ['Salle43', '19347'],
		];
	}

	mkEDTDir() {
		try {
			if (!fs.existsSync(process.env.EDT_DIR)) {
				fs.mkdirSync(process.env.EDT_DIR, { recursive: true });
			}
			if (!fs.existsSync(process.env.EDT_DIR + '/Salles')) {
				fs.mkdirSync(process.env.EDT_DIR + '/Salles', { recursive: true });
			}
			return true;
		}
		catch (err) {
			bot.consoleLogger.error(`Can't create EDT directory`, process.env.EDT_DIR, err);
			return false;
		}
	}

	getEDTPath(name, salle = false) {
		return process.env.EDT_DIR + (salle ? '/Salles' : '') + `/EDT-Univ-Orleans-${name}.vcs`;
	}

	/**
	 * @param {string} name
	 * @param {string} ressource
	 * @param {boolean} salle
	 */
	downloadEDT(name, ressource, salle = false) {
		const url = process.env.EDT_URL.replace('{resources}', ressource);
		const urlObj = new URL(url);
		const options = {
			hostname: urlObj.hostname,
			path: urlObj.pathname + urlObj.search,
			rejectUnauthorized: false,
		}

		return new Promise((res, rej) => {
			const req = https.get(options, (response) => {
				switch (response.statusCode) {
					case 200:
						break;
					case 417:
						// no events
						console.log(`Can't download ${name} (${ressource}) because there is no events (error 417) => skip`);
						res(false);
						return;
					default:
						rej(`error downloading ${name} (${response.statusCode} : ${response.statusMessage}) ${url}`);
						return;
				}

				var result = ''
				response.on('data', chunk => result += chunk);
				response.on('end', () => {
					fs.writeFileSync(this.getEDTPath(name, salle), result.toString());
					res(true);
				});
			});

			req.on('error', (e) => {
				if (e.message.includes('EPROTO') && e.message.includes('SSL routines')) {
					rej(`SSL error, try to *downgrade* your nodejs version to v16.x : ${e.message}`);
				} else {
					rej(`error downloading ${name} (${e}) ${url}`);
				}
			});
		});
	}

	async downloadEDTs() {
		if (Date.now() - this.downloadStatus.downloadStartedAt?.getTime() < 10000)
			return;
		this.downloadStatus.downloadStartedAt = new Date();
		this.downloadStatus.downloaded = false;
		this.downloadStatus.edtDownloaded = [];
		this.downloadStatus.edtDownloading = [];

		if (!this.mkEDTDir())
			return;

		try {
			bot.consoleLogger.log('EDT Downloading...');
			const edtDownloaded = (await Promise.all(this.EDTs2022.map(async EDT => {
				const name = EDT[0];
				this.downloadStatus.edtDownloading.push(name);
				var downloaded = false;
				for (let i = 0; i < 2 && !downloaded; i++) {
					downloaded = await this.downloadEDT(EDT[0], EDT[1]);
				}
				this.downloadStatus.edtDownloaded.push(name);
				this.downloadStatus.edtDownloading.splice(this.downloadStatus.edtDownloading.indexOf(name), 1);
				return { EDT: name, downloaded };
			}))).filter(EDT_dl => EDT_dl.downloaded).map(EDT_dl => EDT_dl.EDT);
			bot.consoleLogger.log(`EDT Downloaded (${edtDownloaded.length}/${this.EDTs2022.length}) => reloading`);
			this.downloadStatus.downloadEndedAt = new Date();
			this.reloadEDT();

			this.downloadStatus.downloaded = true;
			return true;
		} catch (err) {
			bot.consoleLogger.error(`EDT Can't be downloaded (${err})`);
			this.downloadStatus.downloadEndedAt = new Date();
			this.downloadStatus.downloaded = false;
			return false;
		}
	}

	async downloadEDTsSalles() {
		if (Date.now() - this.downloadStatusSalles.downloadStartedAt?.getTime() < 10000)
			return;
		this.downloadStatusSalles.downloadStartedAt = new Date();
		this.downloadStatusSalles.downloaded = false;
		this.downloadStatusSalles.edtDownloaded = [];
		this.downloadStatusSalles.edtDownloading = [];

		if (!this.mkEDTDir())
			return;

		try {
			bot.consoleLogger.log('EDT Salles Downloading...');
			const edtDownloaded = (await Promise.all(this.EDTs2022Salles.map(async EDT => {
				const name = EDT[0];
				this.downloadStatusSalles.edtDownloading.push(name);
				var downloaded = false;
				for (let i = 0; i < 2 && !downloaded; i++) {
					downloaded = await this.downloadEDT(EDT[0], EDT[1], true);
				}
				this.downloadStatusSalles.edtDownloaded.push(name);
				this.downloadStatusSalles.edtDownloading.splice(this.downloadStatusSalles.edtDownloading.indexOf(name), 1);
				return { EDT: name, downloaded };
			}))).filter(EDT_dl => EDT_dl.downloaded).map(EDT_dl => EDT_dl.EDT);
			bot.consoleLogger.log(`EDT Downloaded (${edtDownloaded.length}/${this.EDTs2022Salles.length}) => reloading`);
			this.downloadStatusSalles.downloadEndedAt = new Date();
			this.reloadEDTSalle();

			this.downloadStatusSalles.downloaded = true;
			return true;
		} catch (err) {
			bot.consoleLogger.error(`EDT Can't be downloaded (${err})`);
			this.downloadStatusSalles.downloadEndedAt = new Date();
			this.downloadStatusSalles.downloaded = false;
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

	/**
	 * @param {ReceivedCommand} cmdData
	 */
	async downloadSallesAndAknowledge(cmdData) {
		const lastUpdate = this.lastUpdateSalles;
		await this.downloadEDTsSalles();
		if (lastUpdate < this.lastUpdateSalles) {
			cmdData.sendAnswer(new EmbedMaker('EDT', `Les emplois du temps de salles ont été actualisés. Vous pouvez retenter votre commande.`));
		}
	}

	reloadEDT() {
		if (!this.mkEDTDir())
			return;
		const edtFiles = fs.readdirSync(process.env.EDT_DIR).filter(f => f.endsWith('.vcs'));
		this.currentEDT = edtFiles.map(file => new EDTSpe(file));
		this.lastUpdate = this.currentEDT[0]?.DTSTAMP;

		if (this.currentEDT.find(edt => Math.abs(edt.DTSTAMP.getTime() - this.lastUpdate?.getTime()) >= 10000)) {
			bot.consoleLogger.warn(`EDT have different DTSTAMP`, this.currentEDT.reduce((p, c) => { p[c.name] = c.DTSTAMP; return p; }, {}));
		}
		if (this.isEDTOld()) {
			bot.consoleLogger.log(`EDT Reloaded but too old (${this.downloadStatus.downloadStartedAt})`);
			this.downloadEDTs();
		} else
			bot.consoleLogger.log(`EDT Reloaded (${this.currentEDT.length}/${this.EDTs2022.length})`);
	}

	reloadEDTSalle() {
		if (!this.mkEDTDir())
			return;
		const edtFiles = fs.readdirSync(process.env.EDT_DIR + '/Salles').filter(f => f.endsWith('.vcs'));
		this.currentEDTSalles = edtFiles.map(file => new EDTSpe('Salles/' + file));
		this.lastUpdateSalles = this.currentEDTSalles[0]?.DTSTAMP;

		if (this.currentEDTSalles.find(edt => Math.abs(edt.DTSTAMP.getTime() - this.lastUpdateSalles?.getTime()) >= 10000)) {
			bot.consoleLogger.warn(`EDT have different DTSTAMP`, this.currentEDTSalles.reduce((p, c) => { p[c.name] = c.DTSTAMP; return p; }, {}));
		}
		if (this.isEDTSallesOld()) {
			bot.consoleLogger.log(`EDT Salles Reloaded but too old (${this.downloadStatus.downloadStartedAt})`);
			this.downloadEDTsSalles();
		} else
			bot.consoleLogger.log(`EDT Salles Reloaded (${this.currentEDTSalles.length}/${this.EDTs2022Salles.length})`);
	}

	isEDTOld() {
		return this.lastUpdate?.getTime() + 7 * 86400e3 < Date.now();
	}

	isEDTSallesOld() {
		return this.lastUpdate?.getTime() + 7 * 86400e3 < Date.now();
	}

	/**
	 * @param {EDTFilter} filter
	 * @param {ReceivedCommand} cmdData
	 */
	getRecentEvents(filter, cmdData) {
		if (this.isEDTOld()) {
			this.downloadAndAknowledge(cmdData); // Update after the command
		}

		return this.currentEDT
			.map(spe => spe.weekEvents.filter(event => filter.matchFilter(event)))
			.reduce((a, b) => [...a, ...b], [])
	}

	/**
	 * @param {EDTFilter} filter
	 * @param {ReceivedCommand} cmdData
	 */
	getRecentSallesEvents(filter, cmdData) {
		if (this.isEDTSallesOld()) {
			this.downloadSallesAndAknowledge(cmdData); // Update after the command
		}

		return this.currentEDTSalles
			.map(spe => spe.weekEvents.filter(event => filter.matchFilter(event)))
			.reduce((a, b) => [...a, ...b], [])
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
			} else {
				last = { DTSTART: event.DTSTART, DTEND: event.DTEND };
				periods.push(last);
			}
		}
		return periods;
	}
}

export class EDTFilter {
	/**
	 * @type {number}
	 */
	now;
	/**
	 * @type {number}
	 */
	fromH;
	/**
	 * @type {number}
	 */
	toH;
	get from() {
		return new Date(this.now + this.fromH * 3600e3);
	}
	get to() {
		return new Date(this.now + this.toH * 3600e3);
	}
	/**
	 * @type {string[]}
	 */
	locations;
	/**
	 * @type {string[]}
	 */
	description;

	/**
	 * @param {EDTFilter} options
	 */
	constructor(options) {
		this.now = options.now || Date.now();
		this.fromH = options.fromH ?? -0.6;
		this.toH = options.toH ?? 5;
		if (options.locations) this.locations = options.locations;
		if (options.description) this.description = options.description;
	}

	/**
	 * @param {EDTEvent} event
	 */
	matchFilter(event) {
		if (event.DTEND < this.from || this.to < event.DTSTART)
			return false;
		if (this.locations && !this.locations.find(l => event.LOCATION.includes(l)))
			return false;
		if (this.description && !this.description.find(s => event.DESCRIPTION.includes(s)))
			return false;

		return true;
	}
}