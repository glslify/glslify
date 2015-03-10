# glslify

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

A node.js-style module system for GLSL!

This module contains glslify's command-line interface (CLI) and
[browserify](http://browserify.org/) transform. It forms one of the core
components of the [stack.gl](http://stack.gl/) ecosystem, allowing you to
install GLSL modules from [npm](http://npmjs.com) and use them in your
shaders. This makes it trivial to piece together different effects and
techniques from the community, including but certainly not limited to
[fog](https://github.com/hughsk/glsl-fog),
[noise](https://github.com/hughsk/glsl-noise),
[film grain](https://github.com/mattdesl/glsl-film-grain),
[raymarching helpers](https://github.com/stackgl/glsl-smooth-min),
[easing functions](https://github.com/stackgl/glsl-easings) and
[lighting models](https://github.com/stackgl/glsl-specular-cook-torrance).

A full list can be found on the [stack.gl packages list](http://stack.gl/packages)
under the "Shader Components" category.

Because glslify just outputs a single shader file as a string, it's easy to use
it with any WebGL framework of your choosing,
provided they accept custom shaders. Integration is planned for
[three.js](http://threejs.org/), [webpack](http://webpack.github.io/) and
[pex](http://vorg.github.io/pex/), with more on the way!
[Open an issue](https://github.com/stackgl/glslify/issues/new) here if you'd like to
discuss integrating glslify with your platform of choice.

## Installation

[![NPM](https://nodei.co/npm/glslify.png)](https://nodei.co/npm/glslify/)

To install the command-line interface, install glslify globally like
so:

``` bash
npm install -g glslify
```

To install glslify for use as a browserify transform, you should
install it locally instead:

``` bash
npm install glslify
```

## Getting Started

### CLI

The CLI can take a file as its first argument, and output to a file
using the `-o` flag:

``` bash
glslify index.glsl -o output.glsl
```

It can also read input from stdin and output to stdout:

``` bash
cat index.glsl | glslify > output.glsl
```

### Browserify Transform

If using browserify from the command-line, simply pass glslify
in as a transform using the `-t`/`--transform` flag:

``` bash
browserify -t glslify index.js -o bundle.js
```

Alternatively, you may include glslify as a `browserify.transform`
in your `package.json` file:

``` json
{
  "name": "my-app",
  "dependencies": {
    "glslify": "^2.0.0"
  },
  "browserify": {
    "transform": ["glslify"]
  }
}
```

When writing your app, you should be able to require and call
glslify like so:

``` javascript
// index.js
var glslify = require('glslify')

var src = glslify(__dirname + '/shader.glsl')

console.log(src)
```

Your glslify calls will be replaced with bundled GLSL strings
at build time automatically for you!

``` javascript
// index.js
var src = "#define GLSLIFY 1\n\nprecision mediump float; ..."

console.log(src)
```

## Usage

### Installing a GLSL Module

Much like plain JavaScript modules, GLSL modules are stored on npm.
The main difference is that GLSL modules contain an `index.glsl` file
instead of an `index.js`. Generally, these modules start with `glsl-`
in their name.

To install [glsl-noise](https://github.com/hughsk/glsl-noise) in
your current directory:

``` bash
npm install glsl-noise
```

This will download glsl-noise and any of its dependencies, placing
them in a `node_modules` directory for glslify to use.

### Importing a GLSL Module

You can import a module using the following `#pragma` syntax:

``` glsl
#pragma glslify: noise = require(glsl-noise/simplex/2d)

void main() {
  float brightness = noise(gl_FragCoord.xy);

  gl_FragColor = vec4(vec3(brightness), 1.);
}
```

Shader dependencies are resolved using the same algorithm
as node, so the above will load `./node_modules/simplex/2d.glsl`
from the shader's directory.

The above example would result in the following output:

``` glsl
#define GLSLIFY 1

vec3 a_x_mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 a_x_mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 a_x_permute(vec3 x) {
  return a_x_mod289(((x * 34.0) + 1.0) * x);
}
float a_x_snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = a_x_mod289(i);
  vec3 p = a_x_permute(a_x_permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
void main() {
  float brightness = a_x_snoise(gl_FragCoord.xy);
  gl_FragColor = vec4(vec3(brightness), 1.);
}
```

### Exporting a GLSL Module

You can export a token from a module using the `glslify: export`
pragma, like so:

``` glsl
float myFunction(vec3 normal) {
  return dot(vec3(0, 1, 0), normal);
}

#pragma glslify: export(myFunction)
```

This means that when you import this module file elsewhere, you'll
get `myFunction` in return:

``` glsl
#pragma glslify: topDot = require(./my-function.glsl)

topDot(vec3(0, 1, 0)); // 1
```

If you check the output shader source, you'll notice that variables
have been renamed to avoid conflicts between multiple shader files.

You're not limited to exporting functions either: you should be able
to export any GLSL token, such as a struct for reuse between your
modules:

``` glsl
struct Light {
  vec3 position;
  vec3 color;
};

#pragma glslify: export(Light)
```

## Further Reading

* [Modular and Versioned GLSL](http://mattdesl.svbtle.com/glslify) by [@mattdesl](http://mattdesl.svbtle.com/).
* [Module Best Practices](https://github.com/mattdesl/module-best-practices) by [@mattdesl](http://mattdesl.svbtle.com/).
* [Art of Node](https://github.com/maxogden/art-of-node) by [@maxogden](http://github.com/maxogden).
* [Browserify Handbook](https://github.com/substack/browserify-handbook) by [@substack](http://substack.net).
* The upcoming [WebGL Insights](http://www.crcpress.com/product/isbn/9781498716079) will include a chapter introducing glslify in detail.

## Contributing

See [stackgl/contributing](https://github.com/stackgl/contributing) for details.

## License

MIT. See [LICENSE.md](http://github.com/stackgl/glslify/blob/master/LICENSE.md) for details.
