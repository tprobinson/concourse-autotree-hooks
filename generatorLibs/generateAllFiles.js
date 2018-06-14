#!/usr/bin/env node
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

// Never delete these files
const whitelistedFiles = [
]

// Always delete these files
const blacklistedFiles = [
	'importHelper.sh'
]

module.exports = (args, filesToWrite, importHelper) =>
	fs.readdirAsync('.')
		.filter(fileName =>
			// Find any files not in the whitelist, that end in .tf or are blacklisted.
			!whitelistedFiles.includes(fileName) && (
				fileName.endsWith('.tf') ||
				blacklistedFiles.includes(fileName)
			)
		)
		.map(fileName => {
			// Delete all filter-matched files.
			if( args['--noop'] ) {
				console.log(`Would delete ${fileName}`)
				return Promise.resolve()
			}
			return fs.unlinkAsync(fileName)
		})
		.then(() =>
			// For each file, write its contents.
			Promise.all(Object.keys(filesToWrite).map(fileName => {
				if( args['--noop'] ) {
					console.log(`Would write ${fileName}:\n${filesToWrite[fileName].toString()}\n\n`)
					return Promise.resolve()
				}
				return fs.writeFileAsync(fileName, filesToWrite[fileName].toString())
			}))
		)
		.then(() => {
			// Write out the importHelper if we need to.
			if( importHelper && importHelper.length > 0 ) {
				if( args['--noop'] ) {
					console.log(`Would write importHelper.sh:\n${importHelper.join('\n')}\n\n`)
					return Promise.resolve()
				}
				return fs.writeFileAsync('importHelper.sh', importHelper.join('\n'))
			}
		})
