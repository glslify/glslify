var glslifyBundle = require('glslify-bundle')
var glslifyDeps   = require('glslify-deps/sync')
var glslResolve   = require('glsl-resolve')
var nodeResolve   = require('resolve')
var path          = require('path')
var extend        = require('xtend')

module.exports = function(opts) {
  if (typeof opts === 'string') opts = { basedir: opts }
  if (!opts) opts = {}

  var posts = []
  var gl = function(strings) {
    if (typeof strings === 'string') strings = [strings]
    var exprs = [].slice.call(arguments, 1)
    var parts = []
    for (var i = 0; i < strings.length-1; i++) {
      parts.push(strings[i], exprs[i] || '')
    }
    parts.push(strings[i])
    return gl.compile(parts.join(''))
  }
  gl.compile = function(src, xopts) {
    if (!xopts) xopts = {}
    var depper = gdeps(extend(opts, xopts))
    var base = xopts.basedir || opts.basedir || process.cwd()
    var deps = depper.inline(src, base)
    return bundle(deps)
  }
  gl.file = function(file, xopts) {
    var depper = gdeps(extend(opts, xopts))
    var deps = depper.add(file)
    return bundle(deps)
  }
  return gl

  function gdeps (opts) {
    var base = opts.basedir || process.cwd()
    var depper = glslifyDeps({ cwd: base })
    var transforms = opts.transform || []
    transforms = Array.isArray(transforms) ? transforms : [transforms]
    transforms.forEach(function(transform) {
      transform = Array.isArray(transform) ? transform : [transform]
      var name = transform[0]
      var opts = transform[1] || {}
      if (opts.post) {
        posts.push({ name: name, opts: opts })
      } else {
        depper.transform(name, opts)
      }
    })
    return depper
  }
  function bundle (deps) {
    var source = glslifyBundle(deps)
    posts.forEach(function (tr) {
      var target = nodeResolve.sync(tr.name, {
        basedir: base
      })
      var transform = require(target)
      var src = transform(null, source, { post: true })
      if (src) source = src
    })
    return source
  }
}
