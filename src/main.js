import chalk from 'chalk';
import fs from 'fs';
import ncp from 'ncp';
import path from 'path';
import { promisify } from 'util';
import Listr from 'listr';
import { projectInstall } from 'pkg-install';
import { exec, execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
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
	packageFile = packageFile.replace(/mod_id/g, options.modId);
	packageFile = packageFile.replace(/mod_name/g, options.name);
	packageFile = packageFile.replace(/mod_description/g, options.description);
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

async function getShapezCommit(options) {
	const commit = options.shapez;
	let [owner, repo, tree, branch] = options.shapezRepo.replace('https://github.com/', '').split('/');
	if (tree !== 'tree' || !branch) {
		branch = 'master';
	}

	const lastCommit = await octokit.request('GET https://api.github.com/repos/{owner}/{repo}/commits/{branch}', {
		owner,
		repo,
		branch: commit !== 'latest' ? commit : branch,
	});

	return lastCommit.data.sha.substring(0, 7);
}

async function handleShapez(options) {
	// Removed optional dependencies
	let electronPackage = JSON.parse(fs.readFileSync(path.join(options.targetDirectory, 'shapez/electron/package.json'), 'utf-8'));
	electronPackage.optionalDependencies = {};
	fs.writeFileSync(path.join(options.targetDirectory, 'shapez/electron/package.json'), JSON.stringify(electronPackage, null, 4));

	// Update local config
	let config = fs.readFileSync(path.join(options.targetDirectory, 'shapez/src/js/core/config.local.template.js'), 'utf-8');
	config = config.replace(/(\/\/)?[\s]*externalModUrl:[^]*?"[^]*?",/gms, 'externalModUrl: "http://localhost:3010/mod.js",');
	fs.writeFileSync(path.join(options.targetDirectory, 'shapez/src/js/core/config.local.js'), config);

	// Fix getRevision
	let buildUtils = fs.readFileSync(path.join(options.targetDirectory, './shapez/gulp/buildutils.js'), 'utf-8');
	buildUtils = buildUtils.replace(/getRevision[^]*?},/gms, 'getRevision: () => "",');
	fs.writeFileSync(path.join(options.targetDirectory, 'shapez/gulp/buildutils.js'), buildUtils);
}

async function cloneShapez(options) {
	let [owner, repo, tree, branch] = options.shapezRepo.replace('https://github.com/', '').split('/');
	await new Promise((res) => {
		exec(
			`git clone --depth 1${branch ? ` -b ${branch}` : ''} https://github.com/${owner}/${repo}.git ./shapez`,
			{
				cwd: options.targetDirectory,
			},
			res,
		);
	});
	await updateClonedShapez(options);
}

async function updateClonedShapez(options) {
	const commitId = await getShapezCommit(options);

	await new Promise((res) => {
		exec(
			`git fetch`,
			{
				cwd: path.join(options.targetDirectory, 'shapez'),
			},
			res,
		);
	});

	await new Promise((res) => {
		exec(
			`git checkout -f ${commitId}`,
			{
				cwd: path.join(options.targetDirectory, 'shapez'),
			},
			res,
		);
	});

	await handleShapez(options);
}

