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

    // Load the YAML, then convert it to JSON. This is ugly, but allows me to replace multi-line values much easier.
    mainFile = JSON.stringify(yaml.safeLoad(mainFile))

    // All other files are read and overlaid on top of each other,
    const replacements = allFiles
      .map(x => yaml.safeLoad(x))
      .reduce((acc, x) => Object.assign(acc, x), {})

    // then used to replace ((variable)) templates in the main file.
    Object.keys(replacements).forEach(key => {
      // Stringify the replacement, then strip quotes off of it before it's replaced.
      let finalReplacement = JSON.stringify(replacements[key])
      finalReplacement = finalReplacement.slice(1, finalReplacement.length - 1)

      mainFile = mainFile.replace(new RegExp(`\\s*\\(\\(\\s*${key}\\s*\\)\\)\\s*`, 'g'), finalReplacement)
    })

    const someParensExist = mainFile.includes('((') || mainFile.includes('))')
    if( someParensExist ) {
      console.warn('Templating was successful, but double-parens are still detected. Check the files below for missing variables:')
      console.warn(files)
      console.warn('This warning may be a false positive if there are stray double-parens in a file. (such as a bash `let` statement)')
    }

    // Parse the file once more
    mainFile = JSON.parse(mainFile)

    return mainFile
  } catch ( err ) {
    err.data = 'Encountered error while reading templated YAML'
    throw err
  }
}
