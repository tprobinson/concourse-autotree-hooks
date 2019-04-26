const yaml = require('yaml-parser')
const fs = require('fs').promises

module.exports = async files => {
  try {
    const allFiles = await Promise.map(files, async file => {
      const buf = await fs.readFile(file)
      return buf.toString()
    })

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

    return yaml.safeLoad(mainFile)
  } catch ( err ) {
    err.data = 'Encountered error while reading templated YAML'
    throw err
  }
}
