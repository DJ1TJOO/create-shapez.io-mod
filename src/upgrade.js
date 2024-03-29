import arg from "arg";
import inquirer from "inquirer";
import { upgradeProject } from "./main";

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			"--files": Boolean,
			"--shapez": String,
			"--shapez-repo": String,
			"--no-install": Boolean,
			"--yes": Boolean,
			"-f": "--files",
			"-s": "--shapez",
			"-r": "--shapez-repo",
			"-n": "--no-install",
			"-y": "--yes",
		},
		{
			argv: rawArgs.slice(2),
		}
	);
	return {
		skipPrompts: args["--yes"] || false,
		updateFiles: args["--files"] || false,
		shapez: args["--shapez"] || false,
		shapezRepo: args["--shapez-repo"] || false,
		runInstall: !args["--no-install"],
	};
}

async function promptForMissingOptions(options) {
	const defaultShapez = "latest";
	const defaultShapezRepo = "https://github.com/tobspr/shapez.io";
	const defaultInstallShapez = true;
	const defaultUpdateFiles = true;

	if (options.skipPrompts) {
		return {
			shapezRepo: options.shapezRepo || defaultShapezRepo,
			shapez: options.shapez || defaultShapez,
			installShapez: options.shapez || defaultInstallShapez,
			updateFiles: options.updateFiles || defaultUpdateFiles,
			packageManager: "yarn",
		};
	}

	const questions = [];
	if (!options.shapez) {
		questions.push({
			type: "confirm",
			name: "installShapez",
			message: "Download shapez.io build?",
			default: defaultInstallShapez,
		});

		questions.push({
			name: "shapez",
			message: "Please input the shapez commit hash you want to use:",
			default: defaultShapez,
			when: (answers) => answers.installShapez,
		});
	}

	if (!options.updateFiles) {
		questions.push({
			type: "confirm",
			name: "updateFiles",
			message: "Download and update new project files?",
			default: defaultUpdateFiles,
		});
	}

	const answers = await inquirer.prompt(questions);
	return {
		shapezRepo: options.shapezRepo || defaultShapezRepo,
		shapez: options.shapez || answers.shapez,
		installShapez: options.shapez ? true : answers.installShapez,
		runInstall: options.runInstall || answers.runInstall,
		updateFiles: options.updateFiles || answers.updateFiles,
		packageManager: "yarn",
	};
}

export async function upgrade(args) {
	let options = parseArgumentsIntoOptions(args);
	options = await promptForMissingOptions(options);

	await upgradeProject(options);
}
