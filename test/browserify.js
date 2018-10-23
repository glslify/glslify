const glslBundle = require('glslify-bundle')
const glslDeps   = require('glslify-deps')
const browserify = require('browserify')
const through    = require('through2')
const from       = require('from2')
const test       = require('tape')
const glslify    = require('../transform')
const vm         = require('vm')
const bl         = require('bl')
const fs         = require('fs')
const path       = require('path')

test('browserify transform: do not fail with async/await syntax', function (t) {
  const glslStream = glslify('/test/file/stream.js', { basedir: __dirname });
  glslStream.on('error', err => console.error(err))
  from([
    'const glslify = require("glslify");\n',
    'console.log(glslify("void main () {}"));\n',
    'const foo = async () => {};'
  ]).pipe(glslStream)
    .pipe(bl(bundled))

  function bundled (err, src) {
    if (err) return t.fail(err)
    var expected = [
      'const glslify = require("glslify");',
      'console.log(glslify(["#define GLSLIFY 1\\nvoid main () {}"]));',
      'const foo = async () => {};'
    ].join('\n').trim()
    t.equal(src.toString().trim(), expected)
    t.end()
  }
})

test('browserify transform: do not fail with rest spread', function (t) {
  const glslStream = glslify('/test/file/stream.js', { basedir: __dirname });
  glslStream.on('error', err => console.error(err))
  from([
    'const glslify = require("glslify");\n',
    'console.log(glslify("void main () {}"));\n',
    'const foo = { ...{ bar: 2 } };'
  ]).pipe(glslStream)
    .pipe(bl(bundled))

  function bundled (err, src) {
    if (err) return t.fail(err)
    var expected = [
      'const glslify = require("glslify");',
      'console.log(glslify(["#define GLSLIFY 1\\nvoid main () {}"]));',
      'const foo = { ...{ bar: 2 } };'
    ].join('\n').trim()
    t.equal(src.toString().trim(), expected)
    t.end()
  }
})

