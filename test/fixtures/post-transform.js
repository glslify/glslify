module.exports = function(filename, src, opts, done) {
  if (src.indexOf('// include 1') === -1) throw new Error('test/fixtures/post-transform.glsl has not been included')
  if (src.indexOf('// include 2') === -1) throw new Error('test/fixtures/node_modules/glsl-fake-post/index.glsl has not been included')

  src = src.toUpperCase()

  return done(null, src)
}
