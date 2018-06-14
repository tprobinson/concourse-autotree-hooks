#!/usr/bin/env node
const Promise = require('bluebird') // eslint-disable-line no-unused-vars
const arg = require('arg')
const readConcourseWebhooks = require('./generatorLibs/readConcourseWebhooks')
const generateTerraformConfigs = require('./generatorLibs/generateTerraformConfigs')
const generateAllFiles = require('./generatorLibs/generateAllFiles')

// Promise.longStackTraces()

process.on('unhandledRejection', error => {
	console.error('unhandledRejection', error.message)
	process.exit(3)
})

// Parse args
const args = arg({
	// Types
	'--concourse-root': String,
	'--concourse-webhook-url': String,
	'--manage-repositories': Boolean,
	'--noop': Boolean,
	'--clean': Boolean,
	'--skip-cert-verification': Boolean,
	'--filter-repo-owner': String,
})

if( args['--clean'] ) {
	console.log('Only removing files.')
	generateAllFiles(args, {}, [])
		.catch(err => {
			console.error('Encountered error while writing out Terraform files:', err)
			process.exit(1)
		})
} else {
	console.log('Reading Concourse files to retrieve webhook data...')
	readConcourseWebhooks(args['--concourse-root'])
		.catch(err => {
			console.error('Encountered error while retrieving all webhooks:', err)
			process.exit(1)
		})
		.then(reposToPipelines => {
			// If we're filtering a particular owner, only allow repos starting with that.
			const myPipelines = Object.keys(reposToPipelines).reduce((acc, repoName) => {
				if( args['--filter-repo-owner'] ) {
					if( repoName.startsWith(args['--filter-repo-owner']) ) {
						acc[repoName] = reposToPipelines[repoName]
					}
				} else {
					acc[repoName] = reposToPipelines[repoName]
				}
				return acc
			}, {})

			console.log('Generating terraform configurations...')
			return generateTerraformConfigs(args, myPipelines)
		})
		.then(terraformConfigs => {
			console.log('Writing Terraform files...')
			return generateAllFiles(args, terraformConfigs.filesToWrite, terraformConfigs.importHelper)
		})
		.catch(err => {
			console.error('Encountered error while writing out Terraform files:', err)
			process.exit(1)
		})
}
