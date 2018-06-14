#!/usr/bin/env node
const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const getTokens = require('./getTokens')
const readTemplatedYaml = require('./readTemplatedYaml')

const justFileName = fullFilename => fullFilename.split('.')[0]

const reposToPipelines = {}

const combineIntoObject = newTokens => {
	// Merge this information into reposToPipelines
	Object.keys(newTokens).forEach(repoName => {
		if( !(repoName in reposToPipelines) ) {
			reposToPipelines[repoName] = []
		}
		reposToPipelines[repoName] = reposToPipelines[repoName].concat(newTokens[repoName])
	})
}

module.exports = root => {
	// Use the Autotree pattern to figure out which team, pipeline, and variant
	// each file belongs to.
	const teamDir = path.resolve(root, 'teams')

	return fs.readdirAsync(teamDir).map(teamName =>
		fs.readdirAsync(path.resolve(teamDir, teamName)).map(pipelineName => {
			// This function is defined ahead of time so we can support
			// standalone or variant pipelines
			const getDataAndUseIt = (inputName, filePaths) => {
				return readTemplatedYaml(filePaths).then(fileData => {
					// Extract the webhook tokens from the fully templated file.
					// Also send an object that will be composited into every item returned.
					combineIntoObject(getTokens(fileData, {
						pipelineName: inputName,
						teamName,
					}))
					return Promise.resolve()
				})
			}

			// Don't do anything if the pipeline is disabled
			if( fs.existsSync(path.resolve(teamDir, teamName, pipelineName, 'disabled')) ) {
				return Promise.resolve()
			}

			if( fs.existsSync(path.resolve(teamDir, teamName, pipelineName, 'variants')) ) {
				// variants folder exists, multiple pipelines for same repo
				return fs.readdirAsync(path.resolve(teamDir, teamName, pipelineName, 'variants'))
					.map(variantName => getDataAndUseIt(justFileName(variantName), [
						path.resolve(teamDir, teamName, pipelineName, `${pipelineName}.yml`),
						path.resolve(root, 'common-vars.yml'),
						path.resolve(teamDir, teamName, pipelineName, 'variants', variantName),
						path.resolve(root, 'credentials.yml'),
					]))
			}

			// single pipeline
			return getDataAndUseIt(pipelineName, [
				path.resolve(teamDir, teamName, pipelineName, `${pipelineName}.yml`),
				path.resolve(root, 'common-vars.yml'),
				path.resolve(root, 'credentials.yml'),
			])
		})
	)
		.then(() => Promise.resolve(reposToPipelines))
}
