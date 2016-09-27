var falafel = require('falafel')
var duplexify = require('duplexify')
var through = require('through2')
var concat = require('concat-stream')
var from = require('from2')
var gdeps = require('glslify-deps')
var gbundle = require('glslify-bundle')
var path = require('path')
var seval = require('static-eval')
var resolver = require('resolve')

var glslfile0 = path.join(__dirname,'index.js')
var glslfile1 = path.join(__dirname,'index')

module.exports = function (file, opts) {
  if (path.extname(file) == '.json') return through()
  if (!opts) opts = {}
  var dir = path.dirname(file)
  var glvar = null, tagname = null, mdir = dir
  var evars = {
    __dirname: dir,
    __filename: file,
    require: { resolve: resolver }
  }
  function evaluate (expr) {
    return seval(expr, evars)
  }

  var d = duplexify()
  var out = from(function () {})
  d.setReadable(out)
  d.setWritable(concat({ encoding: 'string' }, function (src) {
    var pending = 1
    try { var fout = falafel(src, { ecmaVersion: 6 }, onnode) }
    catch (err) { return d.emit('error', err) }
    done()
    function onnode (node) {
      if (node.type === 'Identifier' && node.name === 'require'
      && node.parent.type === 'CallExpression'
      && node.parent.arguments[0]
      && node.parent.arguments[0].type === 'Literal'
      && node.parent.arguments[0].value === 'path'
      && node.parent.parent.type === 'VariableDeclarator') {
        evars.path = path
      }
      if (node.type === 'Identifier' && node.name === 'require'
      && node.parent.type === 'CallExpression'
      && node.parent.arguments[0]
      && node.parent.arguments[0].type === 'Literal'
      && (/^glslify(?:\/index(?:\.js)?)?/.test(node.parent.arguments[0].value)
      || path.resolve(dir,node.parent.arguments[0].value) === __dirname
      || path.resolve(dir,node.parent.arguments[0].value) === glslfile0
      || path.resolve(dir,node.parent.arguments[0].value) === glslfile1)) {
        var p = node.parent.parent, pp = p.parent
        if (p.type === 'CallExpression'
        && pp.type === 'VariableDeclarator') {
          // case: var glx = require('glslify')(__dirname)
          tagname = pp.id.name
          var arg = p.arguments[0]
          if (arg && arg.type === 'Literal') mdir = arg.value
        } else if (node.parent.parent.type === 'VariableDeclarator') {
          // case: var glvar = require('glslify')
          glvar = node.parent.parent.id.name
        }
      }
      if (node.type === 'Identifier' && node.name === glvar
      && node.parent.type === 'CallExpression'
      && node.parent.parent.type === 'VariableDeclarator') {
        // case: var glx = glvar(__dirname)
        var p = node.parent, pp = p.parent
        tagname = pp.id.name
        var arg = p.arguments[0]
        if (arg && arg.type === 'Literal') {
          mdir = arg.value
        } else if (arg.type === 'ObjectExpression') {
          arg.properties.forEach(function (prop) {
            if (prop.key.name === 'basedir') {
              mdir = evaluate(prop.value) || mdir
            }
          })
        }
      }
      if (node.type === 'TaggedTemplateExpression' && node.tag.name === tagname) {
        pending++
        var q = node.quasi
        var shadersrc = q.quasis.map(function (s) {
          return s.value.raw + '__GLX_PLACEHOLDER__'
        }).join('')
        var d = gdeps({ cwd: mdir })
        d.inline(shadersrc, path.dirname(file), function (err, deps) {
          if (err) return d.emit('error', err)
          try { var bsrc = gbundle(deps) }
          catch (err) { return d.emit('error', err) }
          node.update(tagname + '('
            + JSON.stringify(bsrc.split('__GLX_PLACEHOLDER__'))
            + [''].concat(q.expressions.map(function (e) {
              return e.source()
            })).join(',')
            + ')')
          done()
        })
      }
    }
    function done () {
      if (--pending === 0) {
        out.push(fout.toString())
        out.push(null)
      }
    }
  }))
  return d
}
