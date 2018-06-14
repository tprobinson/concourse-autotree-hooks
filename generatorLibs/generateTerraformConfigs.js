#!/usr/bin/env node
const Promise = require('bluebird')
const GenesisDevice = require('genesis-device')
const url = require('url')
const getBitbucketRepoInfo = require('./getBitbucketRepoInfo')

module.exports = (reposToPipelines, concourseUrl) => {
	const importHelper = []
	const filesToWrite = {}

	// Create a main provider file
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

	providerGenesis.addBackend('s3', {
		bucket: 'funko-terraform-state',
		dynamodb_table: 'funko-terraform-state-locking',
		acl: 'private',
		key: 'terraform/bitbucket.tfstate',
		region: 'us-west-2',
		encrypt: true,
	})

	filesToWrite['provider.tf'] = providerGenesis

	// Create each repo's file
	return Promise.each(Object.keys(reposToPipelines), repoFullName =>

		// First, grab all information about this repository
		getBitbucketRepoInfo(repoFullName).then(repoInfo => {
			// console.trace(repoInfo)

			// Create a new file for this repo
			const genesis = new GenesisDevice()

			const [repoOwner, repoName] = repoFullName.split('/')
			const tfRepositoryResourceName = repoName.replace(/-/g, '_')

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

			reposToPipelines[repoFullName].forEach(hookObj => {
				const fullConcourseHookUrl = new url.URL('/' + [
					'api', 'v1', 'teams', hookObj.teamName,
					'pipelines', hookObj.pipelineName,
					'resources', hookObj.resourceName,
					'check',
					`webhook?webhook_token=${hookObj.token}`,
				].join('/'), concourseUrl).toString()

				const tfHookResourceName = `${hookObj.pipelineName}_${hookObj.resourceName}`.replace(/-/g, '_')

				genesis.addResource('bitbucket_hook', tfHookResourceName, {
					owner: `\${bitbucket_repository.${tfRepositoryResourceName}.owner}`,
					repository: `${repoName}`,
					url: fullConcourseHookUrl,

					description: [
						'Concourse',
						hookObj.teamName,
						hookObj.pipelineName,
						hookObj.resourceName,
					].join(' - '),

					skip_cert_verification: true,

					events: [
						'repo:push',
					],
				})
			})

			// Write out an import string-- deduplicated
			const importString = `terraform import bitbucket_repository.${tfRepositoryResourceName} ${repoFullName}`
			if( importHelper.indexOf(importString) === -1 ) {
				importHelper.push(importString)
			}

			filesToWrite[`${tfRepositoryResourceName}.tf`] = genesis

			return Promise.resolve()
		})
	)
		.then(() => Promise.resolve({filesToWrite, importHelper}))
}
