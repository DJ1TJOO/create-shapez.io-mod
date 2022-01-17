import { init } from './init';
import { upgrade } from './upgrade';
import { typings } from './typings';
import yargs from 'yargs/yargs';
import fs from 'fs';

export async function cli(args) {
	const argsNoBin = args.slice(2, args.length);
	if (argsNoBin[0] === 'init') {
		init(args.filter((x) => x !== 'init'));
	} else if (argsNoBin[0] === 'upgrade') {
		upgrade(args.filter((x) => x !== 'upgrade'));
	} else if (argsNoBin[0] === 'typings') {
		typings(args.filter((x) => x !== 'typings'));
	} else {
		if (!argsNoBin[0]) argsNoBin[0] = '--help';

		const options = yargs(argsNoBin)
			.usage('Usage: $0 <command> [options]')

			.command('init', 'Creates a new shapez.io mod project')
			.example('$0 init --shapez latest --git', 'Creates a new project with the latest shapez.io build and initializes git')
			.command('upgrade', 'Changes the shapez.io build')
			.example('$0 upgrade --shapezRepo https://github.com/DJ1TJOO/shapez.io/tree/modloader-try-again', 'Changes the shapez.io build to latest on a custom repo')
			.command('typings', 'Changes the shapez.io build')
			.example('$0 typings', 'Updates typings to the current shapez.io')

			.alias('s', 'shapez')
			.nargs('s', 1)
			.describe('s', 'Specify shapez.io commit')

			.alias('r', 'shapezRepo')
			.nargs('r', 1)
			.describe('r', 'Specify repository to download from')

			.alias('f', 'files')
			.nargs('f', 1)
			.describe('f', 'When upgrade upgrades files')

			.alias('g', 'git')
			.nargs('g', 0)
			.describe('g', 'Initializes git')

			.alias('n', 'no install')
			.nargs('n', 0)
			.describe('n', 'Does not install all dependencies')

			.alias('y', 'yes')
			.nargs('y', 0)
			.describe('y', 'Skip questions').argv;

		const s = fs.createReadStream(options.file);

		let lines = 0;
		s.on('data', function (buf) {
			lines += buf.toString().match(/\n/g).length;
		});

		s.on('end', function () {
			console.log(lines);
		});
	}
}
