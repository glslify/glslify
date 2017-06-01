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
var parseOptions = {
  ecmaVersion: 6,
  sourceType: 'module',
  allowReturnOutsideFunction: true,
  allowImportExportEverywhere: true,
  allowHashBang: true
}

module.exports = function (file, opts) {
  if (path.extname(file) == '.json') return through()
  if (!opts) opts = {}
  var posts = []
  var dir = path.dirname(file)
  var glvar = null, mdir = dir
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
    if (src.indexOf('glslify') === -1) {
      out.push(src)
      out.push(null)
      return
    }

    try { var fout = falafel(src, parseOptions, onnode) }
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
      } else if (node.type === 'Identifier' && node.name === 'require'
      && node.parent.type === 'CallExpression'
      && node.parent.arguments[0]
      && node.parent.arguments[0].type === 'Literal'
      && (/^glslify(?:\/index(?:\.js)?)?/.test(node.parent.arguments[0].value)
      || path.resolve(dir,node.parent.arguments[0].value) === __dirname
      || path.resolve(dir,node.parent.arguments[0].value) === glslfile0
      || path.resolve(dir,node.parent.arguments[0].value) === glslfile1)) {
        var p = node.parent.parent, pp = p.parent
        if (p.type === 'CallExpression' && pp.type === 'CallExpression') {
          // case: require('glslify')(...)
          pending++
          callexpr(p, done)
        } else if (p.type === 'VariableDeclarator') {
          // case: var glvar = require('glslify')
          glvar = p.id.name
        } else if (p.type === 'MemberExpression' && p.property.name === 'file'
        && pp.type === 'CallExpression') {
          // case: require('glslify').file(...)
          pending++
          rcallfile(pp, done)
        } else if (p.type === 'MemberExpression' && p.property.name === 'compile'
        && pp.type === 'CallExpression') {
          // case: require('glslify').compile(...)
          pending++
          rcallcompile(pp, done)
        } else if (p.type === 'TaggedTemplateExpression') {
          // case: require('glslify')`...`
          pending++
          tagexpr(p, done)
        }
      } else if (node.type === 'Identifier' && node.name === glvar
      && node.parent.type === 'CallExpression') {
        // case: glvar(...)
        pending++
        callexpr(node.parent, done)
      } else if (node.type === 'TaggedTemplateExpression'
      && node.tag.name === glvar) {
        // case: glvar`...`
        pending++
        tagexpr(node, done)
      } else if (node.type === 'Identifier' && node.name === glvar
      && node.parent.type === 'MemberExpression'
      && node.parent.property.name === 'file'
      && node.parent.parent.type === 'CallExpression'
      && node.parent.parent.arguments[0]) {
        pending++
        callfile(node.parent.parent, done)
      } else if (node.type === 'Identifier' && node.name === glvar
      && node.parent.type === 'MemberExpression'
      && node.parent.property.name === 'compile'
      && node.parent.parent.type === 'CallExpression'
      && node.parent.parent.arguments[0]) {
        pending++
        callcompile(node.parent.parent, done)
      }
    }
    function tagexpr (node, cb) {
      var q = node.quasi
      var shadersrc = q.quasis.map(function (s) {
        return s.value.raw + '__GLX_PLACEHOLDER__'
      }).join('')
      var d = createDeps({ cwd: mdir })
      d.inline(shadersrc, mdir, function (err, deps) {
        if (err) return d.emit('error', err)
        try { var bsrc = bundle(deps) }
        catch (err) { return d.emit('error', err) }
        node.update(node.tag.source() + '('
          + JSON.stringify(bsrc.split('__GLX_PLACEHOLDER__'))
          + [''].concat(q.expressions.map(function (e) {
            return e.source()
          })).join(',')
          + ')')
        cb()
      })
    }
    function callexpr (p, cb) {
      var marg = evaluate(p.arguments[0])
      var mopts = p.arguments[1] ? evaluate(p.arguments[1]) || {} : {}
      var d = createDeps(extend({ cwd: mdir }, mopts))
      if (/\n/.test(marg)) { // source string
        d.inline(marg, mdir, ondeps)
      } else gresolve(marg, { basedir: mdir }, function (err, res) {
        if (err) d.emit('error', err)
        else d.add(res, ondeps)
      })
      function ondeps (err, deps) {
        if (err) return d.emit('error', err)
        try { var bsrc = bundle(deps) }
        catch (err) { return d.emit('error', err) }
        p.update(p.callee.source()+'(['+JSON.stringify(bsrc)+'])')
        cb()
      }
    }
    function callcompile (p, cb) {
      var mfile = p.arguments[0].value
      var mopts = p.arguments[1] ? evaluate(p.arguments[1]) || {} : {}
      var d = createDeps({ cwd: mdir })
      d.inline(mfile, mdir, ondeps)
      function ondeps (err, deps) {
        if (err) return d.emit('error', err)
        try { var bsrc = bundle(deps) }
        catch (err) { return d.emit('error', err) }
        p.update(glvar + '([' + JSON.stringify(bsrc) + '])')
        cb()
      }
    }
    function callfile (p, cb) {
      var mfile = p.arguments[0].value
      var mopts = p.arguments[1] ? evaluate(p.arguments[1]) || {} : {}
      var d = createDeps({ cwd: mdir })
      gresolve(mfile, { basedir: mdir }, function (err, res) {
        if (err) return d.emit('error', err)
        d.add(res, ondeps)
      })
      function ondeps (err, deps) {
        if (err) return d.emit('error', err)
        try { var bsrc = bundle(deps) }
        catch (err) { return d.emit('error', err) }
        p.update(glvar + '([' + JSON.stringify(bsrc) + '])')
        cb()
      }
    }
    function rcallfile (p, cb) {
      var mfile = evaluate(p.arguments[0])
      var mopts = p.arguments[1] ? evaluate(p.arguments[1]) || {} : {}
      var d = createDeps({ cwd: mdir })
      gresolve(mfile, { basedir: mdir }, function (err, res) {
        if (err) return d.emit('error', err)
        d.add(res, ondeps)
      })
      function ondeps (err, deps) {
        if (err) return d.emit('error', err)
        try { var bsrc = bundle(deps) }
        catch (err) { return d.emit('error', err) }
        p.update(p.callee.object.source()+'(['+JSON.stringify(bsrc)+'])')
        cb()
      }
    }
    function rcallcompile (p, cb) {
      var marg = evaluate(p.arguments[0])
      var mopts = p.arguments[1] ? evaluate(p.arguments[1]) || {} : {}
      var d = createDeps({ cwd: mdir })
      d.inline(marg, mdir, ondeps)
      function ondeps (err, deps) {
        if (err) return d.emit('error', err)
        try { var bsrc = bundle(deps) }
        catch (err) { return d.emit('error', err) }
        p.update(p.callee.object.source()+'(['+JSON.stringify(bsrc)+'])')
        cb()
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
    depper.on('error', function (err) { d.emit('error', err) })
    depper.on('file', function (file) { d.emit('file', file) })
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