test('browserify transform: simple example', function(t) {
  browserify({ basedir: __dirname }).add(from([
    'var glslify = require("../")\n',
    'console.log(glslify.file("./fixtures/simplest.glsl"))'
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
  browserify({ basedir: __dirname }).add(from([
    'var glslify = require("../")\n',
    'console.log(glslify.file("./fixtures/hex.glsl", { transform: ["glslify-hex"] }))'
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

      t.ok(String(bundle).indexOf(glslString.split(/\n|\\n/)[0]) !== -1, 'Contains equivalent output to glslify')
      t.ok(tree.length, 'Contains at least one file')
      t.end()
    })
  }
})

test('browserify transform: applying a global transform', function(t) {
  browserify({ basedir: __dirname }).add(from([
    'var glslify = require("../")\n',
    'console.log(glslify.file("./fixtures/hex-module.glsl", { transform: [["glslify-hex", { global: true }]] }))'
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

      t.ok(String(bundle).indexOf(glslString.split(/\n|\\n/)[0]) !== -1, 'Contains equivalent output to glslify')
      t.ok(tree.length, 'Contains at least one file')
      t.end()
    })
  }
})

test('browserify transform: applying a post transform', function(t) {
  browserify({ basedir: __dirname }).add(from([
    'var glslify = require("../")\n',
    'console.log(glslify.file("./fixtures/post-transform.glsl", { transform: [["./check-contents.js", { post: true, contents: ["// include 1", "// include 2"] }]] }))'
  ]))
    .transform(glslify)
    .bundle()
    .pipe(bl(bundled))

  function bundled(err, bundle) {
    if (err) return t.ifError(err)

    t.ok(String(bundle).indexOf('#define CHECK_CONTENTS 1') !== -1, "post transform ran successfully")
    t.end()
  }
})

test('browserify transform: inline', function(t) {
  browserify({ basedir: __dirname }).add(from([
    'var glslify = require("../")\n',

    'console.log(glslify.compile("',
      'precision mediump float;\\n',

      '#pragma glslify: simplest = require(./fixtures/simple-export)\\n',

      'void main() {',
        'simplest();',
      '}',
    '"))'
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

test('browserify transform: ensure things work with one-line shader string', function (t) {
  from([
    'const glslify = require("glslify");\n',

    'console.log(glslify("void main () {}"))'
  ]).pipe(glslify('/test/file/stream.js', { basedir: __dirname }))
    .pipe(bl(bundled))

  function bundled (err, src) {
    if (err) return t.fail(err)
    var expected = [
      'const glslify = require("glslify");',
      'console.log(glslify(["#define GLSLIFY 1\\nvoid main () {}"]))'
    ].join('\n').trim()
    t.equal(src.toString().trim(), expected)
    t.end()
  }
})

test('browserify transform: allow import statements in same file', function (t) {
  from([
    'import glslify2 from "glslify";\n',
    'const glslify = require("glslify");\n',
    'console.log(glslify("void main () {}"))'
  ]).pipe(glslify('/test/file/stream.js', { basedir: __dirname }))
    .pipe(bl(bundled))

  function bundled (err, src) {
    if (err) return t.fail(err)
    var expected = [
      'import glslify2 from "glslify";',
      'const glslify = require("glslify");',
      'console.log(glslify(["#define GLSLIFY 1\\nvoid main () {}"]))'
    ].join('\n').trim()
    t.equal(src.toString().trim(), expected)
    t.end()
  }
})

test('browserify transform: direct module require', function(t) {
  browserify({ basedir: __dirname }).add(from([
    'var glslify = require("../")\n',

    'console.log(glslify.file("glsl-fixture"))'
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

test('filename passed to post transform when loaded from a file', function(t) {
  t.plan(6)

  var bopts = {
    basedir: __dirname,
    transform: [
      [glslify, {
        post: [require.resolve("./fixtures/replace-with-file")]
      }]
    ]
  }

  browserify(bopts).add(from([
    'var glx = require("../")\n',
    'console.log(glx.file("./fixtures/globe.frag"), "glslify")'
  ])).bundle(check(t.equal))

  browserify(bopts).add(from([
    'var glx = require("../")\n',
    'console.log(glx("./fixtures/globe.frag"), "glslify")'
  ])).bundle(check(t.equal))

  browserify(bopts).add(from([
    'var glx = require("../")\n',
    'console.log(glx`void main () {}`, "glslify")'
  ])).bundle(check(t.notEqual))

  function check (assert) {
    return function (err, bundle) {
      t.error(err)
      Function(['console'],bundle.toString('utf8'))({
        log: function (file) {
          assert(file, require.resolve("./fixtures/globe.frag"), "filename is included")
        }
      })
    }
  }
})

test('post transforms with post option are included', function(t) {
  t.plan(1)

  browserify({
    basedir: __dirname,
    transform: [
      [glslify, {
        transform: [
          [require.resolve("./fixtures/check-contents"), {
            post: true,
            contents: [
              '#define CHECK_1',
              '#define CHECK_2'
            ]
          }],
        ]
      }]
    ]
  }).add(from([
    'var glx = require("../")\n',
    'console.log(glx.file("./fixtures/post-transform-check.glsl"), "glslify")'
  ])).bundle(function (err, bundle) {
    t.error(err)
  })
})

test('case 1: require expression with template string', function(t) {
  t.plan(3)
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'console.log(require("../")(`\n',
    '#pragma glslify: noise = require("glsl-noise/simplex/3d")\n',
    'precision mediump float;\n',
    'varying vec3 pos;\n',
    'void main () {\n',
    '  gl_FragColor = vec4(noise(vpos*25.0),1);\n',
    '}',
    '`))'
  ])).bundle(function (err, bundle) {
    t.error(err)
    t.ok(bundle.length > 1500, 'long enough bundle')
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/taylorInvSqrt/.test(msg), 'contains parts from the file')
      }
    })
  })
})
test('case 2: variable with file string', function(t) {
  t.plan(2)
  var lines = fs.readFileSync(path.join(__dirname,'fixtures/globe.frag'),'utf8')
    .split('\n')
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'var glx = require("../")\n',
    'console.log(glx("./fixtures/globe.frag"), "glslify")'
  ])).bundle(function (err, bundle) {
    t.error(err)
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/vCountryColor/.test(msg), 'contains parts from the file')
      }
    })
  })
})
test('case 3: require expression with file string', function(t) {
  t.plan(2)
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'console.log(require("../")("./fixtures/globe.frag"), "glslify")\n'
  ])).bundle(function (err, bundle) {
    t.error(err)
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/vCountryColor/.test(msg), 'contains parts from the file')
      }
    })
  })
})
test('case 4: require expression with file method', function(t) {
  t.plan(2)
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'console.log(require("../").file("./fixtures/globe.frag"), "glslify")\n'
  ])).bundle(function (err, bundle) {
    t.error(err)
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/vCountryColor/.test(msg), 'contains parts from the file')
      }
    })
  })
})
test('case 5: require expression with compile method', function(t) {
  t.plan(2)
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'console.log(require("../").compile(`\n',
    '  #pragma glslify: noise = require("glsl-noise/simplex/3d")\n',
    '  precision mediump float;\n',
    '  varying vec3 vpos;\n',
    '  void main () {\n',
    '    gl_FragColor = vec4(noise(vpos*25.0),1);\n',
    '  }\n',
    '`))'
  ])).bundle(function (err, bundle) {
    t.error(err)
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/taylorInvSqrt/.test(msg), 'contains parts from the file')
      }
    })
  })
})
test('case 6: tagged template string var', function(t) {
  t.plan(2)
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'var glx = require("../")\n',
    'console.log(glx`\n',
    '  #pragma glslify: noise = require("glsl-noise/simplex/3d")\n',
    '  precision mediump float;\n',
    '  varying vec3 vpos;\n',
    '  void main () {\n',
    '    gl_FragColor = vec4(noise(vpos*25.0),1);\n',
    '  }\n',
    '`)'
  ])).bundle(function (err, bundle) {
    t.error(err)
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/taylorInvSqrt/.test(msg), 'contains parts from the file')
      }
    })
  })
})
test('case 7: tagged template string require expr', function(t) {
  t.plan(2)
  browserify({ basedir: __dirname, transform: glslify }).add(from([
    'console.log(require("../")`\n',
    '  #pragma glslify: noise = require("glsl-noise/simplex/3d")\n',
    '  precision mediump float;\n',
    '  varying vec3 vpos;\n',
    '  void main () {\n',
    '    gl_FragColor = vec4(noise(vpos*25.0),1);\n',
    '  }\n',
    '`)'
  ])).bundle(function (err, bundle) {
    t.error(err)
    Function(['console'],bundle.toString('utf8'))({
      log: function (msg) {
        t.ok(/taylorInvSqrt/.test(msg), 'contains parts from the file')
      }
    })
  })
})
