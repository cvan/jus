var embedVideo = require('embed-video')
var marky = require('marky-markdown')
var nunjucks = require('nunjucks')

var strip = function (str) {
  return (str || '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
}

var split = function (str, separator) {
  return str.split(separator).filter(function (x) {
    return !!x
  })
}

module.exports.transformEnv = function (env) {
  env.addFilter('split', split)

  env.addFilter('stripAndSplit', function (str, separator) {
    return split(strip(str), separator)
  })

  env.addFilter('md', function (str) {
    return new nunjucks.runtime.SafeString(
      marky(str).html()
    )
  })

  env.addFilter('embedvideo', function (url) {
    return new nunjucks.runtime.SafeString(
      embedVideo(url)
    )
  })

  return env
}
