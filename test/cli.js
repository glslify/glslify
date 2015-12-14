const exec    = require('child_process').exec
const spawn   = require('child_process').spawn
const quote   = require('shell-quote').quote
const test    = require('tape')
const path    = require('path')
const fs      = require('fs')
const bl      = require('bl')
const glslify = require.resolve('../bin')

test('cli: globe.frag', function(t) {
  exec('node '+quote([ glslify,
    path.join(__dirname, 'fixtures', 'globe.frag'),
    '-t', 'glslify-hex'
  ]), function(err, stdout, stderr) {
    if (err) return t.ifError(err)

    t.ok(stdout.indexOf('#define') !== -1, '#define preserved')
    t.ok(stdout.indexOf('gl_FrontFacing') !== -1, 'gl_FrontFacing preserved')
    t.ok(stdout.indexOf('#FFFFFF') === -1, '#FFFFFF transformed away with glslify-hex')

    t.end()
  })
})

test('cli: globe.vert', function(t) {
  exec('node '+quote([ glslify,
    path.join(__dirname, 'fixtures', 'globe.vert'),
    '-t', 'glslify-hex'
  ]), function(err, stdout, stderr) {
    if (err) return t.ifError(err)

    t.ok(stdout.indexOf('GLSL textureless classic 2D noise "cnoise"') !== -1, 'glsl-noise was included')
    t.ok(stdout.indexOf('#define PI') !== -1, 'glsl-fog was included')
    t.ok(stdout.indexOf('cnoise(') !== -1, 'cnoise was not renamed')
    t.ok(stdout.indexOf('backIn(') !== -1, 'backIn was not renamed')
    t.ok(stdout.indexOf('PI_') === -1, 'PI def was not renamed')
    t.ok(stdout.indexOf('#6ac9ff') === -1, '#6ac9ff was transformed way with glslify-hex')
    t.ok(stdout.indexOf('#8c9f96') === -1, '#8c9f96 was transformed way with glslify-hex')
    t.ok(stdout.indexOf('aCountryIndex') !== -1, 'aCountryIndex was not renamed')
    t.ok(stdout.indexOf('uCountryIndex') !== -1, 'uCountryIndex was not renamed')

    t.end()
  })
})

test.skip('cli: globe.vert (inline)', function(t) {
  var ps = spawn(glslify, [ '-t', 'glslify-hex' ])

  fs.createReadStream(path.join(__dirname, 'fixtures', 'globe.vert'))
    .pipe(ps.stdin)

  ps.stdout.pipe(bl(function(err, stdout1) {
    if (err) return t.ifError(err)

    stdout1 += ''

    exec(quote([ glslify,
      path.join(__dirname, 'fixtures', 'globe.vert'),
      '-t', 'glslify-hex'
    ]), function(err, stdout2) {
      if (err) return t.ifError(err)

      t.equal(stdout1.trim(), stdout2.trim())
      t.end()
    })
  }))
})
