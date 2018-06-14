const Promise = require('bluebird')
const yaml = require('yaml-parser')
const fs = Promise.promisifyAll(require('fs'))

// Read in a file and replace values in order.
module.exports = files =>
	Promise.all(files.map(file => fs.readFileAsync(file)))
		.then(allFiles => {
			allFiles = allFiles.map(x => x.toString())
			let mainFile = allFiles.shift()
			const replacements = allFiles
				.map(x => yaml.safeLoad)
				.reduce((acc, x) => Object.assign(acc, x), {})

			Object.keys(replacements).forEach(key => {
				mainFile = mainFile.replace(`((${key}))`, replacements[key])
			})

			return Promise.resolve(yaml.safeLoad(mainFile))
		})
