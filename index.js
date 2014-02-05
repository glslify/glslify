module.exports = transform

var glslify = require('glslify-stream')
  , deparser = require('glsl-deparser')
  , replace = require('replace-method')
  , concat = require('concat-stream')
  , evaluate = require('static-eval')
  , extract = require('glsl-extract')
  , through = require('through')
  , resolve = require('resolve')
  , path = require('path')

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
    var src = replace(Buffer.concat(accum).toString('utf8'))
      , loading = 0
      , map = {}
      , id = 0

    src.replace(['glslify'], function(node) {
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
  }
}
