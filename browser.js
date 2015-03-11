module.exports = function() {
  throw new Error(
      "It appears that you're using glslify in browserify without "
    + "its transform applied. Make sure that you've set up glslify as a source transform: "
    + "https://github.com/substack/node-browserify#browserifytransform"
  )
}
