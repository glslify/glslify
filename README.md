# glslify [![stability][0]][1]
[![npm version][2]][3] [![downloads][4]][5]

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
[three.js](http://threejs.org/) and
[pex](http://vorg.github.io/pex/), with more on the way!
[Open an issue](https://github.com/stackgl/glslify/issues/new) here if you'd like to
discuss integrating glslify with your platform of choice.

*If you're interested in playing around with glslify, you should check out
[glslb.in](http://glslb.in/): it's a fragment shader sandbox similar to
[Shadertoy](http://shadertoy.com/) and
[GLSL Sandbox](http://glslsandbox.com/)
with built in support for glslify.*

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

### Inline mode

By passing the `inline` option as true, you can write your
shader inline instead of requiring it to be in a separate
file:

``` javascript
var glslify = require('glslify')

var src = glslify(`
  precision mediump float;

  void main() {
    gl_FragColor = vec4(1.0);
  }
`, { inline: true })
```

### [Webpack](http://webpack.github.io/) Loader

You can use the
[glslify-loader](https://github.com/stackgl/glslify-loader)
module to bundle shaders through glslify with Webpack. Check out
[the repository](https://github.com/stackgl/glslify-loader)
for further information.

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

//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//

vec3 mod289_1_0(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289_1_0(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute_1_1(vec3 x) {
  return mod289_1_0(((x*34.0)+1.0)*x);
}

float snoise_1_2(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289_1_0(i); // Avoid truncation effects in permutation
  vec3 p = permute_1_1( permute_1_1( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}




void main() {
  float brightness = snoise_1_2(gl_FragCoord.xy);

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

## Source Transforms

Source transforms are a feature inspired by browserify, allowing you to
modify your GLSL source at build time on a per-package basis. This is
useful both for transpilation (e.g. converting from or to
[HLSL](http://en.wikipedia.org/wiki/High-Level_Shading_Language)) or for
making incremental improvements to GLSL syntax. (e.g. you can use
[glslify-hex](https://github.com/hughsk/glslify-hex) to include CSS-style
hex strings for colors in place of `vec3`s).

There are three kinds of source transform:

* **Local transforms**, the default. These are applied per-file, and only
  applied to a single package. If you're defining it via the CLI using `-t`
  it'll only apply itself to files outside of `node_modules`, but you
  can include it in `package.json` too: these will be applied only to that
  package without interfering with any of the package's parents or children.
* **Global transforms** are applied after local transforms to every file,
  regardless of whether or not it's a dependency.
* **Post transforms** are applied to the entire output file once it's been
  bundled. Generally, you want to reserve this for very specific use cases
  such as whole-shader optimisation.

There are a number of ways to use a transform. Start by
installing it in your project:

``` bash
npm install --save glslify-hex
```

The preferred way to enable a transform is through your project's
`package.json` file's `glslify.transform` property, like so:

``` json
{
  "name": "my-project",
  "dependencies": {
    "glslify-hex": "^2.0.0",
    "glslify": "^2.0.0"
  },
  "glslify": {
    "transform": ["glslify-hex"]
  }
}
```

You may also include arguments to your transform as you would
with browserify:

``` json
{
  "name": "my-project",
  "dependencies": {
    "glslify-hex": "^2.0.0",
    "glslify": "^2.0.0"
  },
  "glslify": {
    "transform": [
      ["glslify-hex", {
        "option-1": true,
        "option-2": 42
      }]
    ]
  }
}
```

Note that this method is only available for local transforms.

You may also specify transforms via the CLI:

``` bash
glslify -t 'local-transform' -g 'global-transform' -p 'post-transform'
```

Or when using the browserify transform by including them as
options like so:

``` javascript
var glslify = require('glslify')

glslify(__dirname + '/shader.glsl', {
  transform: [
    ["glslify-hex", {
      "option-1": true,
      "option-2": 42
    }],
    ["global-transform", { global: true }],
    ["post-transform", { post: true }]
  ]
})
```

## Migrating from glslify@1 to glslify@2

There are two important changes to note:

* [gl-shader](http://github.com/stackgl/gl-shader) is no longer bundled in with
  glslify's browserify transform.
* glslify now accepts files individually, rather than frag/vert pairings.

The following:

``` javascript
var glslify = require('glslify')

var shader = glslify({
  frag: './shader.frag',
  vert: './shader.vert'
})(gl)
```

Should now be created like so:

``` javascript
var glShader = require('gl-shader')
var glslify  = require('glslify')

var shader = glShader(gl,
  glslify('./shader.vert'),
  glslify('./shader.frag')
)
```

## Module API

You can use glslify from Node using `glslify.bundle`. The operation is
performed asynchronously, but otherwise it shares the same API as
glslify's browserify transform.

### `glslify.bundle(file, opts, done)`

Takes a `file` and calls `done(err, source, files)` with the finished shader
when complete. `files` is an array of all the files required from the
dependency tree, including the entry file.

Options include:

* `inline`: if set to true, you can pass the GLSL source directly in
  place of the `file` argument.
* `transform`: an array of transforms to apply to the shader.
* `basedir`: the directory from which to resolve modules from in your
  first shader. Defaults to the first file's directory, or `process.cwd()`
  if inline mode is enabled.

## Further Reading

* [stack.gl Packages List](http://stack.gl/packages/) (see "Shader Components").
* [Modular and Versioned GLSL](http://mattdesl.svbtle.com/glslify) by [@mattdesl](http://mattdesl.svbtle.com/).
* [Module Best Practices](https://github.com/mattdesl/module-best-practices) by [@mattdesl](http://mattdesl.svbtle.com/).
* [Art of Node](https://github.com/maxogden/art-of-node) by [@maxogden](http://github.com/maxogden).
* [Browserify Handbook](https://github.com/substack/browserify-handbook) by [@substack](http://substack.net).
* [WebGL Insights](http://www.amazon.com/WebGL-Insights-Patrick-Cozzi/dp/1498716075) includes a chapter introducing glslify in detail.
* [Shader School](http://github.com/stackgl/shader-school) by [@mikolalysenko](http://github.com/mikolalysenko), [chrisdickinson](http://github.com/chrisdickinson) and [@hughskennedy](http://github.com/hughskennedy).
* [Book of Shaders](http://patriciogonzalezvivo.com/2015/thebookofshaders/) by [Patricio Gonzalez Vivo](http://patriciogonzalezvivo.com/).
* [Pragmatic Physically Based Rendering](http://marcinignac.com/blog/pragmatic-pbr-setup-and-gamma/) by [@marcinignac](http://http://marcinignac.com/).
* [glslifyでGLSLをモジュール化しよう](http://qiita.com/yuichiroharai/items/ecbfd2d7729c7384fb3a) by [@yuichiroharaiJP](http://www.yuichiroharai.com/).


## glslify in the Wild

* [KAMRA: Deja Vu](https://kamra.invisi-dir.com/)
* [SMASHING Mega Scene](https://github.com/edankwan/SMASHING-Mega-Scene)
* [Uber's deck.gl](https://github.com/uber-common/deck.gl)
* [Glam](https://github.com/glamjs/glam)
* [run.south.im](http://run.south.im/)
* [glslb.in](http://glslb.in/)
* [N|Solid](https://nodesource.com/products/nsolid)

## Contributing

See [stackgl/contributing](https://github.com/stackgl/contributing) for details.

## License

MIT. See [LICENSE.md](http://github.com/stackgl/glslify/blob/master/LICENSE.md) for details.

[0]: https://img.shields.io/badge/stability-2%20stable-brightgreen.svg?style=flat-square
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/glslify.svg?style=flat-square
[3]: https://npmjs.org/package/glslify
[4]: http://img.shields.io/npm/dm/glslify.svg?style=flat-square
[5]: https://npmjs.org/package/glslify
