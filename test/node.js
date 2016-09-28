const test = require('tape')
const glx  = require('../')

var supportsTTS = true
try { Function('``') }
catch (err) { supportsTTS = false }

test('node string', function(t) {
  var output = glx([
    '  #pragma glslify: noise = require("glsl-noise/simplex/3d")',
    '  precision mediump float;',
    '  varying vec3 vpos;',
    '  void main () {',
    '    gl_FragColor = vec4(noise(vpos*25.0),1);',
    '  }',
  ].join('\n'))
  t.ok(/taylorInvSqrt/.test(output), 'contains parts of the file')
  t.end()
})

test('node simulated tagged template string', function(t) {
  var output = glx([''
    +'  #pragma glslify: noise = require("glsl-noise/simplex/3d")\n'
    +'  precision mediump float;\n'
    +'  varying vec3 vpos;\n'
    +'  void main () {\n'
    +'    gl_FragColor = vec4(noise(vpos*','),1);\n'
    +'  }\n',
  ], '25.0')
  t.ok(/taylorInvSqrt/.test(output), 'contains parts of the file')
  t.ok(/vpos\*25\.0\),1/.test(output), 'interpolated var')
  t.end()
})

if (!supportsTTS) console.error('skipping real tagged template string test')
if (supportsTTS) test('node tagged template string', function(t) {
  var output = Function(['glx'],'return glx`\n'
    +'  #pragma glslify: noise = require("glsl-noise/simplex/3d")\n'
    +'  precision mediump float;\n'
    +'  varying vec3 vpos;\n'
    +'  void main () {\n'
    +'    gl_FragColor = vec4(noise(vpos*${"25.0"}),1);\n'
    +'  }\n'
    + '`'
  )(glx)
  t.ok(/taylorInvSqrt/.test(output), 'contains parts of the file')
  t.ok(/vpos\*25\.0\),1/.test(output), 'interpolated var')
  t.end()
})
