module.exports = transform

var glslify = require('glslify-stream')
  , deparser = require('glsl-deparser')
  , replace = require('replace-method')
  , concat = require('concat-stream')
  , evaluate = require('static-eval')
  , extract = require('glsl-extract')
  , emit = require('emit-function')
  , through = require('through')
  , resolve = require('resolve')
  , esprima = require('esprima')
  , sleuth = require('sleuth')
  , from = require('new-from')
  , path = require('path')

var usageRegex = /['"]glslify['"]/

function transform(filename) {
  var stream = through(write, end)
    , accum = []
    , len = 0

  return stream

  function write(buf) {
    accum[accum.length] = buf
    len += buf.length
  }

  function end() {
    var buf = Buffer.concat(accum).toString('utf8')

    // break out early if it doesn't look like
    // we're going to find any shaders here,
    // parsing and transforming the AST is expensive!
    if(!usageRegex.test(buf)) {
      return bail(buf)
    }

    var ast = esprima.parse(buf)
      , name = glslifyname(ast)
      , src = replace(ast)
      , loading = 0
      , map = {}
      , id = 0

    // bail early if glslify isn't required at all
    if(!name) {
      return bail(buf)
    }

    src.replace([name], function(node) {
      var fragment
        , current
        , vertex
        , config

      current = ++id

      if(!node.arguments.length) {
        return
      }

      var cwd = path.dirname(filename)
      config = evaluate(node.arguments[0], {
          __filename: filename
        , __dirname: cwd
      })

      if(typeof config !== 'object') {
        return
      }

      var sourceOnly = !!config.sourceOnly
      var frag = config.fragment || config.frag
      var vert = config.vertex || config.vert
      var inline = !!config.inline

      var streamOpts = {
          input: inline
        , transform: config.transform
      }

      ++loading
      var vert_stream = glslify(
        inline ? filename : path.resolve(cwd, vert)
      , streamOpts)

      var frag_stream = glslify(
        inline ? filename : path.resolve(cwd, frag)
      , streamOpts)

      if(inline) {
        from([vert]).pipe(vert_stream)
        from([frag]).pipe(frag_stream)
      }

      vert_stream
        .on('file', emit(stream, 'file'))
        .on('error', emit(stream, 'error'))
        .pipe(deparser())
        .pipe(concat(onvertex))

      frag_stream
        .on('file', emit(stream, 'file'))
        .on('error', emit(stream, 'error'))
        .pipe(deparser())
        .pipe(concat(onfragment))

      return {
          type: 'CallExpression'
        , callee: {
              type: 'CallExpression'
            , callee: {
                  type: 'Identifier'
                , name: 'require'
              }
            , arguments: [
                  {type: 'Literal', value: sourceOnly ? 'glslify/simple-adapter.js' : 'glslify/adapter.js'}
              ]
          }
        , arguments: [
              {type: 'Identifier', name: '__glslify_' + current + '_vert'}
            , {type: 'Identifier', name: '__glslify_' + current + '_frag'}
            , {type: 'Identifier', name: '__glslify_' + current + '_unis'}
            , {type: 'Identifier', name: '__glslify_' + current + '_attrs'}
          ]
      }

      function onvertex(data) {
        vertex = data
        vertex && fragment && done()
      }

      function onfragment(data) {
        fragment = data
        vertex && fragment && done()
      }

      function done() {
        extract(vertex + '\n' + fragment)(function(err, info) {
          if(err) {
            return stream.emit('error', err)
          }

          --loading

          map[current] = [vertex, fragment, info.uniforms, info.attributes]

          if(!loading) {
            finish()
          }
        })
      }
    })

    if(!loading) {
      finish()
    }

    function finish() {
      var code = src.code()
        , unmap

      unmap = {vert: 0, frag: 1, unis: 2, attrs: 3}

      code = code.replace(/__glslify_(\d+)_(vert|frag|unis|attrs)/g, function(all, num, type) {
        return JSON.stringify(map[num][unmap[type]])
      })

      stream.queue(code)
      stream.queue(null)
    }

    function bail(code) {
      stream.queue(code)
      stream.queue(null)
    }
  }
}

function glslifyname(ast) {
  var required = sleuth(ast)
  var name

  Object.keys(required).some(function(key) {
    return name = (required[key] === 'glslify' ? key : null)
  })

  return name
}
