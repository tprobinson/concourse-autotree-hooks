#!/usr/bin/env node
const Promise = require('bluebird')
const arg = require('arg')
const readConcourseWebhooks = require('./generatorLibs/readConcourseWebhooks')
const generateTerraformConfigs = require('./generatorLibs/generateTerraformConfigs')
const generateAllFiles = require('./generatorLibs/generateAllFiles')

// Parse args
const args = arg({
	// Types
	'--concourse-root': String,
	'--concourse-webhook-url': String,
	'--noop': Boolean,
})

readConcourseWebhooks(args['--concourse-root'])
	.catch(err => {
		console.error('Encountered error while retrieving all webhooks:', err)
		process.exit(1)
	})
	.then(reposToPipelines => {
		// Filter out any pipelines that aren't in the funkodev space
		// since we're not managing anything but that space.
		const myPipelines = Object.keys(reposToPipelines).reduce((acc, repoName) => {
			if( repoName.startsWith('funkodev') ) {
				acc[repoName] = reposToPipelines[repoName]
			}
			return acc
		}, {})

		const {filesToWrite, importHelper} = generateTerraformConfigs(myPipelines, args['--concourse-webhook-url'])

		return generateAllFiles(args, filesToWrite, importHelper)
	})
	.catch(err => {
		console.error('Encountered error while writing out Terraform files:', err)
		process.exit(1)
	})
