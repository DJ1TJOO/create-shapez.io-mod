import chalk from 'chalk';
import fs from 'fs';
import ncp from 'ncp';
import path from 'path';
import { promisify } from 'util';
import Listr from 'listr';
import { projectInstall } from 'pkg-install';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import admZip from 'adm-zip';
import url from 'url';
import prettier from 'prettier';

const octokit = new Octokit();
const access = promisify(fs.access);
const copy = promisify(ncp);

async function copyTemplateFiles(options) {
	return copy(options.templateDirectory, options.targetDirectory, {
		clobber: false,
	});
}

async function updateBuildFiles(options) {
	return copy(path.join(options.templateDirectory, 'gulp'), path.join(options.targetDirectory, 'gulp'), {
		clobber: true,
	});
}

async function updateTemplateFiles(options) {
	// Paths
	const targetDirectory = options.targetDirectory;
	const packagePath = path.join(targetDirectory, 'package.json');
	const mainPath = path.join(targetDirectory, 'src', 'js', 'main.js');

	// Read files
	let packageFile = fs.readFileSync(packagePath, {
		encoding: 'utf-8',
	});
	let mainFile = fs.readFileSync(mainPath, {
		encoding: 'utf-8',
	});

	// Update files
	packageFile = packageFile.replace(/mod_name/g, options.name);
	packageFile = packageFile.replace(/mod_version/g, options.version);
	packageFile = packageFile.replace(/mod_author/g, options.author);
	packageFile = packageFile.replace(/mod_website/g, options.website);

	mainFile = mainFile.replace(/mod_id/g, options.modId);
	mainFile = mainFile.replace(/mod_name/g, options.name);
	mainFile = mainFile.replace(/mod_description/g, options.description);
	mainFile = mainFile.replace(/mod_version/g, options.version);
	mainFile = mainFile.replace(/mod_author/g, options.author);
	mainFile = mainFile.replace(/mod_website/g, options.website);

	// Write files
	fs.writeFileSync(packagePath, packageFile);
	fs.writeFileSync(mainPath, mainFile);

	return;
}

function getClosest(string, offset, regex) {
	let indices = [];

	let result;
	while ((result = regex.exec(string))) {
		indices.push(result);
	}

	return indices.reverse().find((x) => x.index <= offset);
}

async function downloadShapez(options) {
	const commit = options.shapez;
	let [owner, repo, tree, branch] = options.shapezRepo.replace('https://github.com/', '').split('/');
	if (tree !== 'tree' || !branch) {
		branch = 'master';
	}

	try {
		const lastCommit = await octokit.request('GET https://api.github.com/repos/{owner}/{repo}/commits/{branch}', {
			owner,
			repo,
			branch: commit !== 'latest' ? commit : branch,
		});

		const commitId = lastCommit.data.sha.substring(0, 7);

		const download = await octokit.repos.downloadZipballArchive({
			owner,
			repo,
			ref: commit !== 'latest' ? commit : branch,
		});
		fs.writeFileSync('./shapez-zip.zip', Buffer.from(download.data));

		// Extract new shapez
		const zip = new admZip('./shapez-zip.zip');
		zip.extractAllTo(`./shapez-${owner}-${repo}-${commitId}/`, true);
		await copy(`./shapez-${owner}-${repo}-${commitId}/${owner}-${repo}-${commitId}`, './shapez', {
			clobber: true,
		});
		fs.rmdir(`./shapez-${owner}-${repo}-${commitId}`, { recursive: true, force: true }, () => {});
		fs.unlink('./shapez-zip.zip', () => {});

		// Update local config
		let config = fs.readFileSync('./shapez/src/js/core/config.local.template.js', 'utf-8');
		config = config.replace(/(\/\/)?[\s]*externalModUrl:[^]*?"[^]*?",/gms, 'externalModUrl: "http://localhost:3010/mod.js",');
		fs.writeFileSync('./shapez/src/js/core/config.local.js', config);

		// Generate types.d.ts
		execSync('tsc src/js/application.js --declaration --allowJs --emitDeclarationOnly --skipLibCheck --out types.js', {
			cwd: './shapez',
		});

		// Update types
		let types = fs.readFileSync('./shapez/types.d.ts', 'utf-8');
		types = types.replace(/declare module "([^]*?)"/gms, (matched, moduleName) => `declare module "shapez/${moduleName}"`);
		types = types.replace(/import\("([^]*?)"\)/gms, (matched, moduleName, offset, string) => {
			moduleName = moduleName.replace('.js', '');
			if (moduleName.startsWith('.')) {
				const closest = getClosest(string, offset, /declare module "([^]*?)"/gms);

				const parent = path.dirname(closest['0'].replace('declare module "', '').replace('"', ''));
				const module = path.join(parent, moduleName).replace(/\\/g, '/');

				return `import("${module}")`;
			} else {
				return `import("shapez/${moduleName}")`;
			}
		});
		types = types.replace(
			/import {([^]*?)} from "([^]*?)";/gms,
			(matched, imports, moduleName) => `import {${imports}} from "shapez/${moduleName.replace(/\.\.\//gms, '').replace('.js', '')}"`,
		);
		types = types.replace(/var/gms, 'let');
		types += `declare const CSS_MAIN: string;
					declare const ATLASES: {
						hq: {
							src: string;
							atlasData: import("shapez/core/loader").AtlasDefinition;
						};
						mq: {
							src: string;
							atlasData: import("shapez/core/loader").AtlasDefinition;
						};
						lq: {
							src: string;
							atlasData: import("shapez/core/loader").AtlasDefinition;
						};
					};
					declare const TRANSLATIONS: {
						[x: string]: object
					};
					declare const THEMES: {
						[x: string]: object
					};
					declare const shapez: any;
					declare function registerMod(mod: () => typeof import("shapez/mods/mod").Mod): void;`;

		fs.writeFileSync('./src/js/types.d.ts', types);

		prettier.format('./src/js/types.d.ts', {
			trailingComma: 'es5',
			tabWidth: 4,
			semi: true,
			singleQuote: false,
			printWidth: 110,
			useTabs: false,
			quoteProps: 'consistent',
			bracketSpacing: true,
			arrowParens: 'avoid',
			endOfLine: 'auto',
		});
		return;
	} catch (error) {
		console.log(error);
		return Promise.reject(new Error('Failed to download shapez.io build'));
	}
}

