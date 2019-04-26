const fetch = require('node-fetch')
const path = require('path')
const url = require('url')
const fs = require('fs').promises
const ini = require('ini')

const bbUrl = 'https://api.bitbucket.org'

let credentials = null

const cachedInformation = {}

const safeFetch = async (...args) => {
  const response = await fetch(...args)
  if( !response.ok ) {
    const err = new Error('Request came back not ok!')
    err.status = response.status
    err.statusText = response.statusText
    throw err
  }

  return response.json()
}

module.exports = async (repoFullName) => {
  try {
    if( repoFullName in cachedInformation ) {
      console.log(`Using cached information about ${repoFullName}...`)
      return cachedInformation[repoFullName]
    }

    console.log(`Retrieving Bitbucket information about ${repoFullName}...`)

    // Read creds once.
    if( credentials === null ) {
      const tfvars = await fs.readFile(path.resolve(__dirname, '..', 'terraform.tfvars'))
      const creds = ini.parse(tfvars.toString())
      const authstring = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
      credentials = `Basic ${authstring}`
    }

    // Get Bitbucket repository information
    const data = await safeFetch(
      new url.URL(`/2.0/repositories/${repoFullName}`, bbUrl).toString(),
      { headers: { Authorization: credentials } }
    )

    cachedInformation[repoFullName] = data

    return data
  } catch ( err ) {
    err.data = 'Encountered error while getting Bitbucket repository information'
    throw err
  }
}
