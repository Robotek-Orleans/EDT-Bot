export const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
	hour: '2-digit',
	minute: '2-digit',
	hc: 'h24',
	hour12: false,
	timeZoneName: 'short',
	timeZone: 'Europe/Paris',
});
const frWeekdays = ['Lundi', 'Mardi', 'Mecredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const frMonths = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function getFrenchTimezone() {
	const f = dateTimeFormat.format(); //"00:00 UTC+1"
	return f.substr(f.match(/UTC|GMT/).index + 3); //"+1"
}

/**
 * Change the time to have it in a french time
 * @returns {Date}
 */
Date.prototype.unstableFrenchDate = function () {
	return new Date(this.getTime() + getFrenchTimezone() * 3600 * 1000); //add or remove x hour
};
//prettier-ignore
Date.prototype.getFrDay = function () { return this.unstableFrenchDate().getDay(); }
//prettier-ignore
Date.prototype.getFrDate = function () { return this.unstableFrenchDate().getDate(); }
//prettier-ignore
Date.prototype.getFrMonth = function () { return this.unstableFrenchDate().getMonth(); }
//prettier-ignore
Date.prototype.getFullFrYear = function () { return this.unstableFrenchDate().getFullYear(); }

/**
 * get the time like in a french timezone
 * @param {Date} date
 * @param {boolean} displayTimezone
 */
export function getFrenchTime(date, displayTimezone) {
	if (!date) return;
	const [{ value: hour }, , { value: minute }, , { value: timeZoneName }] = dateTimeFormat.formatToParts(date);
	const timezone = displayTimezone ? ` (${timeZoneName})` : '';
	return `${hour}h${minute}` + timezone;
}
export const getCurrentFrenchTime = displayTimezone => getFrenchTime(new Date(), displayTimezone);

export const getWeekday = (date, list = frWeekdays) => {
	if (date.getFrDay() == 0) return list[6];
	return list[date.getFrDay() - 1]; //décale cars Sunday==0 et Monday==1
};
export const getMonth = (date, list = frMonths) => list[date.getFrMonth()]; //January==0
export const getYear = date => date.getFullFrYear();

export function getFrenchDate(date, options = {}) {
	if (typeof date != 'object') date = new Date(date);
	const weekday = getWeekday(date, options.listWeekday);
	const dateNum = date.getFrDate();
	const month = getMonth(date, options.listMonth);
	const year = options.year || date.getFullFrYear() != new Date().getFullFrYear() ? ' ' + getYear(date) : '';
	const frenchTime = getFrenchTime(date, options.noTimezone ? false : true);
	var frDate = `${weekday} ${dateNum} ${month}${year}`;
	if (!options.noTime) frDate += ` à ${frenchTime}`;
	if (!options.noArticle) frDate = 'le ' + frDate;
	return frDate;
}

export const getUTCCurrentDate = () => new Date().toUTCString();

export function getDurationTime(duration) {
	var seconde = Math.ceil(duration / 100) / 10; //msec => s avec un chiffre après la virgule
	if (seconde <= 60) return `${seconde} secondes`;
	var minute = Math.floor(seconde / 60);
	seconde %= 60;
	seconde = Math.ceil(seconde * 10) / 10; //securité
	if (minute <= 60) return `${minute} minutes ${seconde} secondes`;
	var heure = Math.floor(minute / 60);
	minute %= 60;
	if (heure <= 48) return `${heure} heures ${minute} minutes ${seconde} secondes`;
	//après 2 jours (ça fait plus jolie)
	var jour = Math.floor(heure / 24);
	heure %= 24;
	if (jour <= 730) return `${jour} jours ${heure} heures ${minute} minutes ${seconde} secondes`;
	//après 2 ans
	var ans = Math.floor(jour / 365.25);
	jour = Math.ceil(jour % 365.25);

	return `${ans} ans ${jour} jours ${heure} heures ${minute} minutes ${seconde} secondes`;
}

export default {
	dateTimeFormat,
	getFrenchTime,
	getCurrentFrenchTime,
	getFrenchDate,

	getUTCCurrentDate,

	getDurationTime,
};
