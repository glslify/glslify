var test = require('tape')
var h = test.getHarness()
test.onFinish(function (code) {
  var code = h._exitCode
  console.log('EXIT', code)
  process.exit(code)
})

require('./browserify')
require('./cli')
require('./node')
