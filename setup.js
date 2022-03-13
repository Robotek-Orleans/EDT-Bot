import dotenv from 'dotenv'; dotenv.config();
process.env.WIPOnly = process.argv.includes("WIP") ? true : process.env.WIPOnly || '';
if (!process.env.HOST) {
	if (process.execPath.includes('heroku'))
		process.env.HOST = 'Heroku';
	else
		process.env.HOST = process.env.COMPUTERNAME || 'Unknow';
}


import 'colors';//colors for everyone ! (don't remove)