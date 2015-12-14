const test    = require('tape')
const path    = require('path')
const uniq    = require('uniq')
const glslify = require('../')

const fixture = path.join(__dirname, 'fixtures', 'nest-conflict-entry.glsl')

test('nested conflicts', function(t) {
  glslify.bundle(fixture, {}, function(err, src) {
    if (err) return t.fail(err.message || err)

    var once  = /d(?:\_\d+)/g.test(src)
    var twice = /d(?:\_\d+){2}/g.test(src)
    var names = uniq(src.match(/d(?:\_\d+)/g))

    t.ok(once, 'nested value was renamed')
    t.ok(!twice, 'nested value was not renamed twice')
    t.equal(names.length, 2, '2 distinct d_* variables')

    t.end()
  })
})
