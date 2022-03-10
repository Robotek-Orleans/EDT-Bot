//https://discord.js.org/#/docs/main/stable/typedef/Snowflake

//Discord epoch : 01/01/2015 = 1420070400 sec since epoch (01/01/1970)
const timestampDiscordEpoch = 1420070400 * 1000;

export class Snowflake {
	snowflake;
	get snowflakeBin() {
		var bin = parseInt(this.snowflake, 10).toString(2);
		while (bin.length < 64) bin = '0' + bin;
		return bin;
	}
	getSnowflakePart(start, nb_bits) {
		return parseInt(this.snowflakeBin.substr(start, nb_bits), 2);
	}

	get msecSinceDiscord() { return this.getSnowflakePart(0, 42); }
	get msecSinceEpoch() { return this.msecSinceDiscord + timestampDiscordEpoch; }
	get timestamp() { return this.msecSinceEpoch; }
	get secSinceEpoch() { return Math.floor(this.msecSinceEpoch / 1000); }

	get worker() { return this.getSnowflakePart(42, 5); }
	get pid() { return this.getSnowflakePart(47, 5); }
	get increment() { return this.getSnowflakePart(52, 12); }

	constructor(snowflake) { this.snowflake = snowflake; }
}

export function getDateSinceDiscord(snowflake) {
	return new Snowflake(snowflake).msecSinceDiscord;
}
export function getDateSinceEpoch(snowflake) {
	return new Snowflake(snowflake).msecSinceEpoch;
}
export function isSnowflake(text) {
	return typeof text == 'string' && text.match(/^\d{10,30}$/) != null;
}

export default {
	Snowflake,
	timestampDiscordEpoch,

	getDateSinceDiscord,
	getDateSinceEpoch,
	getWorker: snowflake => new Snowflake(snowflake).worker,
	getPid: snowflake => new Snowflake(snowflake).pid,
	getIncrement: snowflake => new Snowflake(snowflake).increment,

	isSnowflake,
};
