const Promise = require('bluebird')
const yaml = require('yaml-parser')
const fs = Promise.promisifyAll(require('fs'))

module.exports = files =>
	Promise.all(files.map(file => fs.readFileAsync(file)))
		.then(allFiles => {
			allFiles = allFiles.map(x => x.toString())

			// With a list of files as input, use the first file as a base.
			let mainFile = allFiles.shift()

			// All other files are read and overlaid on top of each other,
			const replacements = allFiles
				.map(x => yaml.safeLoad)
				.reduce((acc, x) => Object.assign(acc, x), {})

			// then used to replace ((variable)) templates in the main file.
			Object.keys(replacements).forEach(key => {
				mainFile = mainFile.replace(`((${key}))`, replacements[key])
			})

			// The main file is then returned as a data object.
			return Promise.resolve(yaml.safeLoad(mainFile))
		})
