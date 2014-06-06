# glslify

a module system for GLSL and a transform enabling easy access to GLSL Shaders in JavaScript.

## As a Browserify transform:

```bash
$ npm install --save glslify
$ browserify entry.js -t glslify > bundle.js
```

glslify will find and replace all instances of `glslify({vertex: path, fragment: path})`
with a function that takes a webgl context and returns a [shader instance](http://npm.im/gl-shader-core).

Recommended usage:

```javascript
var glslify = require('glslify')    // requiring `glslify` is safe in this context.
                                    // if the program is run without the transform,
                                    // it'll output a helpful error message.
var shell = require('gl-now')()

var createShader = glslify({
    vertex: './vertex.glsl'
  , fragment: './fragment.glsl'
})

var program

shell.on('gl-init', function() {
  program = createShader(shell.gl)
})
```

As part of the transform, the program will be analyzed for its **uniforms** and **attributes**,
so once you have a `program` instance, the following will work:

```javascript

// given a glsl program containing:
//
//   uniform vec2 color;
//   uniform mat4 view;

program.bind()
program.uniforms.color = [0.5, 1.0]
program.uniforms.view = [
  1, 0, 0, 0
, 0, 1, 0, 0
, 0, 0, 1, 0
, 0, 0, 0, 1
]

```

The following options may be passed into glslify's transformed constructor:

* `fragment`: the fragment shader to use.
* `vertex`: the vertex shader to use.
* `inline`: instead of loading the vertex/fragment shaders from a file path,
  use the string values of these options directly to generate the shaders.
* `transform`: a string or array of strings naming browserify-transform stream
  modules you would like to use to transform these shaders.

## As a GLSL module system:

glslify can be run as a standalone command as well:


```bash
$ glslify my-module.glsl > output.glsl
```

glslify allows you to write GLSL modules that export a local function, variable, or type,
and `require` those modules to bring that export into another module.

Lookups work like node's `require` -- that is, it'll work relatively to the file first,
and then work from the file's directory on up to the root directory looking for a package
in `node_modules/`.

## example files

| [`main.glsl`](#mainglsl) | [`file1.glsl`](#file1glsl) | [`file2.glsl`](#file2glsl) |
|---------------------------|-----------------------------|-----------------------------|

### main.glsl

[back to file list](#example-files)

```c
// main.glsl
precision highp float;
uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;

// require a function from another file!
#pragma glslify: program_one = require(./file1)

// require a function from another file, and replace
// `local_value` in that file with `resolution.x` from
// this scope.
#pragma glslify: program_two = require(./file2, local_value=resolution.x)

int modulo(float x, float y) {
  return int(x - y * floor(x / y));
}

void main(void) {
  ivec2 m = ivec2(modulo(gl_FragCoord.x, 2.), modulo(gl_FragCoord.y, 2.));

  if(m.x == 0 || m.y == 0) {
    program_one();
  } else { 
    program_two();
  }
}
```


### file1.glsl

[back to file list](#example-files)

```c
// file1.glsl
void main(void) {
  gl_FragColor = vec4(1., 0., 0., 1.);
}

#pragma glslify: export(main)
```

### file2.glsl

[back to file list](#example-files)

```c
// file2.glsl

uniform float local_value;

void main(void) {
  gl_FragColor = vec4(0., 0., local_value, 1.);
}

#pragma glslify: export(main)
```
# GLSL API

GLSLify works by mangling top-level identities in non-root modules.

Exported variables will be aliased on requirement.

### \#pragma glslify: VARIABLE = require(MODULE[, NAME=EXPR])

Import a module and assign it the name `VARIABLE` in the local program.

`MODULE` may be located within `node_modules/` or relative to the current file.

**Quotes are not allowed.**

If the target module defines `attribute`, `varying`, or `uniform` global variables,
you may map those to a local definition or expression:

```c

attribute vec4 position;
#pragma glslify: x = require(./takes_vec2, module_variable=position.xy)

```

If a mapping is not defined, those requirements are forwarded on to the module requiring
the current module -- if no mappings are found for a definition, an error is raised.

### \#pragma glslify: export(NAME)

Exports a local name from the current module. If the current module is the root, this is
a no-op. There may be only one exported `NAME` per module. The `NAME` may represent a
type, function, or variable.


# With ThreeJS

You can use the `sourceOnly` option to integrate glslfiy with ThreeJS and other WebGL frameworks. This will return an object with `vertex` and `fragment` shader source, which you can then compile yourself.

In ThreeJS it might look like this:  

```js
var myShader = glslify({
    vertex: './vertex.glsl',
    fragment: './fragment.glsl',
    sourceOnly: true
});

//optionally do something with our uniforms/attribs
console.log( myShader.uniforms, myShader.attributes );

//setup custom ThreeJS material...
var mat = new THREE.ShaderMaterial({
    vertexShader: myShader.vertex,
    fragmentShader: myShader.fragment
    uniforms: { 
      // setup your uniforms..
    }
});

```

# License

MIT
