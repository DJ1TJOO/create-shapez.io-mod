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
		const artifactName = 'shapezio-mod-build-' + lastCommit.data.sha.substring(0, 7);

		const artifacts = await octokit.request('GET https://api.github.com/repos/{owner}/{repo}/actions/artifacts', {
			owner,
			repo,
		});
		const artifactMeta = artifacts.data.artifacts.find((x) => x.name === artifactName);

		const workflows = await octokit.request('GET https://api.github.com/repos/{owner}/{repo}/actions/workflows/ci-development.yml/runs', {
			owner,
			repo,
		});
		const workflowMeta = workflows.data.workflow_runs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

		const artifact = await octokit.request(`GET https://nightly.link/{owner}/{repo}/suites/{check_suite_id}/artifacts/{artifact_id}`, {
			owner,
			repo,
			check_suite_id: workflowMeta.check_suite_id,
			artifact_id: artifactMeta.id,
		});

		fs.writeFileSync('./shapez-zip.zip', Buffer.from(artifact.data));

		const zip = new admZip('./shapez-zip.zip');
		zip.extractEntryTo('types.d.ts', './src/js/', true, true);
		zip.extractAllTo('./shapez', true);

		fs.unlinkSync('./shapez-zip.zip');

		return;
	} catch (error) {
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
	]);

	await tasks.run();
	console.log('%s Upgrade ready', chalk.green.bold('DONE'));
	return true;
}
