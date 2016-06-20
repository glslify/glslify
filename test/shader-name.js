const name     = require('glsl-shader-name')
const tokenize = require('glsl-tokenizer')
const test     = require('tape')
const path     = require('path')
const glslify  = require('../')

const fixture = path.join(__dirname, 'fixtures', 'shader-name.glsl')

test('shader-name', function(t) {
  glslify.bundle(fixture, {}, function(err, src) {
    if (err) return t.fail(err.message || err)

    t.equal(name(src), fixture, 'name is absolute path')
    t.end()
  })
})
