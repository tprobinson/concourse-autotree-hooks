#!/usr/bin/env node
const Promise = require('bluebird')
const arg = require('arg')
const readConcourseWebhooks = require('./generatorLibs/readConcourseWebhooks')
const generateTerraformConfigs = require('./generatorLibs/generateTerraformConfigs')
const generateAllFiles = require('./generatorLibs/generateAllFiles')

Promise.longStackTraces()

process.on('unhandledRejection', error => {
	// Will print "unhandledRejection err is not defined"
	console.error('unhandledRejection', error.message)
	process.exit(3)
})

// Parse args
const args = arg({
	// Types
	'--concourse-root': String,
	'--concourse-webhook-url': String,
	'--noop': Boolean,
})

console.log('Reading Concourse files to retrieve webhook data...')
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

		console.log('Generating terraform configurations...')
		return generateTerraformConfigs(myPipelines, args['--concourse-webhook-url'])
	})
	.then(terraformConfigs => {
		console.log('Writing Terraform files...')
		return generateAllFiles(args, terraformConfigs.filesToWrite, terraformConfigs.importHelper)
	})
	.catch(err => {
		console.error('Encountered error while writing out Terraform files:', err)
		process.exit(1)
	})
