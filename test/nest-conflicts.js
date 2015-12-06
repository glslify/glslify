const test    = require('tape')
const path    = require('path')
const glslify = require('../')

const fixture = path.join(__dirname, 'fixtures', 'nest-conflict-entry.glsl')

test('nested conflicts', function(t) {
  glslify.bundle(fixture, {}, function(err, src) {
    if (err) return t.fail(err.message || err)

    var once  = /d(?:\_\d+)/g.test(src)
    var twice = /d(?:\_\d+){2}/g.test(src)

    t.ok(once, 'nested value was renamed')
    t.ok(!twice, 'nested value was not renamed twice')
    t.end()
  })
})
