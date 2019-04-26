#!/usr/bin/env node
const fs = require('fs').promises

// Never delete these files
const whitelistedFiles = [
]

// Always delete these files
const blacklistedFiles = [
  'importHelper.sh'
]

module.exports = async (args, filesToWrite, importHelper) => {
  try {
    // Clean out all previously generated files.
    const fileNames = await fs.readdir('.')
    await Promise.map(fileNames.filter(fileName =>
      // Find any files not in the whitelist, that end in .tf or are blacklisted.
      !whitelistedFiles.includes(fileName) && (
        fileName.endsWith('.tf') ||
        blacklistedFiles.includes(fileName)
      )
    ), fileName => {
      // Delete all filter-matched files.
      if( args['--noop'] ) {
        console.log(`Would delete ${fileName}`)
        return
      }
      return fs.unlink(fileName)
    })

    // For each file, write its contents.
    await Promise.map(Object.keys(filesToWrite), fileName => {
      if( args['--noop'] ) {
        console.log(`Would write ${fileName}:\n${filesToWrite[fileName].toString()}\n\n`)
        return
      }
      return fs.writeFile(fileName, filesToWrite[fileName].toString())
    })

    // Write out the importHelper if we need to.
    if( importHelper && importHelper.length > 0 ) {
      if( args['--noop'] ) {
        console.log(`Would write importHelper.sh:\n${importHelper.join('\n')}\n\n`)
        return
      }
      await fs.writeFile('importHelper.sh', importHelper.join('\n'))
    }
  } catch ( err ) {
    err.data = 'Encountered error while writing out Terraform files'
    throw err
  }
}
