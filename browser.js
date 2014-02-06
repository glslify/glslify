module.exports = noop

function noop() {
  throw new Error(
      'You should bundle your code ' +
      'using `glslify` as a transform.'
  )
}
