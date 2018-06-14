const Promise = require('bluebird')
const fetch = require('node-fetch')
const path = require('path')
const url = require('url')
const fs = Promise.promisifyAll(require('fs'))
const ini = require('ini')

const bbUrl = 'https://api.bitbucket.org'

let credentials = null

const cachedInformation = {}

const safeFetch = (...args) => {
	return fetch(...args).then(x => {
		if( !x.ok ) {
			console.trace(x)
			throw new Error('Request came back not ok!')
		}
		return x.json()
	})
}

module.exports = (repoFullName) => {
	if( repoFullName in cachedInformation ) {
		console.log(`Using cached information about ${repoFullName}...`)
		return Promise.resolve(cachedInformation[repoFullName])
	}

	console.log(`Retrieving Bitbucket information about ${repoFullName}...`)
	let promise = Promise.resolve()

	// Read creds once.
	if( credentials === null ) {
		promise = fs.readFileAsync(path.resolve(__dirname, '..', 'terraform.tfvars'))
			.then(tfvars => {
				const creds = ini.parse(tfvars.toString())
				const authstring = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
				credentials = `Basic ${authstring}`
			})
	}

	// Get Bitbucket repository information
	promise = promise.then(() =>
		safeFetch(
			new url.URL(`/2.0/repositories/${repoFullName}`, bbUrl).toString(),
			{headers: {Authorization: credentials}}
		)
	)
		.then(data => {
			cachedInformation[repoFullName] = data
			return Promise.resolve(data)
		})

	return promise
}
