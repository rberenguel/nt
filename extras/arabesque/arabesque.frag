precision highp float;

uniform vec2  u_virtual_resolution;
uniform float u_screen_offset;
uniform float u_time;
uniform float u_palette_time;
uniform float u_show_borders;
uniform vec3  u_warm_low;
uniform vec3  u_warm_high;
uniform vec3  u_warm_accent;
uniform vec3  u_cool_low;
uniform vec3  u_cool_high;

#define PI 3.14159265359

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

vec4 getSeamlessHex(vec2 p) {
  const vec2 s = vec2(1.7320508, 1.0);
  vec4 hC = floor(vec4(p, p - vec2(s.x * 0.5, 0.5)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
}

float hexSDF(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  // u_screen_offset shifts gl_FragCoord.x into the shared virtual canvas
  // so the pattern is seamless across multiple windows side-by-side.
  vec2 virtualFrag = vec2(gl_FragCoord.x + u_screen_offset, gl_FragCoord.y);
  vec2 uv = (virtualFrag - 0.5 * u_virtual_resolution)
            / min(u_virtual_resolution.x, u_virtual_resolution.y);
  uv *= 14.0;

  float t = u_time * 0.35;
  vec4 hex = getSeamlessHex(uv);
  vec2 localUV = hex.xy;
  vec2 cellID  = hex.zw;

  float distToEdge = -hexSDF(localUV, 0.5);

  vec2 rnd1 = hash2(cellID);
  vec2 rnd2 = hash2(cellID + 43.1);

  float r = length(localUV);
  float a = atan(localUV.y, localUV.x);

  float sym = 6.0 * floor(1.0 + rnd1.x * 2.5);
  float sector = PI / sym;
  float foldedAngle = abs(mod(a + rnd2.x * 2.0 * PI + t * (rnd1.y - 0.5) * 0.4,
                             2.0 * sector) - sector);
  vec2 foldedUV = vec2(cos(foldedAngle), sin(foldedAngle)) * r;

  float k1 = 18.0 + floor(rnd1.x * 4.0) * 10.0;
  float k2 = 28.0 + floor(rnd2.y * 3.0) * 12.0;

  float waveField = cos(foldedUV.x * k1 - t * (1.0 + rnd1.y)) * 0.35
                  + sin(foldedUV.y * k2 + t * 0.8) * 0.35
                  + cos(r * (k1 + k2) * 0.5 - t * 1.4) * 0.3;

  float rings    = abs(sin(waveField * 5.0 + r * 32.0 * (0.8 + rnd2.x * 0.4)));
  float filigree = smoothstep(0.40, 0.95, rings);
  filigree += smoothstep(0.15, 0.85, cos(foldedAngle * sym * 0.5)) * 0.25;

  // Traveling wander pattern shifts the zone boundary over time
  vec2  macroPos  = cellID * 0.14;
  vec2  wander    = vec2(sin(u_palette_time * 0.7), cos(u_palette_time * 0.5)) * 1.8;
  float coreDist  = length(macroPos + wander);
  float zoneBlend = smoothstep(2.5, 0.4, coreDist);

  vec3 warmTheme = mix(u_warm_low, mix(u_warm_high, u_warm_accent, rnd2.y), filigree);
  vec3 coolTheme = mix(u_cool_low, u_cool_high, filigree);
  vec3 color     = mix(warmTheme, coolTheme, zoneBlend);

  float jointWidth      = 0.025;
  float edgeLine        = smoothstep(jointWidth, 0.005, distToEdge);
  float borderHighlight = smoothstep(jointWidth * 2.0, jointWidth, distToEdge) * 0.3;
  vec3 borderedColor    = mix(color + borderHighlight * vec3(1.0, 0.9, 0.6),
                              vec3(0.02, 0.01, 0.005), edgeLine);
  color = mix(color, borderedColor, u_show_borders);

  float centerPip = smoothstep(0.05, 0.0, r);
  color += centerPip * vec3(1.0, 0.98, 0.85);

  gl_FragColor = vec4(color, 1.0);
}
