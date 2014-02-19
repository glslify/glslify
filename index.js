module.exports = transform

var glslify = require('glslify-stream')
  , deparser = require('glsl-deparser')
  , replace = require('replace-method')
  , concat = require('concat-stream')
  , evaluate = require('static-eval')
  , extract = require('glsl-extract')
  , first = require('first-match')
  , through = require('through')
  , resolve = require('resolve')
  , esprima = require('esprima')
  , sleuth = require('sleuth')
  , path = require('path')

var usageRegex = /['"]glslify['"]/g

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
    if(!usageRegex.test(buf)) return bail(buf)

    var ast = esprima.parse(buf)
      , name = glslifyname(ast)
      , src = replace(ast)
      , loading = 0
      , map = {}
      , id = 0

    // bail early if glslify isn't required at all
    if(!name) return bail(buf)

    src.replace([name], function(node) {
      var fragment
        , current
        , vertex
        , config

      current = ++id

      if(!node.arguments.length) {
        return
      }

      config = evaluate(node.arguments[0], {
          __filename: filename
        , __dirname: path.dirname(filename)
      })

      if(typeof config !== 'object') {
        return
      }

      ++loading
      glslify(config.vertex)
        .pipe(deparser())
        .pipe(concat(onvertex))

      glslify(config.fragment)
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
                  {type: 'Literal', value: 'glslify/adapter.js'}
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
  var keys = Object.keys(required)

  return first(keys, function(key) {
    return required[key] === 'glslify'
  })
}
