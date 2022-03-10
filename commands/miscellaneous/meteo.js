import https from 'https';
const meteoColor = 3447003;
import { EmbedMaker } from '../../lib/messageMaker.js';
import { getFrenchDate, getFrenchTime } from '../../lib/date.js';
import { CommandLevelOptions } from '../../bot/command/received.js';
const lunarDuration = (((29 * 24 + 12) * 60 + 44) * 60 + 2.9) * 1000;
const lunarPhaseRef = 1623276000000; // nouvelle lune Le 10/06/2021 à  12:54:05

export default {
	name: 'météo',
	description: 'La météo actuelle de la ville/région (par openweathermap)',

	security: {
		place: 'public',
		interaction: true,
	},

	options: [
		{
			name: 'location',
			description: 'La météo actuelle de la ville/région (par openweathermap)',
			type: 3,
			required: true,
		},
	],

	/**
	 * Executed with the location
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions
	 */
	async executeAttribute(cmdData, levelOptions) {
		/**
		 * @type {string}
		 */
		const location = levelOptions.getArgumentValue('location', 0);

		return sendWeatherRequest(location);
	},
};

//https://www.twilio.com/blog/2017/08/http-requests-in-node-js.html
/**
 * Get data for the location
 * @param {string} location The location
 * @returns {{*}} Data get from the api
 */
async function getData(location) {
	const data = new Promise((resolve, reject) => {
		https
			.get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.WEATHER_KEY}`, resp => {
				let data = '';

				// A chunk of data has been recieved.
				resp.on('data', chunk => {
					data += chunk;
					resolve(data);
				});

				// The whole response has been received.
			})
			.on('error', error => {
				console.log(`Socket Error with : api.openweathermap.org ${error.message}`.red);
				resolve({ cod: 404, message: "Can't access to api.openweathermap.org" });
			});
	});

	//resolve(onWeather(location, JSON.parse(data)));
	return data;
}

/**
 * Send a request to the weather api for the location
 * @param {string} location The location
 * @param {Function} funcOnData Things to do when data are received
 */
export async function sendWeatherRequest(location, funcOnData) {
	var data = JSON.parse(await getData(location));
	if (typeof funcOnData == 'function') funcOnData(data);

	switch (data.cod) {
		case 200:
			const date = data.date || getFrenchDate(data.dt * 1000); //s to msec
			return getDescription(makeMeteoEmbed(data.name, date), data);
		default:
			return makeMeteoEmbed(data.name, '', [`Code Error: ${data.cod}`, `Message: ${data.message}`]);
	}
}

/**
 * Make an embed for Météo
 * @param {string} location Where is the weather based
 * @param {string} date When the meteo was received
 * @param {string[]} desc The description of the embed
 */
function makeMeteoEmbed(location, date, desc = []) {
	return new EmbedMaker(`Météo de __${location}__ ${date}`, desc.join('\n'), { color: meteoColor });
}

const conditionsFr = {
	Clouds: 'Nuages',
	Rain: 'Pluie',
	Clear: 'Dégagé',
	Drizzle: 'Pluie fine',
	Fog: 'Brouillard',
	Mist: 'Brume',
	Haze: 'Brume sèche',
	Snow: 'Neige',
};
/**
 * Get the translation of a weather condition in french
 * @param {string} condition A weather condition in `english`
 * @returns {string} A weather condition in `french`
 */
function getConditionFr(condition) {
	return conditionsFr[condition] || condition;
}
/**
 * Fill the embed with data received
 * @param {EmbedMaker} embed The embed with the title only
 * @param {*} data The data received
 * @returns {EmbedMaker} The embed filled with data
 */
function getDescription(embed, data) {
	if (data.main && data.main.temp) embed.addField('Température', `${Math.round((data.main.temp - 273.15) * 10) / 10} °C`, true);
	if (data.main && data.main.humidity != undefined) embed.addField(`Humidité de l'air`, `${data.main.humidity} %`, true);
	if (data.wind) embed.addField('Vitesse du vent', `${data.wind.speed} m/s`, true);

	if (data.weather && data.weather.length > 0) {
		var conditions = data.weather.map(e => getConditionFr(e.main));
		embed.addField('Condition', conditions.join(', '), true);
	}
	if (data.sys) {
		let soleilLeve = getFrenchTime(data.sys.sunrise * 1000, false);
		let soleilCouche = getFrenchTime(data.sys.sunset * 1000, true);
		embed.addField('Présence du Soleil', `de ${soleilLeve} à ${soleilCouche}`, true);
	}

	embed.addField('Phase de la Lune', getMoonState(), true);

	return embed;
}

/**
 * Get the current moon phase
 * @returns {String}
 */
function getMoonState() {
	const time = Date.now();
	const lunarRel = time - lunarPhaseRef;
	const lunarTime = lunarRel - Math.floor(lunarRel / lunarDuration) * lunarDuration;

	const lunarProgress = lunarTime / lunarDuration;
	const croissant = lunarProgress < 0.5;
	const partVisible = croissant ? lunarProgress * 2 : (1 - lunarProgress) * 2;
	//console.log({ lunarProgress, croissant, partVisible, lunarDay: lunarTime / 86400000 });
	if (croissant) {
		if (partVisible < 0.03) {
			return '🌑 Nouvelle lune';
		} else if (partVisible < 0.35) {
			return '🌒 Premier croissant';
		} else if (partVisible < 0.66) {
			return '🌓 Premier quartier';
		} else if (partVisible < 0.97) {
			return '🌔 Lune gibbeuse';
		} else {
			return '🌕 Pleine lune';
		}
	} else {
		if (0.97 <= partVisible) {
			return '🌕 Pleine lune';
		} else if (0.66 <= partVisible) {
			return '🌖 Lune gibbeuse';
		} else if (0.35 <= partVisible) {
			return '🌗 Dernier quartier';
		} else if (0.03 <= partVisible) {
			return '🌘 Dernier croissant';
		} else {
			return '🌑 Nouvelle lune';
		}
	}
}
