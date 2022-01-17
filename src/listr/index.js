'use strict';
const logUpdate = require('log-update');
const chalk = require('chalk');
const figures = require('figures');
const indentString = require('indent-string');
const cliTruncate = require('cli-truncate');
const stripAnsi = require('strip-ansi');
const utils = require('./utils');

const cliProgress = require('cli-progress');

// create a new progress bar instance and use shades_classic theme
// const bar1 = new cliProgress.SingleBar({
// 	format: chalk.bgGreen.white(' {percentage}% ') + chalk.green('{bar}'),
// 	barCompleteChar: ,
// 	barIncompleteChar: ' ',
// 	hideCursor: true,
// });

const getBar = (total, completed) => {
	const barCompleteString = '\u2588';
	const barIncompleteString = ' ';
	const size = 40;

	// calculate barsize
	const completeSize = Math.round(completed * (size / total));
	const incompleteSize = size - completeSize;

	// generate bar string by stripping the pre-rendered strings
	return barCompleteString.repeat(completeSize) + barIncompleteString.repeat(incompleteSize);
};

const generateBar = (total, completed, format) => {
	let string = format.replace(/{bar}/g, getBar(total, completed));
	string = string.replace(/{percentage}/g, (completed / total) * 100);

	return string;
};

const renderHelper = (tasks, options, level) => {
	level = level || 0;

	let output = [];

	for (const task of tasks) {
		if (task.isEnabled()) {
			const skipped = task.isSkipped() ? ` ${chalk.dim('[skipped]')}` : '';

			output.push(
				indentString(
					` ${utils.getSymbol(task, options)} ${task.title}${skipped} ${
						task.progressBar ? generateBar(task.progressBar.total, task.progressBar.completed, chalk.bgGreen.white(' {percentage}% ') + chalk.green('{bar}')) : ''
					}`,
					level,
					'  ',
				),
			);

			if ((task.isPending() || task.isSkipped() || task.hasFailed()) && utils.isDefined(task.output)) {
				let data = task.output;

				if (typeof data === 'string') {
					data = stripAnsi(data.trim().split('\n').filter(Boolean).pop());

					if (data === '') {
						data = undefined;
					}
				}

				if (utils.isDefined(data)) {
					const out = indentString(`${figures.arrowRight} ${data}`, level, '  ');
					output.push(`   ${chalk.gray(cliTruncate(out, process.stdout.columns - 3))}`);
				}
			}

			if ((task.isPending() || task.hasFailed() || options.collapse === false) && (task.hasFailed() || options.showSubtasks !== false) && task.subtasks.length > 0) {
				output = output.concat(renderHelper(task.subtasks, options, level + 1));
			}
		}
	}

	return output.join('\n');
};

const render = (tasks, options) => {
	logUpdate(renderHelper(tasks, options));
};

class UpdateRenderer {
	constructor(tasks, options) {
		this._tasks = tasks;
		this._options = Object.assign(
			{
				showSubtasks: true,
				collapse: true,
				clearOutput: false,
			},
			options,
		);
	}

	render() {
		if (this._id) {
			// Do not render if we are already rendering
			return;
		}

		this._id = setInterval(() => {
			render(this._tasks, this._options);
		}, 100);
	}

	end(err) {
		if (this._id) {
			clearInterval(this._id);
			this._id = undefined;
		}

		render(this._tasks, this._options);

		if (this._options.clearOutput && err === undefined) {
			logUpdate.clear();
		} else {
			logUpdate.done();
		}
	}
}

module.exports = UpdateRenderer;
