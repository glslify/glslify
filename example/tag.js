var glx = require('../')
console.log(glx`
  #pragma glslify: noise = require('glsl-noise/simplex/3d')

  precision mediump float;
  varying vec3 vpos;
  void main () {
    gl_FragColor = vec4(noise(vpos*25.0),1);
  }
`)
