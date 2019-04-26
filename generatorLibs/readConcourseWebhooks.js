#!/usr/bin/env node
const path = require('path')
const fs = require('fs').promises
const getTokens = require('./getTokens')
const readTemplatedYaml = require('./readTemplatedYaml')

const isDir = async fileLoc => {
  const lstat = await fs.lstat(fileLoc)
  return lstat.isDirectory()
}

const exists = async fileLoc => {
  try {
    await fs.access(fileLoc)
    return true
  } catch ( e ) {
    if( e.code === 'ENOENT' ) {
      return false
    }
    throw e
  }
}

module.exports = async root => {
  try {
    const commonVarsPath = path.resolve(root, 'common-vars.yml')
    const credentialsPath = path.resolve(root, 'credentials.yml')

    // Use the Autotree pattern to figure out which team, pipeline, and variant
    // each file belongs to.
    const teamDir = path.resolve(root, 'teams')

    const allPipelines = []

    // For each team
    await Promise.map(fs.readdir(teamDir), x => path.join(teamDir, x)).filter(isDir).each(teamName => {
      const teamPath = path.resolve(teamDir, teamName)

      // For each pipeline
      return Promise.map(fs.readdir(teamPath), x => path.join(teamPath, x)).filter(isDir).each(async pipelinePath => {
        const pipelineName = (path.parse(pipelinePath)).name

        // Don't do anything if the pipeline is disabled
        if( await exists(path.join(pipelinePath, 'disabled')) ) {
          return
        }

        if( await exists(path.join(pipelinePath, 'variants')) ) {
          // variants folder exists, multiple pipelines for same repo
          const variantNames = await fs.readdir(path.join(pipelinePath, 'variants'))
          variantNames.forEach(variantName => allPipelines.push({
            teamName: (path.parse(teamName)).name,
            pipelineName: (path.parse(variantName)).name,
            filePaths: [
              path.join(pipelinePath, `${pipelineName}.yml`),
              commonVarsPath,
              path.join(pipelinePath, 'variants', variantName),
              credentialsPath,
            ],
          }))
          return
        }

        // single pipeline
        allPipelines.push({
          teamName: (path.parse(teamName)).name,
          pipelineName: (path.parse(pipelineName)).name,
          filePaths: [
            path.join(pipelinePath, `${pipelineName}.yml`),
            commonVarsPath,
            credentialsPath,
          ],
        })
      })
    })

    return Promise.reduce(allPipelines, async (acc, { pipelineName, teamName, filePaths }) => {
      // Read the list of files to template and return the finished data.
      const fileData = await readTemplatedYaml(filePaths)

      // Extract the webhook tokens from the fully templated file.
      // Also send an object that will be composited into every item returned.
      const tokens = getTokens(fileData, {
        pipelineName,
        teamName,
      })

      // Merge this information in to make a final listing of the tokens for each pipeline
      Object.keys(tokens).forEach(repoName => {
        if( !(repoName in acc) ) {
          acc[repoName] = []
        }
        acc[repoName] = acc[repoName].concat(tokens[repoName])
      })

      return acc
    }, {})
  } catch ( err ) {
    err.data = 'Encountered error while retrieving all webhooks'
    throw err
  }
}