async function initGit(options) {
	try {
		execSync('git init', {
			cwd: options.targetDirectory,
		});
		return;
	} catch (error) {
		return Promise.reject(new Error('Failed to initialize git'));
	}
}

export async function createProject(options) {
	options = {
		...options,
		targetDirectory: options.targetDirectory || process.cwd(),
	};

	const pathName = url.fileURLToPath(import.meta.url);
	const templateDir = path.resolve(pathName, '../../template/');
	options.templateDirectory = templateDir;

	try {
		await access(templateDir, fs.constants.R_OK);
	} catch (err) {
		console.error('%s Could not access template', chalk.red.bold('ERROR'));
		process.exit(1);
	}

	const tasks = new Listr([
		{
			title: 'Copy project files',
			task: () => copyTemplateFiles(options),
		},
		{
			title: 'Updating project files',
			task: () => updateTemplateFiles(options),
		},
		{
			title: `Downloading${options.shapez === 'latest' ? ' latest' : ''} shapez.io build`,
			task: () => downloadShapez(options),
			skip: () => !options.installShapez,
		},
		{
			title: 'Initialize git',
			task: () => initGit(options),
			enabled: () => options.git,
		},
		{
			title: 'Install dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: options.targetDirectory,
				}),
			skip: () => (!options.runInstall ? 'Pass --install to automatically install dependencies' : undefined),
		},
		{
			title: 'Install gulp dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'gulp'),
				}),
			skip: () => (!options.runInstall ? 'Pass --install to automatically install dependencies' : undefined),
		},
		{
			title: 'Install shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Pass --install to automatically install dependencies' : undefined),
		},
		{
			title: 'Install gulp shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez', 'gulp'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Pass --install to automatically install dependencies' : undefined),
		},
	]);

	await tasks.run();
	console.log('%s Project ready', chalk.green.bold('DONE'));
	return true;
}

export async function upgradeProject(options) {
	options = {
		...options,
		targetDirectory: options.targetDirectory || process.cwd(),
	};

	const pathName = url.fileURLToPath(import.meta.url);
	const templateDir = path.resolve(pathName, '../../template/');
	options.templateDirectory = templateDir;

	const tasks = new Listr([
		{
			title: 'Updating build files',
			task: () => updateBuildFiles(options),
			skip: () => !options.updateFiles,
		},
		{
			title: 'Copy new project files',
			task: () => copyTemplateFiles(options),
			skip: () => !options.updateFiles,
		},
		{
			title: `Downloading${options.shapez === 'latest' ? ' latest' : ''} shapez.io build`,
			task: () => downloadShapez(options),
			skip: () => !options.installShapez,
		},
		{
			title: 'Install dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: options.targetDirectory,
				}),
			skip: () => (!options.runInstall ? 'Pass --install to automatically install dependencies' : undefined),
		},
		{
			title: 'Install gulp dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'gulp'),
				}),
			skip: () => (!options.runInstall ? 'Pass --install to automatically install dependencies' : undefined),
		},
		{
			title: 'Install shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Pass --install to automatically install dependencies' : undefined),
		},
		{
			title: 'Install gulp shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez', 'gulp'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Pass --install to automatically install dependencies' : undefined),
		},
	]);

	await tasks.run();
	console.log('%s Upgrade ready', chalk.green.bold('DONE'));
	return true;
}
