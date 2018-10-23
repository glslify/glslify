module.exports = function (file, src, opts, done) {
  file = file || 'null'
  return done ? done(null, file) : file
}
