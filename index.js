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

    var stream = through()
    var depper = glslifyDeps({
      readFile: readFile
    })

    // Extract and add our local transforms.
    var transforms = opts.transform || []

    transforms = Array.isArray(transforms) ? transforms : [transforms]
    transforms.forEach(function(transform) {
      depper.transform(transform)
    })

    if (opts.inline) {
      var override = filename
      filename = path.resolve(jsFilename)
    } else {
      filename = glslResolve.sync(filename, {
        basedir: path.dirname(filename)
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
        source = JSON.stringify(source)
      } catch(e) {
        return sm.emit('error', err)
      }

      stream.push(source)
      stream.push(null)
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
