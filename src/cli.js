import { init } from './init';
import { upgrade } from './upgrade';
import yargs from 'yargs/yargs';
import fs from 'fs';

export async function cli(args) {
	const argsNoBin = args.slice(2, args.length);
	if (argsNoBin[0] === 'init') {
		init(args.filter((x) => x !== 'init'));
	} else if (argsNoBin[0] === 'upgrade') {
		upgrade(args.filter((x) => x !== 'upgrade'));
	} else {
		if (!argsNoBin[0]) argsNoBin[0] = '--help';

		const options = yargs(argsNoBin)
			.usage('Usage: $0 <command> [options]')

			.command('init', 'Creates a new shapez.io mod project')
			.example('$0 init --git', 'Creates a new project and initializes git')
			.command('upgrade', 'Update the build files')
			.example('$0 upgrade --files', 'Updates the build files')

			.alias('f', 'files')
			.nargs('f', 1)
			.describe('f', 'When upgrade upgrades files')

			.alias('g', 'git')
			.nargs('g', 0)
			.describe('g', 'Initializes git')

			.alias('i', 'install')
			.nargs('i', 0)
			.describe('i', 'Install all dependencies')

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
