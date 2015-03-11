var glslifyBundle = require('glslify-bundle')
var staticModule  = require('static-module')
var glslifyDeps   = require('glslify-deps')
var glslResolve   = require('glsl-resolve')
var through       = require('through2')
var nodeResolve   = require('resolve')
var path          = require('path')
var fs            = require('fs')

module.exports = transform

function transform(jsFilename) {
  if (path.extname(jsFilename) === '.json') return through()

  // static-module is responsible for replacing any
  // calls to glslify in your JavaScript with a string
  // of our choosing – in this case, our bundled glslify
  // shader source.
  var sm = staticModule({
    glslify: bundle
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

  function bundle(filename, opts) {
    opts = opts || {}

    var posts  = []
    var stream = through()
    var depper = glslifyDeps({
      cwd: path.dirname(jsFilename),
      readFile: readFile
    })

    // Extract and add our local transforms.
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

    if (opts.inline) {
      var override = filename
      filename = path.resolve(jsFilename)
    } else {
      filename = glslResolve.sync(filename, {
        basedir: path.dirname(jsFilename)
      })
    }

    // Builds a dependency tree starting from the
    // given `filename` using glslify-deps.
    depper.add(filename, function(err, tree) {
      if (err) return sm.emit('error', err)

      try {
        // Turn that dependency tree into a GLSL string,
        // stringified for use in our JavaScript.
        var source = glslifyBundle(tree)
      } catch(e) {
        return sm.emit('error', e)
      }

      // Finally, this applies our --post transforms
      next()
      function next() {
        var tr = posts.shift()
        if (!tr) return done()

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

      function done() {
        stream.push(JSON.stringify(source))
        stream.push(null)
      }
    })

    return stream

    // A custom readFile function, simply for the purpose
    // of making the "inline" option work properly. This isn't
    // included in glslify-deps because it complicates the code
    // there.
    function readFile(targetFilename, done) {
      if (override && targetFilename === filename) {
        return done(null, override)
      }

      fs.readFile(targetFilename, 'utf8', done)
    }
  }
}
