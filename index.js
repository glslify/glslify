var glslifyBundle = require('glslify-bundle')
var staticModule  = require('static-module')
var glslifyDeps   = require('glslify-deps')
var glslResolve   = require('glsl-resolve')
var through       = require('through2')
var nodeResolve   = require('resolve')
var extend        = require('xtend')
var path          = require('path')
var fs            = require('fs')

module.exports = transform
module.exports.bundle = bundle

function transform(jsFilename, browserifyOpts) {
  if (path.extname(jsFilename) === '.json') return through()

  var streamHasErrored = false

  // static-module is responsible for replacing any
  // calls to glslify in your JavaScript with a string
  // of our choosing – in this case, our bundled glslify
  // shader source.
  var sm = staticModule({
    glslify: streamBundle
  }, {
    vars: {
      __dirname: path.dirname(jsFilename),
      __filename: jsFilename,
      require: {
        resolve: nodeResolve
      }
    }
  })

  return sm

  function streamBundle(filename, opts) {
    var stream = through()

    if (typeof filename === 'object') {
      if (streamHasErrored) return

      streamHasErrored = true
      setTimeout(function () {
        return sm.emit('error', new Error(
          'You supplied an object as glslify\'s first argument. As of ' +
          'glslify@2.0.0, glslify expects a filename or shader: ' +
          'see https://github.com/stackgl/glslify#migrating-from-glslify1-to-glslify2 for more information'
        ))
      })

      return
    }

    opts = extend({
      basedir: path.dirname(jsFilename)
    }, browserifyOpts || {}, opts || {})

    var depper = bundle(filename, opts, function(err, source) {
      if (err) return sm.emit('error', err)

      stream.push(JSON.stringify(source))
      stream.push(null)
    })

    //notify watchify that we have a new dependency
    depper.on('file', function(file) {
      sm.emit('file', file)
    })

    return stream
  }
}

function bundle(filename, opts, done) {
  opts = opts || {}

  var defaultBase = opts.inline
    ? process.cwd()
    : path.dirname(filename)

  var base   = path.resolve(opts.basedir || defaultBase)
  var posts  = []
  var files  = []
  var depper = glslifyDeps({
    cwd: base
  })

  // Extract and add our local transforms.
  var transforms = opts.transform || []

  depper.on('file', function(file) {
    files.push(file)
  })

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

  if (opts.inline) {
    depper.inline(filename
      , base
      , addedDep)
  } else {
    filename = glslResolve.sync(filename, {
      basedir: base
    })

    depper.add(filename, addedDep)
  }

  return depper

  // Builds a dependency tree starting from the
  // given `filename` using glslify-deps.
  function addedDep(err, tree) {
    if (err) return done(err)

    try {
      // Turn that dependency tree into a GLSL string,
      // stringified for use in our JavaScript.
      var source = glslifyBundle(tree)
    } catch(e) {
      return done(e)
    }

    // Finally, this applies our --post transforms
    next()
    function next() {
      var tr = posts.shift()
      if (!tr) return postDone()

      var target = nodeResolve.sync(tr.name, {
        basedir: path.dirname(filename)
      })

      var transform = require(target)

      transform(null, source, {
        post: true
      }, function(err, data) {
        if (err) throw err
        if (data) source = data
        next()
      })
    }

    function postDone() {
      done(null, source, opts.inline
        ? files.slice(1)
        : files
      )
    }
  }
}
