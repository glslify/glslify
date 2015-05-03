process.chdir(__dirname)

const glslBundle = require('glslify-bundle')
const glslDeps   = require('glslify-deps')
const browserify = require('browserify')
const from       = require('from2')
const test       = require('tape')
const glslify    = require('../')
const vm         = require('vm')
const bl         = require('bl')
const fs         = require('fs')

test('browserify transform: simple example', function(t) {
  browserify().add(from([
    'var glslify = require("glslify")\n',
    'console.log(glslify("./fixtures/simplest.glsl"))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    var file = require.resolve('./fixtures/simplest.glsl')
    var src  = fs.readFileSync(file, 'utf8')

    glslDeps().add(file, function(err, tree) {
      if (err) return t.ifError(err)

      var glslString = JSON.stringify(glslBundle(tree))

      t.ok(String(bundle).indexOf(glslString) !== -1, 'Contains equivalent output to glslify')
      t.ok(tree.length, 'Contains at least one file')
      t.end()
    })
  }
})

test('browserify transform: applying a local transform', function(t) {
  browserify().add(from([
    'var glslify = require("glslify")\n',
    'console.log(glslify("./fixtures/hex.glsl", { transform: ["glslify-hex"] }))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    var file = require.resolve('./fixtures/hex.glsl')
    var src  = fs.readFileSync(file, 'utf8')

    glslDeps().transform('glslify-hex').add(file, function(err, tree) {
      if (err) return t.ifError(err)

      var glslString = JSON.stringify(glslBundle(tree))

      t.ok(String(bundle).indexOf(glslString) !== -1, 'Contains equivalent output to glslify')
      t.ok(tree.length, 'Contains at least one file')
      t.end()
    })
  }
})

test('browserify transform: applying a global transform', function(t) {
  browserify().add(from([
    'var glslify = require("glslify")\n',
    'console.log(glslify("./fixtures/hex-module.glsl", { transform: [["glslify-hex", { global: true }]] }))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    var file = require.resolve('./fixtures/hex-module.glsl')
    var src  = fs.readFileSync(file, 'utf8')

    glslDeps().transform('glslify-hex', {
      global: true
    }).add(file, function(err, tree) {
      if (err) return t.ifError(err)

      var glslString = JSON.stringify(glslBundle(tree))

      t.ok(String(bundle).indexOf(glslString) !== -1, 'Contains equivalent output to glslify')
      t.ok(tree.length, 'Contains at least one file')
      t.end()
    })
  }
})

test('browserify transform: applying a post transform', function(t) {
  browserify().add(from([
    'var glslify = require("glslify")\n',
    'console.log(glslify("./fixtures/post-transform.glsl", { transform: [["./post-transform.js", { post: true }]] }))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    var post = require('./fixtures/post-transform.js')
    var file = require.resolve('./fixtures/post-transform.glsl')
    var src  = fs.readFileSync(file, 'utf8')

    glslDeps().transform(post, {
      post: true
    }).add(file, function(err, tree) {
      if (err) return t.ifError(err)

      post(null, glslBundle(tree), {
        post: true
      }, function(err, data) {
        var glslString = JSON.stringify(data)

        t.ok(String(bundle).indexOf(glslString) !== -1, 'Contains equivalent output to glslify')
        t.ok(tree.length, 'Contains at least one file')
        t.end()
      })
    })
  }
})

test('browserify transform: inline', function(t) {
  browserify().add(from([
    'var glslify = require("glslify")\n',

    'console.log(glslify("',
      'precision mediump float;\\n',

      '#pragma glslify: simplest = require(./fixtures/simple-export)\\n',

      'void main() {',
        'simplest();',
      '}',
    '", { inline: true }))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    t.plan(2)

    vm.runInNewContext(bundle, {
      console: {
        log: function(source) {
          t.ok(typeof source === 'string', 'collected string')
          t.ok(source.indexOf('gl_FragColor') !== -1, 'includes gl_FragColor')
        }
      }
    }, function(err) {
      t.ifError(err, 'executed without errors')
    })
  }
})

test('browserify transform: direct module require', function(t) {
  browserify().add(from([
    'var glslify = require("glslify")\n',

    'console.log(glslify("glsl-fixture"))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    t.plan(2)

    vm.runInNewContext(bundle, {
      console: {
        log: function(source) {
          t.ok(typeof source == 'string', 'collected string')
          t.ok(source.indexOf('HELLO(WORLD)') !== -1, 'includes HELLO(WORLD)')
        }
      }
    }, function(err) {
      t.ifError(err, 'executed without errors')
    })
  }
})
