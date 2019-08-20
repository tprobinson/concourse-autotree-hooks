#!/usr/bin/env node
const GenesisDevice = require('genesis-device')
const url = require('url')
const getBitbucketRepoInfo = require('./getBitbucketRepoInfo')
const fs = require('fs').promises

module.exports = async (args, reposToPipelines) => {
  try {
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

    const bitbucketProviderConfiguration = {
      username: '${var.username}', // eslint-disable-line no-template-curly-in-string
      password: '${var.password}', // eslint-disable-line no-template-curly-in-string
    }

    if( args['--bitbucket-provider-version'] ) {
      bitbucketProviderConfiguration.version = args['--bitbucket-provider-version']
    }

    providerGenesis.addProvider('bitbucket', bitbucketProviderConfiguration)

    // Read in the backend.json file and use it to create the backend.
    const backendData = JSON.parse(await fs.readFile('backend.json'))
    Object.keys(backendData).forEach(backendName => {
      providerGenesis.addBackend(backendName, backendData[backendName])
    })

    filesToWrite['provider.tf'] = providerGenesis

    // Create each repo's file
    await Promise.each(Object.keys(reposToPipelines), async repoFullName => {
      // Create a new file for this repo
      const genesis = new GenesisDevice()

      const [repoOwner, repoName] = repoFullName.split('/')
      const tfRepositoryResourceName = repoName.replace(/-/g, '_')

      // We need to retrieve information about the repository if we're managing it
      if( args['--manage-repositories'] ) {
        const repoInfo = await getBitbucketRepoInfo(repoFullName)

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
    })

    return { filesToWrite, importHelper }
  } catch ( err ) {
    err.data = 'Encountered error while generating terraform configs'
    throw err
  }
}
