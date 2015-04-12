const test    = require('tape')
const path    = require('path')
const glslify = require('../')
const fs      = require('fs')

test('files array', function(t) {
  var src = path.join(__dirname, 'fixtures', 'globe.vert')

  glslify.bundle(src, {}, function(err, glsl, files) {
    if (err) return t.fail(err.message || err)

    t.equal(files.length, 3, '3 files reported')
    t.equal(files[0], src, 'first file is the entry file')

    files.sort()
    t.equal(files[0], require.resolve('glsl-easings/back-in.glsl'), 'first dep')
    t.equal(files[1], require.resolve('glsl-noise/classic/2d.glsl'), 'second dep')

    t.end()
  })
})

test('files array (inline)', function(t) {
  var src = path.join(__dirname, 'fixtures', 'globe.vert')

  glslify.bundle(fs.readFileSync(src, 'utf8'), {
    basedir: path.dirname(src),
    inline: true
  }, function(err, glsl, files) {
    if (err) return t.fail(err.message || err)

    files.sort()
    t.equal(files.length, 2, '2 files reported')
    t.equal(files[0], require.resolve('glsl-easings/back-in.glsl'), 'first dep')
    t.equal(files[1], require.resolve('glsl-noise/classic/2d.glsl'), 'second dep')

    t.end()
  })
})
