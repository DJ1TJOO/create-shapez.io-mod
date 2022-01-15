import arg from 'arg';
import inquirer from 'inquirer';
import { createProject } from './main';

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--git': Boolean,
			'--install': Boolean,
			'--yes': Boolean,
			'-g': '--git',
			'-i': '--install',
			'-y': '--yes',
		},
		{
			argv: rawArgs.slice(2),
		},
	);
	return {
		skipPrompts: args['--yes'] || false,
		git: args['--git'] || false,
		runInstall: args['--install'] || false,
	};
}

async function promptForMissingOptions(options) {
	const defaultName = 'shapezio-mod';
	const defaultModId = 'mod';
	const defaultDescription = '';
	const defaultAuthor = '';
	const defaultWebsite = '';
	const defaultVesion = '1.0.0';
	const defaultPackageManager = 'yarn';

	if (options.skipPrompts) {
		return {
			...options,
			name: defaultName,
			website: defaultWebsite,
			modId: defaultModId,
			description: defaultDescription,
			author: defaultAuthor,
			version: defaultVesion,
			packageManager: defaultPackageManager,
		};
	}

	const questions = [];
	questions.push({
		name: 'name',
		message: 'Name:',
		default: defaultName,
	});

	questions.push({
		name: 'modId',
		message: 'Mod ID:',
		default: defaultModId,
	});

	questions.push({
		name: 'version',
		message: 'Version:',
		default: defaultVesion,
	});

	questions.push({
		name: 'description',
		message: 'Description:',
		default: defaultDescription,
	});

	questions.push({
		name: 'author',
		message: 'Author:',
		default: defaultAuthor,
	});

	questions.push({
		name: 'website',
		message: 'Website:',
		default: defaultWebsite,
	});

	questions.push({
		type: 'list',
		name: 'packageManager',
		message: 'Choose which package manager you want to use:',
		choices: ['yarn', 'npm'],
		default: defaultPackageManager,
	});

	if (!options.git) {
		questions.push({
			type: 'confirm',
			name: 'git',
			message: 'Initialize a git repository?',
			default: true,
		});
	}

	if (!options.runInstall) {
		questions.push({
			type: 'confirm',
			name: 'runInstall',
			message: 'Install all modules?',
			default: true,
		});
	}

	const answers = await inquirer.prompt(questions);
	return {
		...options,
		runInstall: options.runInstall || answers.runInstall,
		git: options.git || answers.git,
		name: answers.name,
		modId: answers.modId,
		website: answers.website,
		description: answers.description,
		author: answers.author,
		version: answers.version,
		packageManager: answers.packageManager,
	};
}

export async function init(args) {
	let options = parseArgumentsIntoOptions(args);
	options = await promptForMissingOptions(options);
	await createProject(options);
}
