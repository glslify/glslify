module.exports = function (file, src, opts, done) {
  for (var i = 0; i < opts.contents.length; i++) {
    if (src.indexOf(opts.contents[i]) === -1) {
      var err = new Error("File is missing: " + JSON.stringify(opts.contents[i]))
      if (done) return done(err)
      throw err
    }
  }

  src = [src, '#define CHECK_CONTENTS 1'].join('\n\n')

  return done ? done(null, src) : src
}
