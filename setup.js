import dotenv from 'dotenv'; dotenv.config();
process.env.WIPOnly = process.argv.includes("WIP") ? true : '';
process.env.HEROKU = process.execPath.includes('heroku') ? true : '';

import 'colors';//colors for everyone ! (don't remove)