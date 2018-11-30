#!/usr/bin/env node
const Promise = require('bluebird')
const GenesisDevice = require('genesis-device')
const url = require('url')
const getBitbucketRepoInfo = require('./getBitbucketRepoInfo')
const fs = Promise.promisifyAll(require('fs'))

module.exports = (args, reposToPipelines) => {
	const importHelper = []
	const filesToWrite = {}

	// Create a main provider file
	const createProviderFile = () => {
		const providerGenesis = new GenesisDevice()
		providerGenesis.addVariable('username', {
			description: 'Username for Bitbucket',
		})

		providerGenesis.addVariable('password', {
			description: 'Password for Bitbucket',
		})

		providerGenesis.addProvider('bitbucket', {
			username: '${var.username}', // eslint-disable-line no-template-curly-in-string
			password: '${var.password}', // eslint-disable-line no-template-curly-in-string
			version: '999.999.999',
		})

		// Read in the provider.json file and use it to create the provider.
		return fs.readFileAsync('provider.json')
			.then(providerText => {
				const providerData = JSON.parse(providerText)
				Object.keys(providerData).forEach(providerName => {
					providerGenesis.addBackend(providerName, providerData[providerName])
				})

				filesToWrite['provider.tf'] = providerGenesis
			})
	}

	// Create each repo's file
	const createRepositoryFiles = () => {
		return Promise.each(Object.keys(reposToPipelines), repoFullName => {
			let promise = Promise.resolve()

			// We need to retrieve information about the repository if we're managing it
			if( args['--manage-repositories'] ) {
				promise = getBitbucketRepoInfo(repoFullName)
			}

			promise = promise.then(repoInfo => {
				// console.trace(repoInfo)

				// Create a new file for this repo
				const genesis = new GenesisDevice()

				const [repoOwner, repoName] = repoFullName.split('/')
				const tfRepositoryResourceName = repoName.replace(/-/g, '_')

				if( args['--manage-repositories'] ) {
					// Pick out some metadata from our retrieved information
					const repoMetadata = {}
					const cherryPickMeta = key => {
						if( key in repoInfo && repoInfo[key] ) {
							repoMetadata[key] = repoInfo[key]
						}
					}
					cherryPickMeta('fork_policy')
					cherryPickMeta('language')
					cherryPickMeta('is_private')
					cherryPickMeta('description')
					cherryPickMeta('slug')

					if( 'project' in repoInfo && 'key' in repoInfo.project ) {
						repoMetadata.project_key = repoInfo.project.key
					}

					genesis.addResource('bitbucket_repository', tfRepositoryResourceName, Object.assign({
						owner: repoOwner,
						name: repoInfo.name,
					}, repoMetadata))

					// Write out an import string-- deduplicated
					const importString = `terraform import bitbucket_repository.${tfRepositoryResourceName} ${repoFullName}`
					if( importHelper.indexOf(importString) === -1 ) {
						importHelper.push(importString)
					}
				}

				reposToPipelines[repoFullName].forEach(hookObj => {
					const fullConcourseHookUrl = url.format({
						host: args['--concourse-webhook-url'],
						pathname: '/' + [
							'api', 'v1', 'teams', hookObj.teamName,
							'pipelines', hookObj.pipelineName,
							'resources', hookObj.resourceName,
							'check', 'webhook',
						].join('/'),
						query: {
							webhook_token: hookObj.token,
						}
					})

					const tfHookResourceName = `${hookObj.teamName}_${hookObj.pipelineName}_${hookObj.resourceName}`.replace(/-/g, '_')
					const resourceConfig = {
						owner: repoOwner,
						repository: `${repoName}`,
						url: fullConcourseHookUrl,

						description: [
							'Concourse',
							hookObj.teamName,
							hookObj.pipelineName,
							hookObj.resourceName,
						].join(' - '),

						events: [
							'repo:push',
						],
					}

					if( args['--skip-cert-verification'] ) {
						resourceConfig.skip_cert_verification = true
					}

					genesis.addResource('bitbucket_hook', tfHookResourceName, resourceConfig)
				})

				filesToWrite[`${tfRepositoryResourceName}.tf`] = genesis

				return Promise.resolve()
			})

			return promise
		})
	}

	// Execute both of these functions, then return the variables they feed into.
	return Promise.all([createProviderFile(), createRepositoryFiles()])
		.then(() => Promise.resolve({filesToWrite, importHelper}))
}
