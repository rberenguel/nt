#version 300 es
precision highp float;

layout(location = 0) in vec2  a_position;
layout(location = 1) in float a_angle;
layout(location = 2) in vec3  a_K;
layout(location = 3) in float a_speed;
layout(location = 4) in float a_life;

out vec2  v_position;
out float v_angle;
out vec3  v_K;
out float v_speed;
out float v_life;

out vec3  vf_K;
out float vf_life;
out float vf_speed;

uniform sampler2D u_trail;
uniform vec2      u_gridSize;
uniform float     u_sensorOffset;
uniform float     u_sensorAngle;
uniform float     u_turnSpeed;
uniform float     u_wander;
uniform float     u_simTime;
uniform float     u_dt;

float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float sense(vec2 pos, float angle, float offAngle, float offDist) {
    vec2 dir = vec2(cos(angle + offAngle), sin(angle + offAngle));
    vec2 samp = (pos + dir * offDist) / u_gridSize;
    return texture(u_trail, fract(samp)).r;
}

void main() {
    vec2  pos   = a_position;
    float angle = a_angle;
    float life  = a_life;

    if (life > 0.0) {
        float so = u_sensorOffset;
        float sa = u_sensorAngle;

        float left   = sense(pos, angle, -sa, so);
        float center = sense(pos, angle,  0.0, so);
        float right  = sense(pos, angle, +sa, so);

        // Calmer steering — smaller turns
        if (center > left && center > right) {
            // straight
        } else if (left > right) {
            angle -= u_turnSpeed;
        } else if (right > left) {
            angle += u_turnSpeed;
        } else {
            angle += (hash(pos + vec2(u_simTime * 0.07)) - 0.5) * u_turnSpeed * 0.8;
        }

        // Very gentle wander
        angle += (hash(pos + vec2(u_simTime * 0.23 + 17.0)) - 0.5) * u_wander;

        pos += vec2(cos(angle), sin(angle)) * a_speed;
        pos = mod(pos + u_gridSize, u_gridSize);

        life -= u_dt;
    }

    v_position = pos;
    v_angle    = angle;
    v_K        = a_K;
    v_speed    = a_speed;
    v_life     = life;

    vf_K       = a_K;
    vf_life    = life;
    vf_speed   = a_speed;

    // Soft brush size: larger for faster agents
    float brushSize = 3.5 + a_speed * 4.5;
    gl_PointSize = brushSize;

    vec2 ndc = (pos / u_gridSize) * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, ndc.y, 0.0, 1.0);
}