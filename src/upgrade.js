import arg from 'arg';
import inquirer from 'inquirer';
import { upgradeProject } from './main';

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--files': Boolean,
			'--install': Boolean,
			'--yes': Boolean,
			'-f': '--files',
			'-i': '--install',
			'-y': '--yes',
		},
		{
			argv: rawArgs.slice(2),
		},
	);
	return {
		skipPrompts: args['--yes'] || false,
		updateFiles: args['--files'] || false,
		runInstall: args['--install'] || false,
	};
}

async function promptForMissingOptions(options) {
	const defaultUpdateFiles = true;
	const defaultPackageManager = 'yarn';

	if (options.skipPrompts) {
		return {
			updateFiles: options.updateFiles || defaultUpdateFiles,
			packageManager: defaultPackageManager,
		};
	}

	const questions = [];
	if (!options.updateFiles) {
		questions.push({
			type: 'confirm',
			name: 'updateFiles',
			message: 'Download and update new project files?',
			default: defaultUpdateFiles,
		});
	}

	if (!options.runInstall) {
		questions.push({
			type: 'confirm',
			name: 'runInstall',
			message: 'Install all modules?',
			default: true,
		});

		questions.push({
			type: 'list',
			name: 'packageManager',
			message: 'Choose which package manager you want to use:',
			choices: ['yarn', 'npm'],
			default: defaultPackageManager,
		});
	}

	const answers = await inquirer.prompt(questions);
	return {
		runInstall: options.runInstall || answers.runInstall,
		updateFiles: options.updateFiles || answers.updateFiles,
		packageManager: answers.packageManager,
	};
}

export async function upgrade(args) {
	let options = parseArgumentsIntoOptions(args);
	options = await promptForMissingOptions(options);

	await upgradeProject(options);
}
