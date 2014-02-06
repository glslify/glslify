module.exports = programify

var shader = require('gl-shader-core')

function programify(vertex, fragment, uniforms, attributes) {
  return function(gl) {
    return shader(gl, vertex, fragment, uniforms, attributes)
  }
}
