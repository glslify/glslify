precision mediump float;

varying vec3  vCountryColor;
uniform float uCountryIndex;
uniform float uOpacity;

#define COLOR_BACKGROUND #FFFFFF

void main() {
  float backfaceFade = gl_FrontFacing ? 0.0 : 0.7;
  float scrollFade   = clamp(1.0 - uOpacity, 0.0, 0.9);

  vec3 color = vCountryColor;

  color = mix(color, COLOR_BACKGROUND, backfaceFade);
  color = mix(color, COLOR_BACKGROUND, scrollFade);

  gl_FragColor = vec4(color, 1.0);
}