async function createTypings(options) {
	// Generate types.d.ts
	await new Promise((res) =>
		exec(
			'yarn tsc src/js/application.js --declaration --allowJs --emitDeclarationOnly --skipLibCheck --out types.js',
			{
				cwd: path.join(options.targetDirectory, 'shapez'),
			},
			res,
		),
	);

	// Update types
	let types = fs.readFileSync(path.join(options.targetDirectory, 'shapez/types.d.ts'), 'utf-8');
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
	types = types.replace(/var _default/gms, 'let _default');
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
					declare function $shapez_registerMod(
						mod: typeof import("shapez/mods/mod").Mod,
						meta: import("shapez/mods/modloader").ModMetadata
					): void;

					declare function assert(condition: boolean | object | string, ...errorMessage: string[]): void;
					declare function assertAlways(condition: boolean | object | string, ...errorMessage: string[]): void;

					declare interface FactoryTemplate<T> {
						entries: Array<T>;
						entryIds: Array<string>;
						idToEntry: any;

						getId(): string;
						getAllIds(): Array<string>;
						register(entry: T): void;
						hasId(id: string): boolean;
						findById(id: string): T;
						getEntries(): Array<T>;
						getNumEntries(): number;
					}

					declare interface SingletonFactoryTemplate<T> {
						entries: Array<T>;
						idToEntry: any;

						getId(): string;
						getAllIds(): Array<string>;
						register(classHandle: T): void;
						hasId(id: string): boolean;
						findById(id: string): T;
						findByClass(classHandle: T): T;
						getEntries(): Array<T>;
						getNumEntries(): number;
					}

					declare class TypedTrackedState<T> {
						constructor(callbackMethod?: (value: T) => void, callbackScope?: any);

						set(value: T, changeHandler?: (value: T) => void, changeScope?: any): void;

						setSilent(value: any): void;
						get(): T;
					}

					declare interface TypedSignal<T extends Array<any>> {
						add(receiver: (...args: T) => /* STOP_PROPAGATION */ string | void, scope?: object);
						addToTop(receiver: (...args: T) => /* STOP_PROPAGATION */ string | void, scope?: object);
						remove(receiver: (...args: T) => /* STOP_PROPAGATION */ string | void);

						dispatch(...args: T): /* STOP_PROPAGATION */ string | void;

						removeAll();
					}

					declare type Layer = "regular" | "wires";
					declare type ItemType = "shape" | "color" | "boolean";`;

	// Add globalConfig types
	types = types.replace(
		/export namespace globalConfig {/g,
		`
    export namespace globalConfig {
		export const tileSize: number;
        export const halfTileSize: number;
        export const beltSpeedItemsPerSecond: number;
        export const achievementSliceDuration: number;
        export const itemSpacingOnBelts: number;
        export const assetsDpi: number;
        export const assetsSharpness: number;
        export const puzzleModeSpeed: number;
        export const chunkAggregateSize: number;
        export const mapChunkSize: number;
        export const readerAnalyzeIntervalSeconds: number;
        export const smoothing: {
            quality: string;
            smoothMainCanvas: boolean;
        };
        export const debug: {
            renderForTrailer: boolean;
            framePausesBetweenTicks: number;
            disableSavegameWrite: boolean;
            fastGameEnter: boolean;
            noArtificialDelays: boolean;
            testClipping: boolean;
            logTimestamps: boolean;
            disableLoggingLogSources: boolean;
            testTranslations: boolean;
            disableMapOverwiew: boolean;
            disableTimedButtons: boolean;
            testAchievements: boolean;
            checkBeltPaths: boolean;
            instantBelts: boolean;
            blueprintsNoCost: boolean;
            testCulling: boolean;
            manualTickOnly: boolean;
            disableLogicTicks: boolean;
            showAtlasInfo: boolean;
            disableSlowAsserts: boolean;
            allBuildingsUnlocked: boolean;
            showAcceptorEjectors: boolean;
            showEntityBounds: boolean;
            enableEnitityInspector: boolean;
            renderChanges: boolean;
            disableUnlockDialog: boolean;
            instantMiners: boolean;
            doNotRenderStatics: boolean;
            renderWireRotations: boolean;
            framePausedBetweenTicks: boolean;
            externalModUrl: string;
            disableMusic: boolean;
            testAds: boolean;
            testPuzzleMod: boolean;
        };`,
	);

	types = prettier.format(types, {
		parser: 'typescript',
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

	fs.writeFileSync(path.join(options.targetDirectory, 'src/js/types.d.ts'), types, {
		overwrite: true,
	});
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

async function saveOptions(options) {
	const shapez = getOptions(options.targetDirectory);

	if (options.packageManager) shapez.packageManager = options.packageManager;
	shapez.currentShapezCommit = options.installShapez ? await getShapezCommit(options) : options.currentShapezCommit;

	fs.writeFileSync(path.join(options.targetDirectory, '.shapez'), JSON.stringify(shapez, null, 4));
}

function parseOptions(options) {
	const targetDirectory = options.targetDirectory || process.cwd();

	const shapez = getOptions(targetDirectory);

	return {
		...options,
		packageManager: options.packageManager || shapez.packageManager,
		currentShapezCommit: shapez.currentShapezCommit,
		targetDirectory,
	};
}

export function getOptions(targetDirectory) {
	const shapezPath = path.join(targetDirectory, '.shapez');

	let shapez = {};
	if (fs.existsSync(shapezPath)) {
		shapez = JSON.parse(fs.readFileSync(shapezPath));
	}

	return shapez;
}

export async function createProject(options) {
	options.targetDirectory = path.join(process.cwd(), options.modId);
	if (fs.existsSync(options.targetDirectory)) {
		console.log('%s A folder with the name "%s" already exists', chalk.red.bold('ERROR'), options.modId);
		return;
	}

	options = parseOptions(options);

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
			task: () => cloneShapez(options),
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
		},
		{
			title: 'Install gulp dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'gulp'),
				}),
		},
		{
			title: 'Install shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Install gulp shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez', 'gulp'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Install electron shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez', 'electron'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Creating typings',
			task: () => createTypings(options),
			skip: () => (!options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Saving options',
			task: () => saveOptions(options),
		},
	]);

	await tasks.run();
	console.log('%s Project ready', chalk.green.bold('DONE'));
	if (options.installShapez) {
		console.log(
			'%s You can now use %s, %s or %s',
			chalk.bgBlueBright.white.bold(' INFO '),
			chalk.green.bold('yarn dev'),
			chalk.green.bold('yarn build'),
			chalk.green.bold('yarn devStandalone'),
		);
	} else {
		console.log('%s You can now use %s', chalk.bgBlueBright.white.bold(' INFO '), chalk.green.bold('yarn build'));
	}
	return true;
}

export async function upgradeProject(options) {
	options = parseOptions(options);

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
			task: () => updateClonedShapez(options),
			skip: () => !options.installShapez,
		},
		{
			title: 'Install dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: options.targetDirectory,
				}),
		},
		{
			title: 'Install gulp dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'gulp'),
				}),
		},
		{
			title: 'Install shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Install gulp shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez', 'gulp'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Install electron shapez dependencies',
			task: () =>
				projectInstall({
					prefer: options.packageManager,
					cwd: path.join(options.targetDirectory, 'shapez', 'electron'),
				}),
			skip: () => (!options.runInstall || !options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Updating typings',
			task: () => createTypings(options),
			skip: () => (!options.installShapez ? 'Not installing shapez' : undefined),
		},
		{
			title: 'Saving options',
			task: () => saveOptions(options),
		},
	]);

	await tasks.run();
	console.log('%s Upgrade ready', chalk.green.bold('DONE'));
	if (options.installShapez) {
		console.log(
			'%s You can now use %s, %s or %s',
			chalk.bgBlueBright.white.bold(' INFO '),
			chalk.green.bold('yarn dev'),
			chalk.green.bold('yarn build'),
			chalk.green.bold('yarn devStandalone'),
		);
	} else {
		console.log('%s You can now use %s', chalk.bgBlueBright.white.bold(' INFO '), chalk.green.bold('yarn build'));
	}
	return true;
}

export async function updateTypings(options) {
	options = parseOptions(options);

	const tasks = new Listr([
		{
			title: 'Updating typings',
			task: () => createTypings(options),
		},
	]);

	await tasks.run();
	console.log('%s Typings ready', chalk.green.bold('DONE'));

	return true;
}
