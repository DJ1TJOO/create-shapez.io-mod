import arg from "arg";
import inquirer from "inquirer";
import { createMod } from "./main";

function parseArgumentsModOptions(rawArgs) {
	const args = arg(
		{
			"--yes": Boolean,
			"-y": "--yes",
		},
		{
			argv: rawArgs.slice(2),
		}
	);
	return {
		skipPrompts: args["--yes"] || false,
	};
}

async function promptForMissingOptions(options) {
	const defaultName = "shapezio-mod";
	const defaultModId = "mod";
	const defaultDescription = "";
	const defaultAuthor = "";
	const defaultWebsite = "";
	const defaultVesion = "1.0.0";

	if (options.skipPrompts) {
		return {
			...options,
			name: defaultName,
			website: defaultWebsite,
			modId: defaultModId,
			description: defaultDescription,
			author: defaultAuthor,
			version: defaultVesion,
			packageManager: "yarn",
		};
	}

	const questions = [];
	questions.push({
		name: "name",
		message: "Name:",
		default: defaultName,
	});

	questions.push({
		name: "modId",
		message: "Mod ID:",
		default: defaultModId,
	});

	questions.push({
		name: "version",
		message: "Version:",
		default: defaultVesion,
	});

	questions.push({
		name: "description",
		message: "Description:",
		default: defaultDescription,
	});

	questions.push({
		name: "author",
		message: "Author:",
		default: defaultAuthor,
	});

	questions.push({
		name: "website",
		message: "Website:",
		default: defaultWebsite,
	});

	const answers = await inquirer.prompt(questions);
	return {
		...options,
		name: answers.name,
		modId: answers.modId,
		website: answers.website,
		description: answers.description,
		author: answers.author,
		version: answers.version,
		packageManager: "yarn",
	};
}

export async function mod(args) {
	let options = parseArgumentsModOptions(args);
	options = await promptForMissingOptions(options);
	await createMod(options);
}
