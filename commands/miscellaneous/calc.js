import { CommandLevelOptions, ReceivedCommand } from '../../bot/command/received.js';
import { MessageMaker } from '../../lib/messageMaker.js';

export default {
	name: 'calc',
	description: 'Calculs et lancés de dés',
	alts: ['r'],
	interactions: true,

	security: {
		place: 'public',
	},

	options: [
		{
			name: 'ligne_de_calcul',
			description: 'Le calcul à faire',
			type: 3,
			required: true,
		},
	],

	/**
	 * @param {ReceivedCommand} cmdData
	 * @param {CommandLevelOptions} levelOptions
	 */
	executeAttribute(cmdData, levelOptions) {
		var lineCalc = levelOptions.options.map(o => o.value).join(' ');

		const comment = lineCalc.match(/#.*$/)?.[0] || '';
		if (comment.length) {
			lineCalc = lineCalc.substr(0, lineCalc.length - comment.length);
		}
		const space = comment.length ? ' ' : '';
		lineCalc = lineCalc.replace(/ +$/, '');

		return new MessageMaker(`\`${lineCalc}\`${space}${comment} = ${calculate(lineCalc)}`);
	},
};

const getRandomInt = max => Math.floor(Math.random() * Math.floor(max));

const n = '[\\d\\.]';
const op = '\\+\\-\\*\\/';
function rollDices(dices = 1, max = 6) {
	return new Array(parseFloat(dices || 1)).fill(0).map(() => getRandomInt(parseFloat(max || 6)) + 1);
}
function listCompare(strOperator, funcOperator) {
	// 10d6 >= 3 = (n: 5 6 4 ~~1~~ ~~1~~ 3 6 3 4 6) = 8
	return [
		`(\\d[\\d \\.${op}]+) *${strOperator} *(${n}+)`,
		match => {
			return (
				'(n: ' +
				match[1]
					.replace(/ +/, ' ')
					.replace(/^ /, '')
					.replace(/ $/, '')
					.split(' ')
					.map(v => parseFloat(v) || 0)
					.map(v => (funcOperator(v, match[2]) ? v : `~~${v}~~`))
					.join(' ') +
				')'
			);
		},
	];
}
function pairOperation(strOperator, funcOperator) {
	return [
		`(\\-?${n}+) *\\${strOperator} *([\\+\\-]?${n}*)`,
		match => funcOperator(parseFloat(match[1]) || undefined, parseFloat(match[2]) || undefined),
	];
}

const transfoCalc = [
	[[`(${n}*)d(${n}*)`, match => rollDices(match[1], match[2]).join(' ')]],
	[
		// transfo sign
		[/\+\+/, () => '+'],
		[/\-\-/, () => '+'],
		[/\+\-/, () => '-)'],
		[/\-\+/, () => '-'],
		[/\+ +/, () => '+'],
		[/\- +/, () => '-'],
		[/\* +/, () => '*'],
		[/\/ +/, () => '/'],
		[/ +/, () => ' '],
	],
	[
		[`[${op}]*~~[\\d\\. ${op}]*~~`, () => '', 'before'], //deleted number
	],
	[
		[`\\(n: [\\d \\.${op}]*\\)`, match => match[0].match(new RegExp(`${n}+`, 'g'))?.length || 0], //deleted number
	],
	[
		// specialCalc
		[...listCompare('>', (a = 0, b = 0) => a > b), 'after'],
		listCompare('>=', (a = 0, b = 0) => a >= b),
		listCompare('==?', (a = 0, b = 0) => a == b),
		listCompare('<=', (a = 0, b = 0) => a <= b),
		listCompare('<', (a = 0, b = 0) => a < b),
	],
	[
		// transfoMult
		pairOperation('/', (a = 0, b = 0) => a / b), // 1 / 2 * 3
		pairOperation('*', (a = 0, b = 0) => a * b),
	],
	[
		// transfoAddition
		pairOperation('+', (a = 0, b = 0) => a + b),
		pairOperation('-', (a = 0, b = 0) => a - b),
		pairOperation(' ', (a = 0, b = 0) => a + b),
	],
	[
		// transfoAddition
		[/\( *\+? *(\d+) *\)/, match => match[1]],
		[/\( *\- *(\d+) *\)/, match => -match[1]],
		//[/\([ \+\-\*\/]*\)/, () => 0],
	],
];

function calculate(line) {
	line = line.replace(/^ */, '').replace('&gt;', '>').replace('&lt;', '<');
	var lineBeforeTransfo = line; // = line.replace(/(\d) +(\d)/g, '$1+$2').replace(/ /g, '');
	//`!r 1++2 * 5` donne `1+2*5`
	//console.log('');
	var previousLine;
	var i = 0;
	do {
		if (i == 1) {
			// déjà un tour de fait
			lineBeforeTransfo = line;
		}
		//console.log('lineBeforeTransfo', lineBeforeTransfo);
		previousLine = line;
		for (const transfoGrp of transfoCalc) {
			const lineTransformed = applyTransfo(line, transfoGrp);
			if (lineTransformed != line) {
				//console.log('transfo done', lineTransformed, transfoGrp);
				if (transfoGrp.filter(t => t[2] === 'after').length != 0) {
					// l'une des transfos demande l'update avec la nouvelle version
					lineBeforeTransfo = lineTransformed;
				} else if (transfoGrp.filter(t => t[2] === 'before').length != 0) {
					// l'une des transfos demande l'update avec la version précédente
					lineBeforeTransfo = line;
				}
				line = lineTransformed;
				break;
			}
		}
		i++;
	} while (line != previousLine && line.length < 100000);

	var result = line;
	if (result == '') result = 0;

	//console.log('result:', { line, result});
	if (i > 1) {
		return `${lineBeforeTransfo} = ${result}`;
	}
	return `${result}`;
}

function applyTransfo(line, rules) {
	var i = 0;

	for (const special of rules) {
		const regex = new RegExp(special[0]);
		var match;
		while ((match = line.match(regex))) {
			const replacement = special[1](line.match(regex));
			line = line.replace(match[0], replacement);

			//console.log('replacement:', {regex, match: match[0], replacement, line});

			//TODO: remove this limit
			i++;
			if (i > 100) break;
		}
	}
	return line;
}
