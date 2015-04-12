#pragma glslify: b = require(./nest-conflict-2.glsl)

const vec2 c = vec2(2.0, b);

#pragma glslify: export(c)
