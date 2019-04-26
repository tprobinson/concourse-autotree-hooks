module.exports = function (obj, compositeData = {}) {
  const tokens = {}
  if( 'resources' in obj && Array.isArray(obj.resources) ) {
    obj.resources.forEach(resource => {
      // Grab all Git resources with webhook_token defined,
      if( resource.type !== 'git' ) { return }
      if( 'webhook_token' in resource && resource.webhook_token ) {
        // Extract the repo name
        const repoName = resource.source.uri.split(':')[1].split('.')[0]
        if( !(repoName in tokens) ) {
          tokens[repoName] = []
        }

        // compile them into an array of hashes
        tokens[repoName].push(Object.assign({
          token: resource.webhook_token,
          resourceName: resource.name,
          uri: resource.source.uri,
        }, compositeData))
      }
    })
  }

  return tokens
}
