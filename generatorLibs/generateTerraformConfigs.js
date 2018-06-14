#!/usr/bin/env node
// const Promise = require('bluebird')
const GenesisDevice = require('genesis-device')
const url = require('url')

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
	Object.keys(reposToPipelines).forEach(repoFullName => {
		reposToPipelines[repoFullName].forEach(hookObj => {
			// Separate the files by repository
			const genesis = new GenesisDevice()

			const [repoOwner, repoName] = repoFullName.split('/')
			const tfResourceName = repoName.replace(/-/g, '_')

			genesis.addResource('bitbucket_repository', tfResourceName, {
				owner: repoOwner,
				name: repoName,
				// project_key:
				// is_private: true,
				fork_policy: 'no_public_forks',
			})

			const fullConcourseHookUrl = new url.URL('/' + [
				'api', 'v1', 'teams', hookObj.teamName,
				'pipelines', hookObj.pipelineName,
				'resources', hookObj.resourceName,
				'check',
				`webhook?webhook_token=${hookObj.token}`,
			].join('/'), concourseUrl).toString()

			genesis.addResource('bitbucket_hook', tfResourceName, {
				owner: `\${bitbucket_repository.${tfResourceName}.owner}`,
				repository: `\${bitbucket_repository.${tfResourceName}.name}`,
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

			filesToWrite[`${tfResourceName}.tf`] = genesis
			importHelper.push(`terraform import bitbucket_repository.${tfResourceName} ${repoName}`)
		})
	})

	return {filesToWrite, importHelper}
}
