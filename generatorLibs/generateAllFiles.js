#!/usr/bin/env node
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

module.exports = (args, filesToWrite, importHelper) =>
	fs.readdirAsync('.')
		.filter(fileName => fileName.endsWith('.tf') || fileName === 'importHelper.sh')
		.map(fileName => {
			if( args['--noop'] ) {
				console.log(`Would unlink ${fileName}`)
				return Promise.resolve()
			}
			return fs.unlinkAsync(fileName)
		})
		.then(() =>
			Promise.all(Object.keys(filesToWrite).map(fileName => {
				if( args['--noop'] ) {
					console.log(`Would write ${fileName}:\n${filesToWrite[fileName].toString()}\n\n`)
					return Promise.resolve()
				}
				return fs.writeFileAsync(fileName, filesToWrite[fileName].toString())
			}))
		)
		.then(() => {
			if( args['--noop'] ) {
				console.log(`Would write importHelper.sh:\n${importHelper.join('\n')}\n\n`)
				return Promise.resolve()
			}
			return fs.writeFileAsync('importHelper.sh', importHelper.join('\n'))
		})
