#!/usr/bin/env node
global.Promise = require('bluebird')
Promise.longStackTraces()
const cursor = require('ansi')(process.stdout)
const arg = require('arg')
const readConcourseWebhooks = require('./generatorLibs/readConcourseWebhooks')
const generateTerraformConfigs = require('./generatorLibs/generateTerraformConfigs')
const generateAllFiles = require('./generatorLibs/generateAllFiles')

process.on('unhandledRejection', error => {
  console.error('unhandledRejection', error.message)
  process.exit(3)
})

async function main () {
  try {
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
      '--bitbucket-provider-version': String,
    })

    if( args['--clean'] ) {
      cursor.blue().write('Clean mode:').reset().write('Only removing files.')
      await generateAllFiles(args, {}, [])
      return
    }

    console.log('Reading Concourse files to retrieve webhook data...')
    const reposToPipelines = await readConcourseWebhooks(args['--concourse-root'])

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
    const terraformConfigs = await generateTerraformConfigs(args, myPipelines)

    console.log('Writing Terraform files...')
    await generateAllFiles(args, terraformConfigs.filesToWrite, terraformConfigs.importHelper)
  } catch ( err ) {
    cursor.red().write('Error!\n').reset()

    if( err instanceof Object ) {
      [ 'data', 'message', 'stack', 'status', 'statusText' ].forEach(key => {
        if( key in err ) {
          cursor.blue().write(`${key}: `).reset()
          console.error(err[key])
        }
      })
    }

    process.exit(1)
  }
}
main()
