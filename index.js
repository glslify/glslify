var tty = require('tty')
  , nopt = require('nopt')
  , path = require('path')
  , fs = require('fs')
  , shorthand
  , options

var glslify = require('glslify-stream')
  , deparser = require('glsl-deparser')
  , minify = require('glsl-min-stream')

options = {
    'minify': Boolean
  , 'output': path
  , 'help': Boolean
}

shorthand = {
    'h': ['--help']
  , 'm': ['--minify']
  , 'o': ['--output']
}

module.exports = run

function help() {
/*
glslify [-o|--output file] [-h|--help] file

  compile multiple glsl modules with #pragma: glslify directives into a single
  glsl output.

  if no output option is defined, output will be written to stdout.

  arguments:

    --help, -h                  this help message.

    --output path, -o path      output result of minification to file represented by `path`.
                                by default, output will be written to stdout.

*/

  var str = help+''

  process.stdout.write(str.slice(str.indexOf('/*')+3, str.indexOf('*/')))
}

function run() {
  var parsed = nopt(options, shorthand)

  if(parsed.help || !parsed.argv.remain.length) {
    return help(), process.exit(1)
  }

  var should_minify = parsed.minify
    , output = parsed.output ? fs.createWriteStream(parsed.output) : process.stdout
    , input = path.resolve(parsed.argv.remain[0])
    , stream

  stream = glslify(input)

  if(should_minify)
    stream = stream.pipe(minify())

  stream.pipe(deparser(!should_minify))
        .pipe(output)
}
