var falafel = require('falafel')
var duplexify = require('duplexify')
var through = require('through2')
var concat = require('concat-stream')
var from = require('from2')
var gdeps = require('glslify-deps')
var gbundle = require('glslify-bundle')
var path = require('path')
var seval = require('static-eval')
var resolve = require('resolve')
var gresolve = require('glsl-resolve')
var extend = require('xtend')

var glslfile0 = path.join(__dirname,'index.js')
var glslfile1 = path.join(__dirname,'index')

module.exports = function (file, opts) {
  if (path.extname(file) == '.json') return through()
  if (!opts) opts = {}
  var posts = []
  var dir = path.dirname(file)
  var glvar = null, tagname = null, mdir = dir
  var evars = {
    __dirname: dir,
    __filename: file,
    require: { resolve: resolve }
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
        var d = createDeps(extend({ cwd: mdir }, mopts))
        d.inline(shadersrc, mdir, function (err, deps) {
          if (err) return d.emit('error', err)
          try { var bsrc = bundle(deps) }
          catch (err) { return d.emit('error', err) }
          node.update(tagname + '('
            + JSON.stringify(bsrc.split('__GLX_PLACEHOLDER__'))
            + [''].concat(q.expressions.map(function (e) {
              return e.source()
            })).join(',')
            + ')')
          done()
        })
      } else if (node.type === 'Identifier' && node.name === tagname
      && node.parent.type === 'MemberExpression'
      && node.parent.property.name === 'file'
      && node.parent.parent.type === 'CallExpression'
      && node.parent.parent.arguments[0]) {
        pending++
        var mfile = node.parent.parent.arguments[0].value
        var mopts = node.parent.parent.arguments[1]
          && evaluate(node.parent.parent.arguments[1])
        var ondeps = function (err, deps) {
          if (err) return d.emit('error', err)
          try { var bsrc = bundle(deps) }
          catch (err) { return d.emit('error', err) }
          node.parent.parent.update(tagname + '([' + JSON.stringify(bsrc) + '])')
          done()
        }
        var d = createDeps({ cwd: mdir })
        if (/^[.\/]/.test(mfile)) {
          d.add(mfile, ondeps)
        } else {
          gresolve(mfile, { basedir: mdir }, function (err, res) {
            if (err) return d.emit('error', err)
            d.add(res, ondeps)
          })
        }
      } else if (node.type === 'Identifier' && node.name === tagname
      && node.parent.type === 'MemberExpression'
      && node.parent.property.name === 'compile'
      && node.parent.parent.type === 'CallExpression'
      && node.parent.parent.arguments[0]) {
        pending++
        var msrc = node.parent.parent.arguments[0].value
        var mopts = node.parent.parent.arguments[1]
          && evaluate(node.parent.parent.arguments[1])
        var d = createDeps({ cwd: mdir })
        d.inline(msrc, mdir, function (err, deps) {
          if (err) return d.emit('error', err)
          try { var bsrc = bundle(deps) }
          catch (err) { return d.emit('error', err) }
          node.parent.parent.update(tagname + '([' + JSON.stringify(bsrc) + '])')
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

  function createDeps (opts) {
    var depper = gdeps(opts)
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
    var source = gbundle(deps)
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
