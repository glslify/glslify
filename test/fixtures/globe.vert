precision mediump float;

attribute vec3  aPosition;
attribute float aCountryIndex;

uniform float uCountryIndex;
uniform float uTime;
uniform mat4  uMVP;

varying vec3  vCountryColor;

#pragma glslify: noise  = require(glsl-noise/classic/2d)
#pragma glslify: backIn = require(glsl-easings/back-in)

#define COLOR_SELECTED #6ac9ff
#define COLOR_LAND #8c9f96
#define COLOR_GLOW #8c9f96 * 1.4

void main() {
  float selected = 1.0 - clamp(abs(aCountryIndex - uCountryIndex), 0.0, 1.0);
  vec3 position = aPosition;

  float glow;
  glow = (noise(vec2(aCountryIndex) * 85.12219238 + uTime * 0.35) + 1.0) * 0.5;
  glow = backIn(glow) * glow * glow;

  float shade = mix(0.95, 1.075, noise(vec2(aCountryIndex) * 85.12219238));

  vec3 color = COLOR_LAND;
  color = mix(color, COLOR_GLOW, glow);
  color = mix(color, COLOR_SELECTED, selected);
  color = color * shade;

  vCountryColor = color;

  gl_Position = uMVP * vec4(position, 1.0);
}
