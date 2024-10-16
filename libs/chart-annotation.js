/*!
 * chartjs-plugin-annotation v3.0.1
 * https://www.chartjs.org/chartjs-plugin-annotation/index
 * (c) 2023 chartjs-plugin-annotation Contributors
 * Released under the MIT License
 */
!(function (t, e) {
  "object" == typeof exports && "undefined" != typeof module
    ? (module.exports = e(require("chart.js"), require("chart.js/helpers")))
    : "function" == typeof define && define.amd
      ? define(["chart.js", "chart.js/helpers"], e)
      : ((t = "undefined" != typeof globalThis ? globalThis : t || self)[
          "chartjs-plugin-annotation"
        ] = e(t.Chart, t.Chart.helpers));
})(this, function (t, e) {
  "use strict";
  const o = {
    modes: {
      point: (t, e) => r(t, e, { intersect: !0 }),
      nearest: (t, o, n) =>
        (function (t, o, n) {
          let i = Number.POSITIVE_INFINITY;
          return r(t, o, n)
            .reduce((t, r) => {
              const s = r.getCenterPoint(),
                a = (function (t, e, o) {
                  if ("x" === o) return { x: t.x, y: e.y };
                  if ("y" === o) return { x: e.x, y: t.y };
                  return e;
                })(o, s, n.axis),
                d = e.distanceBetweenPoints(o, a);
              return d < i ? ((t = [r]), (i = d)) : d === i && t.push(r), t;
            }, [])
            .sort((t, e) => t._index - e._index)
            .slice(0, 1);
        })(t, o, n),
      x: (t, e, o) => r(t, e, { intersect: o.intersect, axis: "x" }),
      y: (t, e, o) => r(t, e, { intersect: o.intersect, axis: "y" }),
    },
  };
  function n(t, e, n) {
    return (o.modes[n.mode] || o.modes.nearest)(t, e, n);
  }
  function r(t, e, o) {
    return t.visibleElements.filter((t) =>
      o.intersect
        ? t.inRange(e.x, e.y)
        : (function (t, e, o) {
            return "x" !== o && "y" !== o
              ? t.inRange(e.x, e.y, "x", !0) || t.inRange(e.x, e.y, "y", !0)
              : t.inRange(e.x, e.y, o, !0);
          })(t, e, o.axis),
    );
  }
  const i = (t, e) =>
      e > t || (t.length > e.length && t.slice(0, e.length) === e),
    s = 0.001,
    a = (t, e, o) => Math.min(o, Math.max(e, t));
  function d(t, e, o) {
    for (const n of Object.keys(t)) t[n] = a(t[n], e, o);
    return t;
  }
  function c(t, { x: e, y: o, x2: n, y2: r }, i, a) {
    const d = a / 2,
      c = t.x >= e - d - s && t.x <= n + d + s,
      l = t.y >= o - d - s && t.y <= r + d + s;
    return "x" === i ? c : ("y" === i || c) && l;
  }
  function l(t, e) {
    const { centerX: o, centerY: n } = t.getProps(["centerX", "centerY"], e);
    return { x: o, y: n };
  }
  const h = (t) => "string" == typeof t && t.endsWith("%"),
    u = (t) => parseFloat(t) / 100,
    f = (t) => a(u(t), 0, 1),
    x = (t, e) => ({ x: t, y: e, x2: t, y2: e, width: 0, height: 0 }),
    y = {
      box: (t) => x(t.centerX, t.centerY),
      ellipse: (t) => ({
        centerX: t.centerX,
        centerY: t.centerX,
        radius: 0,
        width: 0,
        height: 0,
      }),
      label: (t) => x(t.centerX, t.centerY),
      line: (t) => x(t.x, t.y),
      point: (t) => ({
        centerX: t.centerX,
        centerY: t.centerY,
        radius: 0,
        width: 0,
        height: 0,
      }),
      polygon: (t) => x(t.centerX, t.centerY),
    };
  function p(t, e) {
    return "start" === e ? 0 : "end" === e ? t : h(e) ? f(e) * t : t / 2;
  }
  function b(t, e, o = !0) {
    return "number" == typeof e ? e : h(e) ? (o ? f(e) : u(e)) * t : t;
  }
  function g(t, o = "center") {
    return e.isObject(t)
      ? { x: e.valueOrDefault(t.x, o), y: e.valueOrDefault(t.y, o) }
      : { x: (t = e.valueOrDefault(t, o)), y: t };
  }
  function m(t) {
    return t && (e.defined(t.xValue) || e.defined(t.yValue));
  }
  function v(t, o, n) {
    const r = n.init;
    if (r)
      return !0 === r
        ? M(o, n)
        : (function (t, o, n) {
            const r = e.callback(n.init, [
              { chart: t, properties: o, options: n },
            ]);
            if (!0 === r) return M(o, n);
            if (e.isObject(r)) return r;
          })(t, o, n);
  }
  function w(t, o, n) {
    let r = !1;
    return (
      o.forEach((o) => {
        e.isFunction(t[o])
          ? ((r = !0), (n[o] = t[o]))
          : e.defined(n[o]) && delete n[o];
      }),
      r
    );
  }
  function M(t, e) {
    const o = e.type || "line";
    return y[o](t);
  }
  const P = new Map(),
    S = (t) => isNaN(t) || t <= 0,
    C = (t) =>
      t.reduce(function (t, e) {
        return (t += e.string);
      }, "");
  function k(t) {
    if (t && "object" == typeof t) {
      const e = t.toString();
      return (
        "[object HTMLImageElement]" === e || "[object HTMLCanvasElement]" === e
      );
    }
  }
  function D(t, { x: o, y: n }, r) {
    r && (t.translate(o, n), t.rotate(e.toRadians(r)), t.translate(-o, -n));
  }
  function A(t, e) {
    if (e && e.borderWidth)
      return (
        (t.lineCap = e.borderCapStyle),
        t.setLineDash(e.borderDash),
        (t.lineDashOffset = e.borderDashOffset),
        (t.lineJoin = e.borderJoinStyle),
        (t.lineWidth = e.borderWidth),
        (t.strokeStyle = e.borderColor),
        !0
      );
  }
  function j(t, e) {
    (t.shadowColor = e.backgroundShadowColor),
      (t.shadowBlur = e.shadowBlur),
      (t.shadowOffsetX = e.shadowOffsetX),
      (t.shadowOffsetY = e.shadowOffsetY);
  }
  function I(t, o) {
    const n = o.content;
    if (k(n))
      return { width: b(n.width, o.width), height: b(n.height, o.height) };
    const r = o.font,
      i = e.isArray(r) ? r.map((t) => e.toFont(t)) : [e.toFont(r)],
      s = o.textStrokeWidth,
      a = e.isArray(n) ? n : [n],
      d = a.join() + C(i) + s + (t._measureText ? "-spriting" : "");
    return (
      P.has(d) ||
        P.set(
          d,
          (function (t, e, o, n) {
            t.save();
            const r = e.length;
            let i = 0,
              s = n;
            for (let a = 0; a < r; a++) {
              const r = o[Math.min(a, o.length - 1)];
              t.font = r.string;
              const d = e[a];
              (i = Math.max(i, t.measureText(d).width + n)),
                (s += r.lineHeight);
            }
            return t.restore(), { width: i, height: s };
          })(t, a, i, s),
        ),
      P.get(d)
    );
  }
  function O(t, o, n) {
    const { x: r, y: i, width: s, height: a } = o;
    t.save(), j(t, n);
    const c = A(t, n);
    (t.fillStyle = n.backgroundColor),
      t.beginPath(),
      e.addRoundedRectPath(t, {
        x: r,
        y: i,
        w: s,
        h: a,
        radius: d(e.toTRBLCorners(n.borderRadius), 0, Math.min(s, a) / 2),
      }),
      t.closePath(),
      t.fill(),
      c && ((t.shadowColor = n.borderShadowColor), t.stroke()),
      t.restore();
  }
  function T(t, o, n) {
    const r = n.content;
    if (k(r))
      return (
        t.save(),
        (t.globalAlpha = (function (t, o) {
          const n = e.isNumber(t) ? t : o;
          return e.isNumber(n) ? a(n, 0, 1) : 1;
        })(n.opacity, r.style.opacity)),
        t.drawImage(r, o.x, o.y, o.width, o.height),
        void t.restore()
      );
    const i = e.isArray(r) ? r : [r],
      s = n.font,
      d = e.isArray(s) ? s.map((t) => e.toFont(t)) : [e.toFont(s)],
      c = n.color,
      l = e.isArray(c) ? c : [c],
      h = (function (t, e) {
        const { x: o, width: n } = t,
          r = e.textAlign;
        return "center" === r
          ? o + n / 2
          : "end" === r || "right" === r
            ? o + n
            : o;
      })(o, n),
      u = o.y + n.textStrokeWidth / 2;
    t.save(),
      (t.textBaseline = "middle"),
      (t.textAlign = n.textAlign),
      (function (t, e) {
        if (e.textStrokeWidth > 0)
          return (
            (t.lineJoin = "round"),
            (t.miterLimit = 2),
            (t.lineWidth = e.textStrokeWidth),
            (t.strokeStyle = e.textStrokeColor),
            !0
          );
      })(t, n) &&
        (function (t, { x: e, y: o }, n, r) {
          t.beginPath();
          let i = 0;
          n.forEach(function (n, s) {
            const a = r[Math.min(s, r.length - 1)],
              d = a.lineHeight;
            (t.font = a.string), t.strokeText(n, e, o + d / 2 + i), (i += d);
          }),
            t.stroke();
        })(t, { x: h, y: u }, i, d),
      (function (t, { x: e, y: o }, n, { fonts: r, colors: i }) {
        let s = 0;
        n.forEach(function (n, a) {
          const d = i[Math.min(a, i.length - 1)],
            c = r[Math.min(a, r.length - 1)],
            l = c.lineHeight;
          t.beginPath(),
            (t.font = c.string),
            (t.fillStyle = d),
            t.fillText(n, e, o + l / 2 + s),
            (s += l),
            t.fill();
        });
      })(t, { x: h, y: u }, i, { fonts: d, colors: l }),
      t.restore();
  }
  function R(t, o, n, r) {
    const { radius: i, options: s } = o,
      a = s.pointStyle,
      d = s.rotation;
    let c = (d || 0) * e.RAD_PER_DEG;
    if (k(a))
      return (
        t.save(),
        t.translate(n, r),
        t.rotate(c),
        t.drawImage(a, -a.width / 2, -a.height / 2, a.width, a.height),
        void t.restore()
      );
    S(i) ||
      (function (t, { x: o, y: n, radius: r, rotation: i, style: s, rad: a }) {
        let d, c, l, h;
        switch ((t.beginPath(), s)) {
          default:
            t.arc(o, n, r, 0, e.TAU), t.closePath();
            break;
          case "triangle":
            t.moveTo(o + Math.sin(a) * r, n - Math.cos(a) * r),
              (a += e.TWO_THIRDS_PI),
              t.lineTo(o + Math.sin(a) * r, n - Math.cos(a) * r),
              (a += e.TWO_THIRDS_PI),
              t.lineTo(o + Math.sin(a) * r, n - Math.cos(a) * r),
              t.closePath();
            break;
          case "rectRounded":
            (h = 0.516 * r),
              (l = r - h),
              (d = Math.cos(a + e.QUARTER_PI) * l),
              (c = Math.sin(a + e.QUARTER_PI) * l),
              t.arc(o - d, n - c, h, a - e.PI, a - e.HALF_PI),
              t.arc(o + c, n - d, h, a - e.HALF_PI, a),
              t.arc(o + d, n + c, h, a, a + e.HALF_PI),
              t.arc(o - c, n + d, h, a + e.HALF_PI, a + e.PI),
              t.closePath();
            break;
          case "rect":
            if (!i) {
              (l = Math.SQRT1_2 * r), t.rect(o - l, n - l, 2 * l, 2 * l);
              break;
            }
            a += e.QUARTER_PI;
          case "rectRot":
            (d = Math.cos(a) * r),
              (c = Math.sin(a) * r),
              t.moveTo(o - d, n - c),
              t.lineTo(o + c, n - d),
              t.lineTo(o + d, n + c),
              t.lineTo(o - c, n + d),
              t.closePath();
            break;
          case "crossRot":
            a += e.QUARTER_PI;
          case "cross":
            (d = Math.cos(a) * r),
              (c = Math.sin(a) * r),
              t.moveTo(o - d, n - c),
              t.lineTo(o + d, n + c),
              t.moveTo(o + c, n - d),
              t.lineTo(o - c, n + d);
            break;
          case "star":
            (d = Math.cos(a) * r),
              (c = Math.sin(a) * r),
              t.moveTo(o - d, n - c),
              t.lineTo(o + d, n + c),
              t.moveTo(o + c, n - d),
              t.lineTo(o - c, n + d),
              (a += e.QUARTER_PI),
              (d = Math.cos(a) * r),
              (c = Math.sin(a) * r),
              t.moveTo(o - d, n - c),
              t.lineTo(o + d, n + c),
              t.moveTo(o + c, n - d),
              t.lineTo(o - c, n + d);
            break;
          case "line":
            (d = Math.cos(a) * r),
              (c = Math.sin(a) * r),
              t.moveTo(o - d, n - c),
              t.lineTo(o + d, n + c);
            break;
          case "dash":
            t.moveTo(o, n), t.lineTo(o + Math.cos(a) * r, n + Math.sin(a) * r);
        }
        t.fill();
      })(t, { x: n, y: r, radius: i, rotation: d, style: a, rad: c });
  }
  const Y = {
    xScaleID: {
      min: "xMin",
      max: "xMax",
      start: "left",
      end: "right",
      startProp: "x",
      endProp: "x2",
    },
    yScaleID: {
      min: "yMin",
      max: "yMax",
      start: "bottom",
      end: "top",
      startProp: "y",
      endProp: "y2",
    },
  };
  function X(t, o, n) {
    return (
      (o = "number" == typeof o ? o : t.parse(o)),
      e.isFinite(o) ? t.getPixelForValue(o) : n
    );
  }
  function E(t, e, o) {
    const n = e[o];
    if (n || "scaleID" === o) return n;
    const r = o.charAt(0),
      i = Object.values(t).filter((t) => t.axis && t.axis === r);
    return i.length ? i[0].id : r;
  }
  function W(t, e) {
    if (t) {
      const o = t.options.reverse;
      return {
        start: X(t, e.min, o ? e.end : e.start),
        end: X(t, e.max, o ? e.start : e.end),
      };
    }
  }
  function _(t, e) {
    const { chartArea: o, scales: n } = t,
      r = n[E(n, e, "xScaleID")],
      i = n[E(n, e, "yScaleID")];
    let s = o.width / 2,
      a = o.height / 2;
    return (
      r && (s = X(r, e.xValue, r.left + r.width / 2)),
      i && (a = X(i, e.yValue, i.top + i.height / 2)),
      { x: s, y: a }
    );
  }
  function z(t, e) {
    const o = t.scales,
      n = o[E(o, e, "xScaleID")],
      r = o[E(o, e, "yScaleID")];
    if (!n && !r) return {};
    let { left: i, right: s } = n || t.chartArea,
      { top: a, bottom: d } = r || t.chartArea;
    const c = V(n, { min: e.xMin, max: e.xMax, start: i, end: s });
    (i = c.start), (s = c.end);
    const l = V(r, { min: e.yMin, max: e.yMax, start: d, end: a });
    return (
      (a = l.start),
      (d = l.end),
      {
        x: i,
        y: a,
        x2: s,
        y2: d,
        width: s - i,
        height: d - a,
        centerX: i + (s - i) / 2,
        centerY: a + (d - a) / 2,
      }
    );
  }
  function F(t, e) {
    if (!m(e)) {
      const o = z(t, e);
      let n = e.radius;
      (n && !isNaN(n)) ||
        ((n = Math.min(o.width, o.height) / 2), (e.radius = n));
      const r = 2 * n,
        i = o.centerX + e.xAdjust,
        s = o.centerY + e.yAdjust;
      return {
        x: i - n,
        y: s - n,
        x2: i + n,
        y2: s + n,
        centerX: i,
        centerY: s,
        width: r,
        height: r,
        radius: n,
      };
    }
    return (function (t, e) {
      const o = _(t, e),
        n = 2 * e.radius;
      return {
        x: o.x - e.radius + e.xAdjust,
        y: o.y - e.radius + e.yAdjust,
        x2: o.x + e.radius + e.xAdjust,
        y2: o.y + e.radius + e.yAdjust,
        centerX: o.x + e.xAdjust,
        centerY: o.y + e.yAdjust,
        radius: e.radius,
        width: n,
        height: n,
      };
    })(t, e);
  }
  function N(t, e) {
    const { scales: o, chartArea: n } = t,
      r = o[e.scaleID],
      i = { x: n.left, y: n.top, x2: n.right, y2: n.bottom };
    return (
      r
        ? (function (t, e, o) {
            const n = X(t, o.value, NaN),
              r = X(t, o.endValue, n);
            t.isHorizontal()
              ? ((e.x = n), (e.x2 = r))
              : ((e.y = n), (e.y2 = r));
          })(r, i, e)
        : (function (t, e, o) {
            for (const n of Object.keys(Y)) {
              const r = t[E(t, o, n)];
              if (r) {
                const {
                    min: t,
                    max: i,
                    start: s,
                    end: a,
                    startProp: d,
                    endProp: c,
                  } = Y[n],
                  l = W(r, { min: o[t], max: o[i], start: r[s], end: r[a] });
                (e[d] = l.start), (e[c] = l.end);
              }
            }
          })(o, i, e),
      i
    );
  }
  function H(t, e) {
    const o = z(t, e);
    return (
      (o.initProperties = v(t, o, e)),
      (o.elements = [
        {
          type: "label",
          optionScope: "label",
          properties: L(t, o, e),
          initProperties: o.initProperties,
        },
      ]),
      o
    );
  }
  function V(t, e) {
    const o = W(t, e) || e;
    return { start: Math.min(o.start, o.end), end: Math.max(o.start, o.end) };
  }
  function B(t, e) {
    const { start: o, end: n, borderWidth: r } = t,
      {
        position: i,
        padding: { start: s, end: a },
        adjust: d,
      } = e;
    return o + r / 2 + d + p(n - r - o - s - a - e.size, i);
  }
  function L(t, o, n) {
    const r = n.label;
    (r.backgroundColor = "transparent"), (r.callout.display = !1);
    const i = g(r.position),
      s = e.toPadding(r.padding),
      a = I(t.ctx, r),
      d = (function ({ properties: t, options: e }, o, n, r) {
        const { x: i, x2: s, width: a } = t;
        return B(
          { start: i, end: s, size: a, borderWidth: e.borderWidth },
          {
            position: n.x,
            padding: { start: r.left, end: r.right },
            adjust: e.label.xAdjust,
            size: o.width,
          },
        );
      })({ properties: o, options: n }, a, i, s),
      c = (function ({ properties: t, options: e }, o, n, r) {
        const { y: i, y2: s, height: a } = t;
        return B(
          { start: i, end: s, size: a, borderWidth: e.borderWidth },
          {
            position: n.y,
            padding: { start: r.top, end: r.bottom },
            adjust: e.label.yAdjust,
            size: o.height,
          },
        );
      })({ properties: o, options: n }, a, i, s),
      l = a.width + s.width,
      h = a.height + s.height;
    return {
      x: d,
      y: c,
      x2: d + l,
      y2: c + h,
      width: l,
      height: h,
      centerX: d + l / 2,
      centerY: c + h / 2,
      rotation: r.rotation,
    };
  }
  function $(t, e, o) {
    const n = Math.cos(o),
      r = Math.sin(o),
      i = e.x,
      s = e.y;
    return {
      x: i + n * (t.x - i) - r * (t.y - s),
      y: s + r * (t.x - i) + n * (t.y - s),
    };
  }
  const U = ["enter", "leave"],
    J = U.concat("click");
  function Q(t, e, o) {
    if (t.listened)
      switch (e.type) {
        case "mousemove":
        case "mouseout":
          return (function (t, e, o) {
            if (!t.moveListened) return;
            let r;
            r = "mousemove" === e.type ? n(t, e, o.interaction) : [];
            const i = t.hovered;
            t.hovered = r;
            const s = { state: t, event: e };
            let a = q(s, "leave", i, r);
            return q(s, "enter", r, i) || a;
          })(t, e, o);
        case "click":
          return (function (t, e, o) {
            const r = t.listeners,
              i = n(t, e, o.interaction);
            let s;
            for (const t of i) s = G(t.options.click || r.click, t, e) || s;
            return s;
          })(t, e, o);
      }
  }
  function q({ state: t, event: e }, o, n, r) {
    let i;
    for (const s of n)
      r.indexOf(s) < 0 && (i = G(s.options[o] || t.listeners[o], s, e) || i);
    return i;
  }
  function G(t, o, n) {
    return !0 === e.callback(t, [o.$context, n]);
  }
  const K = ["afterDraw", "beforeDraw"];
  function Z(t, o, n) {
    if (t.hooked) {
      const r = o.options[n] || t.hooks[n];
      return e.callback(r, [o.$context]);
    }
  }
  function tt(t, o, n) {
    const r = (function (t, o, n) {
      const r = o.axis,
        i = o.id,
        s = r + "ScaleID",
        a = {
          min: e.valueOrDefault(o.min, Number.NEGATIVE_INFINITY),
          max: e.valueOrDefault(o.max, Number.POSITIVE_INFINITY),
        };
      for (const e of n)
        e.scaleID === i
          ? rt(e, o, ["value", "endValue"], a)
          : E(t, e, s) === i &&
            rt(e, o, [r + "Min", r + "Max", r + "Value"], a);
      return a;
    })(t.scales, o, n);
    let i = et(o, r, "min", "suggestedMin");
    (i = et(o, r, "max", "suggestedMax") || i),
      i && e.isFunction(o.handleTickRangeOptions) && o.handleTickRangeOptions();
  }
  function et(t, o, n, r) {
    if (
      e.isFinite(o[n]) &&
      !(function (t, o, n) {
        return e.defined(t[o]) || e.defined(t[n]);
      })(t.options, n, r)
    ) {
      const e = t[n] !== o[n];
      return (t[n] = o[n]), e;
    }
  }
  function ot(t, e) {
    for (const o of ["scaleID", "xScaleID", "yScaleID"]) {
      const n = E(e, t, o);
      n &&
        !e[n] &&
        nt(t, o) &&
        console.warn(`No scale found with id '${n}' for annotation '${t.id}'`);
    }
  }
  function nt(t, o) {
    if ("scaleID" === o) return !0;
    const n = o.charAt(0);
    for (const o of ["Min", "Max", "Value"]) if (e.defined(t[n + o])) return !0;
    return !1;
  }
  function rt(t, o, n, r) {
    for (const i of n) {
      const n = t[i];
      if (e.defined(n)) {
        const t = o.parse(n);
        (r.min = Math.min(r.min, t)), (r.max = Math.max(r.max, t));
      }
    }
  }
  class it extends t.Element {
    inRange(t, o, n, r) {
      const { x: i, y: s } = $(
        { x: t, y: o },
        this.getCenterPoint(r),
        e.toRadians(-this.options.rotation),
      );
      return c(
        { x: i, y: s },
        this.getProps(["x", "y", "x2", "y2"], r),
        n,
        this.options.borderWidth,
      );
    }
    getCenterPoint(t) {
      return l(this, t);
    }
    draw(t) {
      t.save(),
        D(t, this.getCenterPoint(), this.options.rotation),
        O(t, this, this.options),
        t.restore();
    }
    get label() {
      return this.elements && this.elements[0];
    }
    resolveElementProperties(t, e) {
      return H(t, e);
    }
  }
  (it.id = "boxAnnotation"),
    (it.defaults = {
      adjustScaleRange: !0,
      backgroundShadowColor: "transparent",
      borderCapStyle: "butt",
      borderDash: [],
      borderDashOffset: 0,
      borderJoinStyle: "miter",
      borderRadius: 0,
      borderShadowColor: "transparent",
      borderWidth: 1,
      display: !0,
      init: void 0,
      label: {
        backgroundColor: "transparent",
        borderWidth: 0,
        callout: { display: !1 },
        color: "black",
        content: null,
        display: !1,
        drawTime: void 0,
        font: {
          family: void 0,
          lineHeight: void 0,
          size: void 0,
          style: void 0,
          weight: "bold",
        },
        height: void 0,
        opacity: void 0,
        padding: 6,
        position: "center",
        rotation: void 0,
        textAlign: "start",
        textStrokeColor: void 0,
        textStrokeWidth: 0,
        width: void 0,
        xAdjust: 0,
        yAdjust: 0,
        z: void 0,
      },
      rotation: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      xMax: void 0,
      xMin: void 0,
      xScaleID: void 0,
      yMax: void 0,
      yMin: void 0,
      yScaleID: void 0,
      z: 0,
    }),
    (it.defaultRoutes = { borderColor: "color", backgroundColor: "color" }),
    (it.descriptors = { label: { _fallback: !0 } });
  const st = ["left", "bottom", "top", "right"];
  class at extends t.Element {
    inRange(t, o, n, r) {
      const { x: i, y: s } = $(
        { x: t, y: o },
        this.getCenterPoint(r),
        e.toRadians(-this.rotation),
      );
      return c(
        { x: i, y: s },
        this.getProps(["x", "y", "x2", "y2"], r),
        n,
        this.options.borderWidth,
      );
    }
    getCenterPoint(t) {
      return l(this, t);
    }
    draw(t) {
      const o = this.options,
        n = !e.defined(this._visible) || this._visible;
      o.display &&
        o.content &&
        n &&
        (t.save(),
        D(t, this.getCenterPoint(), this.rotation),
        (function (t, o) {
          const { pointX: n, pointY: r, options: i } = o,
            s = i.callout,
            a =
              s &&
              s.display &&
              (function (t, o) {
                const n = o.position;
                if (st.includes(n)) return n;
                return (function (t, o) {
                  const {
                      x: n,
                      y: r,
                      x2: i,
                      y2: s,
                      width: a,
                      height: d,
                      pointX: c,
                      pointY: l,
                      centerX: h,
                      centerY: u,
                      rotation: f,
                    } = t,
                    x = { x: h, y: u },
                    y = o.start,
                    p = b(a, y),
                    g = b(d, y),
                    m = [n, n + p, n + p, i],
                    v = [r + g, s, r, s],
                    w = [];
                  for (let t = 0; t < 4; t++) {
                    const o = $({ x: m[t], y: v[t] }, x, e.toRadians(f));
                    w.push({
                      position: st[t],
                      distance: e.distanceBetweenPoints(o, { x: c, y: l }),
                    });
                  }
                  return w.sort((t, e) => t.distance - e.distance)[0].position;
                })(t, o);
              })(o, s);
          if (
            !a ||
            (function (t, e, o) {
              const { pointX: n, pointY: r } = t,
                i = e.margin;
              let s = n,
                a = r;
              "left" === o
                ? (s += i)
                : "right" === o
                  ? (s -= i)
                  : "top" === o
                    ? (a += i)
                    : "bottom" === o && (a -= i);
              return t.inRange(s, a);
            })(o, s, a)
          )
            return;
          t.save(), t.beginPath();
          const d = A(t, s);
          if (!d) return t.restore();
          const { separatorStart: c, separatorEnd: l } = (function (t, e) {
              const { x: o, y: n, x2: r, y2: i } = t,
                s = (function (t, e) {
                  const { width: o, height: n, options: r } = t,
                    i = r.callout.margin + r.borderWidth / 2;
                  if ("right" === e) return o + i;
                  if ("bottom" === e) return n + i;
                  return -i;
                })(t, e);
              let a, d;
              "left" === e || "right" === e
                ? ((a = { x: o + s, y: n }), (d = { x: a.x, y: i }))
                : ((a = { x: o, y: n + s }), (d = { x: r, y: a.y }));
              return { separatorStart: a, separatorEnd: d };
            })(o, a),
            { sideStart: h, sideEnd: u } = (function (t, e, o) {
              const { y: n, width: r, height: i, options: s } = t,
                a = s.callout.start,
                d = (function (t, e) {
                  const o = e.side;
                  if ("left" === t || "top" === t) return -o;
                  return o;
                })(e, s.callout);
              let c, l;
              "left" === e || "right" === e
                ? ((c = { x: o.x, y: n + b(i, a) }),
                  (l = { x: c.x + d, y: c.y }))
                : ((c = { x: o.x + b(r, a), y: o.y }),
                  (l = { x: c.x, y: c.y + d }));
              return { sideStart: c, sideEnd: l };
            })(o, a, c);
          (s.margin > 0 || 0 === i.borderWidth) &&
            (t.moveTo(c.x, c.y), t.lineTo(l.x, l.y));
          t.moveTo(h.x, h.y), t.lineTo(u.x, u.y);
          const f = $(
            { x: n, y: r },
            o.getCenterPoint(),
            e.toRadians(-o.rotation),
          );
          t.lineTo(f.x, f.y), t.stroke(), t.restore();
        })(t, this),
        O(t, this, o),
        T(
          t,
          (function ({ x: t, y: o, width: n, height: r, options: i }) {
            const s = i.borderWidth / 2,
              a = e.toPadding(i.padding);
            return {
              x: t + a.left + s,
              y: o + a.top + s,
              width: n - a.left - a.right - i.borderWidth,
              height: r - a.top - a.bottom - i.borderWidth,
            };
          })(this),
          o,
        ),
        t.restore());
    }
    resolveElementProperties(t, o) {
      let n;
      if (m(o)) n = _(t, o);
      else {
        const { centerX: e, centerY: r } = z(t, o);
        n = { x: e, y: r };
      }
      const r = e.toPadding(o.padding),
        i = (function (t, e, o, n) {
          const r = e.width + n.width + o.borderWidth,
            i = e.height + n.height + o.borderWidth,
            s = g(o.position, "center"),
            a = dt(t.x, r, o.xAdjust, s.x),
            d = dt(t.y, i, o.yAdjust, s.y);
          return {
            x: a,
            y: d,
            x2: a + r,
            y2: d + i,
            width: r,
            height: i,
            centerX: a + r / 2,
            centerY: d + i / 2,
          };
        })(n, I(t.ctx, o), o, r);
      return {
        initProperties: v(t, i, o),
        pointX: n.x,
        pointY: n.y,
        ...i,
        rotation: o.rotation,
      };
    }
  }
  function dt(t, e, o = 0, n) {
    return t - p(e, n) + o;
  }
  (at.id = "labelAnnotation"),
    (at.defaults = {
      adjustScaleRange: !0,
      backgroundColor: "transparent",
      backgroundShadowColor: "transparent",
      borderCapStyle: "butt",
      borderDash: [],
      borderDashOffset: 0,
      borderJoinStyle: "miter",
      borderRadius: 0,
      borderShadowColor: "transparent",
      borderWidth: 0,
      callout: {
        borderCapStyle: "butt",
        borderColor: void 0,
        borderDash: [],
        borderDashOffset: 0,
        borderJoinStyle: "miter",
        borderWidth: 1,
        display: !1,
        margin: 5,
        position: "auto",
        side: 5,
        start: "50%",
      },
      color: "black",
      content: null,
      display: !0,
      font: {
        family: void 0,
        lineHeight: void 0,
        size: void 0,
        style: void 0,
        weight: void 0,
      },
      height: void 0,
      init: void 0,
      opacity: void 0,
      padding: 6,
      position: "center",
      rotation: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: "center",
      textStrokeColor: void 0,
      textStrokeWidth: 0,
      width: void 0,
      xAdjust: 0,
      xMax: void 0,
      xMin: void 0,
      xScaleID: void 0,
      xValue: void 0,
      yAdjust: 0,
      yMax: void 0,
      yMin: void 0,
      yScaleID: void 0,
      yValue: void 0,
      z: 0,
    }),
    (at.defaultRoutes = { borderColor: "color" });
  const ct = (t, e, o) => ({
      x: t.x + o * (e.x - t.x),
      y: t.y + o * (e.y - t.y),
    }),
    lt = (t, e, o) => ct(e, o, Math.abs((t - e.y) / (o.y - e.y))).x,
    ht = (t, e, o) => ct(e, o, Math.abs((t - e.x) / (o.x - e.x))).y,
    ut = (t) => t * t,
    ft = (t, e, { x: o, y: n, x2: r, y2: i }, s) =>
      "y" === s
        ? { start: Math.min(n, i), end: Math.max(n, i), value: e }
        : { start: Math.min(o, r), end: Math.max(o, r), value: t },
    xt = (t, e, o, n) =>
      (1 - n) * (1 - n) * t + 2 * (1 - n) * n * e + n * n * o,
    yt = (t, e, o, n) => ({ x: xt(t.x, e.x, o.x, n), y: xt(t.y, e.y, o.y, n) }),
    pt = (t, e, o, n) => 2 * (1 - n) * (e - t) + 2 * n * (o - e),
    bt = (t, o, n, r) =>
      -Math.atan2(pt(t.x, o.x, n.x, r), pt(t.y, o.y, n.y, r)) + 0.5 * e.PI;
  class gt extends t.Element {
    inRange(t, e, o, n) {
      const r = this.options.borderWidth / 2;
      if ("x" !== o && "y" !== o) {
        const o = { mouseX: t, mouseY: e },
          { path: i, ctx: a } = this;
        if (i) {
          A(a, this.options);
          const { chart: r } = this.$context,
            s = t * r.currentDevicePixelRatio,
            d = e * r.currentDevicePixelRatio,
            c = a.isPointInStroke(i, s, d) || wt(this, o, n);
          return a.restore(), c;
        }
        return (
          (function (t, { mouseX: e, mouseY: o }, n = s, r) {
            const {
                x: i,
                y: a,
                x2: d,
                y2: c,
              } = t.getProps(["x", "y", "x2", "y2"], r),
              l = d - i,
              h = c - a,
              u = ut(l) + ut(h),
              f = 0 === u ? -1 : ((e - i) * l + (o - a) * h) / u;
            let x, y;
            f < 0
              ? ((x = i), (y = a))
              : f > 1
                ? ((x = d), (y = c))
                : ((x = i + f * l), (y = a + f * h));
            return ut(e - x) + ut(o - y) <= n;
          })(this, o, ut(r), n) || wt(this, o, n)
        );
      }
      return (function (
        t,
        { mouseX: e, mouseY: o },
        n,
        { hBorderWidth: r, useFinalPosition: i },
      ) {
        const s = ft(e, o, t.getProps(["x", "y", "x2", "y2"], i), n);
        return (
          (s.value >= s.start - r && s.value <= s.end + r) ||
          wt(t, { mouseX: e, mouseY: o }, i, n)
        );
      })(this, { mouseX: t, mouseY: e }, o, {
        hBorderWidth: r,
        useFinalPosition: n,
      });
    }
    getCenterPoint(t) {
      return l(this, t);
    }
    draw(t) {
      const { x: o, y: n, x2: r, y2: i, cp: s, options: a } = this;
      if ((t.save(), !A(t, a))) return t.restore();
      j(t, a);
      const d = Math.sqrt(Math.pow(r - o, 2) + Math.pow(i - n, 2));
      if (a.curve && s)
        return (
          (function (t, o, n, r) {
            const { x: i, y: s, x2: a, y2: d, options: c } = o,
              {
                startOpts: l,
                endOpts: h,
                startAdjust: u,
                endAdjust: f,
              } = St(o),
              x = { x: i, y: s },
              y = { x: a, y: d },
              p = bt(x, n, y, 0),
              b = bt(x, n, y, 1) - e.PI,
              g = yt(x, n, y, u / r),
              m = yt(x, n, y, 1 - f / r),
              v = new Path2D();
            t.beginPath(),
              v.moveTo(g.x, g.y),
              v.quadraticCurveTo(n.x, n.y, m.x, m.y),
              (t.shadowColor = c.borderShadowColor),
              t.stroke(v),
              (o.path = v),
              (o.ctx = t),
              Dt(t, g, { angle: p, adjust: u }, l),
              Dt(t, m, { angle: b, adjust: f }, h);
          })(t, this, s, d),
          t.restore()
        );
      const {
          startOpts: c,
          endOpts: l,
          startAdjust: h,
          endAdjust: u,
        } = St(this),
        f = Math.atan2(i - n, r - o);
      t.translate(o, n),
        t.rotate(f),
        t.beginPath(),
        t.moveTo(0 + h, 0),
        t.lineTo(d - u, 0),
        (t.shadowColor = a.borderShadowColor),
        t.stroke(),
        kt(t, 0, h, c),
        kt(t, d, -u, l),
        t.restore();
    }
    get label() {
      return this.elements && this.elements[0];
    }
    resolveElementProperties(t, o) {
      const n = N(t, o),
        { x: r, y: i, x2: s, y2: a } = n,
        d = (function (
          { x: t, y: e, x2: o, y2: n },
          { top: r, right: i, bottom: s, left: a },
        ) {
          return !(
            (t < a && o < a) ||
            (t > i && o > i) ||
            (e < r && n < r) ||
            (e > s && n > s)
          );
        })(n, t.chartArea),
        c = d
          ? (function (t, e, o) {
              const { x: n, y: r } = vt(t, e, o),
                { x: i, y: s } = vt(e, t, o);
              return {
                x: n,
                y: r,
                x2: i,
                y2: s,
                width: Math.abs(i - n),
                height: Math.abs(s - r),
              };
            })({ x: r, y: i }, { x: s, y: a }, t.chartArea)
          : {
              x: r,
              y: i,
              x2: s,
              y2: a,
              width: Math.abs(s - r),
              height: Math.abs(a - i),
            };
      if (
        ((c.centerX = (s + r) / 2),
        (c.centerY = (a + i) / 2),
        (c.initProperties = v(t, c, o)),
        o.curve)
      ) {
        const t = { x: c.x, y: c.y },
          n = { x: c.x2, y: c.y2 };
        c.cp = (function (t, e, o) {
          const { x: n, y: r, x2: i, y2: s, centerX: a, centerY: d } = t,
            c = Math.atan2(s - r, i - n),
            l = g(e.controlPoint, 0);
          return $(
            { x: a + b(o, l.x, !1), y: d + b(o, l.y, !1) },
            { x: a, y: d },
            c,
          );
        })(c, o, e.distanceBetweenPoints(t, n));
      }
      const l = (function (t, o, n) {
        const r = n.borderWidth,
          i = e.toPadding(n.padding),
          s = I(t.ctx, n),
          a = s.width + i.width + r,
          d = s.height + i.height + r;
        return (function (t, o, n, r) {
          const { width: i, height: s, padding: a } = n,
            { xAdjust: d, yAdjust: c } = o,
            l = { x: t.x, y: t.y },
            h = { x: t.x2, y: t.y2 },
            u =
              "auto" === o.rotation
                ? (function (t) {
                    const { x: o, y: n, x2: r, y2: i } = t,
                      s = Math.atan2(i - n, r - o);
                    return s > e.PI / 2
                      ? s - e.PI
                      : s < e.PI / -2
                        ? s + e.PI
                        : s;
                  })(t)
                : e.toRadians(o.rotation),
            f = (function (t, e, o) {
              const n = Math.cos(o),
                r = Math.sin(o);
              return {
                w: Math.abs(t * n) + Math.abs(e * r),
                h: Math.abs(t * r) + Math.abs(e * n),
              };
            })(i, s, u),
            x = (function (t, e, o, n) {
              let r;
              const i = (function (t, e) {
                const { x: o, x2: n, y: r, y2: i } = t,
                  s = Math.min(r, i) - e.top,
                  a = Math.min(o, n) - e.left,
                  d = e.bottom - Math.max(r, i),
                  c = e.right - Math.max(o, n);
                return {
                  x: Math.min(a, c),
                  y: Math.min(s, d),
                  dx: a <= c ? 1 : -1,
                  dy: s <= d ? 1 : -1,
                };
              })(t, n);
              r =
                "start" === e.position
                  ? Mt({ w: t.x2 - t.x, h: t.y2 - t.y }, o, e, i)
                  : "end" === e.position
                    ? 1 - Mt({ w: t.x - t.x2, h: t.y - t.y2 }, o, e, i)
                    : p(1, e.position);
              return r;
            })(t, o, { labelSize: f, padding: a }, r),
            y = t.cp ? yt(l, t.cp, h, x) : ct(l, h, x),
            b = { size: f.w, min: r.left, max: r.right, padding: a.left },
            g = { size: f.h, min: r.top, max: r.bottom, padding: a.top },
            m = Pt(y.x, b) + d,
            v = Pt(y.y, g) + c;
          return {
            x: m - i / 2,
            y: v - s / 2,
            x2: m + i / 2,
            y2: v + s / 2,
            centerX: m,
            centerY: v,
            pointX: y.x,
            pointY: y.y,
            width: i,
            height: s,
            rotation: e.toDegrees(u),
          };
        })(o, n, { width: a, height: d, padding: i }, t.chartArea);
      })(t, c, o.label);
      return (
        (l._visible = d),
        (c.elements = [
          {
            type: "label",
            optionScope: "label",
            properties: l,
            initProperties: c.initProperties,
          },
        ]),
        c
      );
    }
  }
  gt.id = "lineAnnotation";
  const mt = {
    backgroundColor: void 0,
    backgroundShadowColor: void 0,
    borderColor: void 0,
    borderDash: void 0,
    borderDashOffset: void 0,
    borderShadowColor: void 0,
    borderWidth: void 0,
    display: void 0,
    fill: void 0,
    length: void 0,
    shadowBlur: void 0,
    shadowOffsetX: void 0,
    shadowOffsetY: void 0,
    width: void 0,
  };
  function vt({ x: t, y: e }, o, { top: n, right: r, bottom: i, left: s }) {
    return (
      t < s && ((e = ht(s, { x: t, y: e }, o)), (t = s)),
      t > r && ((e = ht(r, { x: t, y: e }, o)), (t = r)),
      e < n && ((t = lt(n, { x: t, y: e }, o)), (e = n)),
      e > i && ((t = lt(i, { x: t, y: e }, o)), (e = i)),
      { x: t, y: e }
    );
  }
  function wt(t, { mouseX: e, mouseY: o }, n, r) {
    const i = t.label;
    return i.options.display && i.inRange(e, o, r, n);
  }
  function Mt(t, e, o, n) {
    const { labelSize: r, padding: i } = e,
      s = t.w * n.dx,
      d = t.h * n.dy,
      c = s > 0 && (r.w / 2 + i.left - n.x) / s,
      l = d > 0 && (r.h / 2 + i.top - n.y) / d;
    return a(Math.max(c, l), 0, 0.25);
  }
  function Pt(t, e) {
    const { size: o, min: n, max: r, padding: i } = e,
      s = o / 2;
    return o > r - n
      ? (r + n) / 2
      : (n >= t - i - s && (t = n + i + s),
        r <= t + i + s && (t = r - i - s),
        t);
  }
  function St(t) {
    const e = t.options,
      o = e.arrowHeads && e.arrowHeads.start,
      n = e.arrowHeads && e.arrowHeads.end;
    return {
      startOpts: o,
      endOpts: n,
      startAdjust: Ct(t, o),
      endAdjust: Ct(t, n),
    };
  }
  function Ct(t, e) {
    if (!e || !e.display) return 0;
    const { length: o, width: n } = e,
      r = t.options.borderWidth / 2,
      i = { x: o, y: n + r },
      s = { x: 0, y: r };
    return Math.abs(lt(0, i, s));
  }
  function kt(t, e, o, n) {
    if (!n || !n.display) return;
    const {
        length: r,
        width: i,
        fill: s,
        backgroundColor: a,
        borderColor: d,
      } = n,
      c = Math.abs(e - r) + o;
    t.beginPath(),
      j(t, n),
      A(t, n),
      t.moveTo(c, -i),
      t.lineTo(e + o, 0),
      t.lineTo(c, i),
      !0 === s
        ? ((t.fillStyle = a || d),
          t.closePath(),
          t.fill(),
          (t.shadowColor = "transparent"))
        : (t.shadowColor = n.borderShadowColor),
      t.stroke();
  }
  function Dt(t, { x: e, y: o }, { angle: n, adjust: r }, i) {
    i &&
      i.display &&
      (t.save(), t.translate(e, o), t.rotate(n), kt(t, 0, -r, i), t.restore());
  }
  (gt.defaults = {
    adjustScaleRange: !0,
    arrowHeads: {
      display: !1,
      end: Object.assign({}, mt),
      fill: !1,
      length: 12,
      start: Object.assign({}, mt),
      width: 6,
    },
    borderDash: [],
    borderDashOffset: 0,
    borderShadowColor: "transparent",
    borderWidth: 2,
    curve: !1,
    controlPoint: { y: "-50%" },
    display: !0,
    endValue: void 0,
    init: void 0,
    label: {
      backgroundColor: "rgba(0,0,0,0.8)",
      backgroundShadowColor: "transparent",
      borderCapStyle: "butt",
      borderColor: "black",
      borderDash: [],
      borderDashOffset: 0,
      borderJoinStyle: "miter",
      borderRadius: 6,
      borderShadowColor: "transparent",
      borderWidth: 0,
      callout: Object.assign({}, at.defaults.callout),
      color: "#fff",
      content: null,
      display: !1,
      drawTime: void 0,
      font: {
        family: void 0,
        lineHeight: void 0,
        size: void 0,
        style: void 0,
        weight: "bold",
      },
      height: void 0,
      opacity: void 0,
      padding: 6,
      position: "center",
      rotation: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: "center",
      textStrokeColor: void 0,
      textStrokeWidth: 0,
      width: void 0,
      xAdjust: 0,
      yAdjust: 0,
      z: void 0,
    },
    scaleID: void 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    value: void 0,
    xMax: void 0,
    xMin: void 0,
    xScaleID: void 0,
    yMax: void 0,
    yMin: void 0,
    yScaleID: void 0,
    z: 0,
  }),
    (gt.descriptors = {
      arrowHeads: {
        start: { _fallback: !0 },
        end: { _fallback: !0 },
        _fallback: !0,
      },
    }),
    (gt.defaultRoutes = { borderColor: "color" });
  class At extends t.Element {
    inRange(t, o, n, r) {
      const i = this.options.rotation,
        a = this.options.borderWidth;
      if ("x" !== n && "y" !== n)
        return (function (t, o, n, r) {
          const { width: i, height: s, centerX: a, centerY: d } = o,
            c = i / 2,
            l = s / 2;
          if (c <= 0 || l <= 0) return !1;
          const h = e.toRadians(n || 0),
            u = r / 2 || 0,
            f = Math.cos(h),
            x = Math.sin(h),
            y = Math.pow(f * (t.x - a) + x * (t.y - d), 2),
            p = Math.pow(x * (t.x - a) - f * (t.y - d), 2);
          return y / Math.pow(c + u, 2) + p / Math.pow(l + u, 2) <= 1.0001;
        })(
          { x: t, y: o },
          this.getProps(["width", "height", "centerX", "centerY"], r),
          i,
          a,
        );
      const {
          x: d,
          y: c,
          x2: l,
          y2: h,
        } = this.getProps(["x", "y", "x2", "y2"], r),
        u = a / 2,
        f = "y" === n ? { start: c, end: h } : { start: d, end: l },
        x = $({ x: t, y: o }, this.getCenterPoint(r), e.toRadians(-i));
      return x[n] >= f.start - u - s && x[n] <= f.end + u + s;
    }
    getCenterPoint(t) {
      return l(this, t);
    }
    draw(t) {
      const { width: o, height: n, centerX: r, centerY: i, options: s } = this;
      t.save(),
        D(t, this.getCenterPoint(), s.rotation),
        j(t, this.options),
        t.beginPath(),
        (t.fillStyle = s.backgroundColor);
      const a = A(t, s);
      t.ellipse(r, i, n / 2, o / 2, e.PI / 2, 0, 2 * e.PI),
        t.fill(),
        a && ((t.shadowColor = s.borderShadowColor), t.stroke()),
        t.restore();
    }
    get label() {
      return this.elements && this.elements[0];
    }
    resolveElementProperties(t, e) {
      return H(t, e);
    }
  }
  (At.id = "ellipseAnnotation"),
    (At.defaults = {
      adjustScaleRange: !0,
      backgroundShadowColor: "transparent",
      borderDash: [],
      borderDashOffset: 0,
      borderShadowColor: "transparent",
      borderWidth: 1,
      display: !0,
      init: void 0,
      label: Object.assign({}, it.defaults.label),
      rotation: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      xMax: void 0,
      xMin: void 0,
      xScaleID: void 0,
      yMax: void 0,
      yMin: void 0,
      yScaleID: void 0,
      z: 0,
    }),
    (At.defaultRoutes = { borderColor: "color", backgroundColor: "color" }),
    (At.descriptors = { label: { _fallback: !0 } });
  class jt extends t.Element {
    inRange(t, e, o, n) {
      const {
          x: r,
          y: i,
          x2: s,
          y2: a,
          width: d,
        } = this.getProps(["x", "y", "x2", "y2", "width"], n),
        c = this.options.borderWidth;
      if ("x" !== o && "y" !== o)
        return (function (t, e, o, n) {
          if (!t || !e || o <= 0) return !1;
          const r = n / 2;
          return (
            Math.pow(t.x - e.x, 2) + Math.pow(t.y - e.y, 2) <=
            Math.pow(o + r, 2)
          );
        })({ x: t, y: e }, this.getCenterPoint(n), d / 2, c);
      const l = c / 2,
        h =
          "y" === o
            ? { start: i, end: a, value: e }
            : { start: r, end: s, value: t };
      return h.value >= h.start - l && h.value <= h.end + l;
    }
    getCenterPoint(t) {
      return l(this, t);
    }
    draw(t) {
      const e = this.options,
        o = e.borderWidth;
      if (e.radius < 0.1) return;
      t.save(), (t.fillStyle = e.backgroundColor), j(t, e);
      const n = A(t, e);
      R(t, this, this.centerX, this.centerY),
        n &&
          !k(e.pointStyle) &&
          ((t.shadowColor = e.borderShadowColor), t.stroke()),
        t.restore(),
        (e.borderWidth = o);
    }
    resolveElementProperties(t, e) {
      const o = F(t, e);
      return (o.initProperties = v(t, o, e)), o;
    }
  }
  (jt.id = "pointAnnotation"),
    (jt.defaults = {
      adjustScaleRange: !0,
      backgroundShadowColor: "transparent",
      borderDash: [],
      borderDashOffset: 0,
      borderShadowColor: "transparent",
      borderWidth: 1,
      display: !0,
      init: void 0,
      pointStyle: "circle",
      radius: 10,
      rotation: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      xAdjust: 0,
      xMax: void 0,
      xMin: void 0,
      xScaleID: void 0,
      xValue: void 0,
      yAdjust: 0,
      yMax: void 0,
      yMin: void 0,
      yScaleID: void 0,
      yValue: void 0,
      z: 0,
    }),
    (jt.defaultRoutes = { borderColor: "color", backgroundColor: "color" });
  class It extends t.Element {
    inRange(t, o, n, r) {
      if ("x" !== n && "y" !== n)
        return (
          this.options.radius >= 0.1 &&
          this.elements.length > 1 &&
          (function (t, e, o, n) {
            let r = !1,
              i = t[t.length - 1].getProps(["bX", "bY"], n);
            for (const s of t) {
              const t = s.getProps(["bX", "bY"], n);
              t.bY > o != i.bY > o &&
                e < ((i.bX - t.bX) * (o - t.bY)) / (i.bY - t.bY) + t.bX &&
                (r = !r),
                (i = t);
            }
            return r;
          })(this.elements, t, o, r)
        );
      const i = $(
          { x: t, y: o },
          this.getCenterPoint(r),
          e.toRadians(-this.options.rotation),
        ),
        s = this.elements.map((t) => ("y" === n ? t.bY : t.bX)),
        a = Math.min(...s),
        d = Math.max(...s);
      return i[n] >= a && i[n] <= d;
    }
    getCenterPoint(t) {
      return l(this, t);
    }
    draw(t) {
      const { elements: e, options: o } = this;
      t.save(), t.beginPath(), (t.fillStyle = o.backgroundColor), j(t, o);
      const n = A(t, o);
      let r = !0;
      for (const o of e)
        r ? (t.moveTo(o.x, o.y), (r = !1)) : t.lineTo(o.x, o.y);
      t.closePath(),
        t.fill(),
        n && ((t.shadowColor = o.borderShadowColor), t.stroke()),
        t.restore();
    }
    resolveElementProperties(t, o) {
      const n = F(t, o),
        { sides: r, rotation: i } = o,
        s = [],
        a = (2 * e.PI) / r;
      let d = i * e.RAD_PER_DEG;
      for (let e = 0; e < r; e++, d += a) {
        const e = Ot(n, o, d);
        (e.initProperties = v(t, n, o)), s.push(e);
      }
      return (n.elements = s), n;
    }
  }
  function Ot({ centerX: t, centerY: e }, { radius: o, borderWidth: n }, r) {
    const i = n / 2,
      s = Math.sin(r),
      a = Math.cos(r),
      d = { x: t + s * o, y: e - a * o };
    return {
      type: "point",
      optionScope: "point",
      properties: {
        x: d.x,
        y: d.y,
        centerX: d.x,
        centerY: d.y,
        bX: t + s * (o + i),
        bY: e - a * (o + i),
      },
    };
  }
  (It.id = "polygonAnnotation"),
    (It.defaults = {
      adjustScaleRange: !0,
      backgroundShadowColor: "transparent",
      borderCapStyle: "butt",
      borderDash: [],
      borderDashOffset: 0,
      borderJoinStyle: "miter",
      borderShadowColor: "transparent",
      borderWidth: 1,
      display: !0,
      init: void 0,
      point: { radius: 0 },
      radius: 10,
      rotation: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      sides: 3,
      xAdjust: 0,
      xMax: void 0,
      xMin: void 0,
      xScaleID: void 0,
      xValue: void 0,
      yAdjust: 0,
      yMax: void 0,
      yMin: void 0,
      yScaleID: void 0,
      yValue: void 0,
      z: 0,
    }),
    (It.defaultRoutes = { borderColor: "color", backgroundColor: "color" });
  const Tt = {
    box: it,
    ellipse: At,
    label: at,
    line: gt,
    point: jt,
    polygon: It,
  };
  Object.keys(Tt).forEach((e) => {
    t.defaults.describe(`elements.${Tt[e].id}`, {
      _fallback: "plugins.annotation.common",
    });
  });
  const Rt = { update: Object.assign },
    Yt = J.concat(K),
    Xt = (t, o) => (e.isObject(o) ? Vt(t, o) : t),
    Et = (t) => "color" === t || "font" === t;
  function Wt(t = "line") {
    return Tt[t]
      ? t
      : (console.warn(`Unknown annotation type: '${t}', defaulting to 'line'`),
        "line");
  }
  function _t(o, n, r, i) {
    const s = (function (e, o, n) {
        if ("reset" === n || "none" === n || "resize" === n) return Rt;
        return new t.Animations(e, o);
      })(o, r.animations, i),
      a = n.annotations,
      d = (function (t, e) {
        const o = e.length,
          n = t.length;
        if (n < o) {
          const e = o - n;
          t.splice(n, 0, ...new Array(e));
        } else n > o && t.splice(o, n - o);
        return t;
      })(n.elements, a);
    for (let t = 0; t < a.length; t++) {
      const n = a[t],
        r = Nt(d, t, n.type),
        i = n.setContext(Bt(o, r, n)),
        c = r.resolveElementProperties(o, i);
      (c.skip = zt(c)),
        "elements" in c && (Ft(r, c.elements, i, s), delete c.elements),
        e.defined(r.x) || Object.assign(r, c),
        Object.assign(r, c.initProperties),
        (c.options = Ht(i)),
        s.update(r, c);
    }
  }
  function zt(t) {
    return isNaN(t.x) || isNaN(t.y);
  }
  function Ft(t, e, o, n) {
    const r = t.elements || (t.elements = []);
    r.length = e.length;
    for (let t = 0; t < e.length; t++) {
      const i = e[t],
        s = i.properties,
        a = Nt(r, t, i.type, i.initProperties),
        d = o[i.optionScope].override(i);
      (s.options = Ht(d)), n.update(a, s);
    }
  }
  function Nt(t, e, o, n) {
    const r = Tt[Wt(o)];
    let i = t[e];
    return (
      (i && i instanceof r) || ((i = t[e] = new r()), Object.assign(i, n)), i
    );
  }
  function Ht(t) {
    const e = Tt[Wt(t.type)],
      o = {};
    (o.id = t.id),
      (o.type = t.type),
      (o.drawTime = t.drawTime),
      Object.assign(o, Vt(t, e.defaults), Vt(t, e.defaultRoutes));
    for (const e of Yt) o[e] = t[e];
    return o;
  }
  function Vt(t, o) {
    const n = {};
    for (const r of Object.keys(o)) {
      const i = o[r],
        s = t[r];
      Et(r) && e.isArray(s)
        ? (n[r] = s.map((t) => Xt(t, i)))
        : (n[r] = Xt(s, i));
    }
    return n;
  }
  function Bt(t, e, o) {
    return (
      e.$context ||
      (e.$context = Object.assign(Object.create(t.getContext()), {
        element: e,
        id: o.id,
        type: "annotation",
      }))
    );
  }
  const Lt = new Map(),
    $t = J.concat(K);
  var Ut = {
    id: "annotation",
    version: "3.0.1",
    beforeRegister() {
      !(function (t, e, o, n = !0) {
        const r = o.split(".");
        let s = 0;
        for (const a of e.split(".")) {
          const d = r[s++];
          if (parseInt(a, 10) < parseInt(d, 10)) break;
          if (i(d, a)) {
            if (n)
              throw new Error(
                `${t} v${o} is not supported. v${e} or newer is required.`,
              );
            return !1;
          }
        }
      })("chart.js", "4.0", t.Chart.version);
    },
    afterRegister() {
      t.Chart.register(Tt);
    },
    afterUnregister() {
      t.Chart.unregister(Tt);
    },
    beforeInit(t) {
      Lt.set(t, {
        annotations: [],
        elements: [],
        visibleElements: [],
        listeners: {},
        listened: !1,
        moveListened: !1,
        hooks: {},
        hooked: !1,
        hovered: [],
      });
    },
    beforeUpdate(t, o, n) {
      const r = (Lt.get(t).annotations = []);
      let i = n.annotations;
      e.isObject(i)
        ? Object.keys(i).forEach((t) => {
            const o = i[t];
            e.isObject(o) && ((o.id = t), r.push(o));
          })
        : e.isArray(i) && r.push(...i),
        (function (t, e) {
          for (const o of t) ot(o, e);
        })(r, t.scales);
    },
    afterDataLimits(t, e) {
      const o = Lt.get(t);
      tt(
        t,
        e.scale,
        o.annotations.filter((t) => t.display && t.adjustScaleRange),
      );
    },
    afterUpdate(t, o, r) {
      const i = Lt.get(t);
      !(function (t, o, r) {
        (o.listened = w(r, J, o.listeners)),
          (o.moveListened = !1),
          (o._getElements = n),
          U.forEach((t) => {
            e.isFunction(r[t]) && (o.moveListened = !0);
          }),
          (o.listened && o.moveListened) ||
            o.annotations.forEach((t) => {
              !o.listened && e.isFunction(t.click) && (o.listened = !0),
                o.moveListened ||
                  U.forEach((n) => {
                    e.isFunction(t[n]) &&
                      ((o.listened = !0), (o.moveListened = !0));
                  });
            });
      })(0, i, r),
        _t(t, i, r, o.mode),
        (i.visibleElements = i.elements.filter(
          (t) => !t.skip && t.options.display,
        )),
        (function (t, o, n) {
          const r = o.visibleElements;
          (o.hooked = w(n, K, o.hooks)),
            o.hooked ||
              r.forEach((t) => {
                o.hooked ||
                  K.forEach((n) => {
                    e.isFunction(t.options[n]) && (o.hooked = !0);
                  });
              });
        })(0, i, r);
    },
    beforeDatasetsDraw(t, e, o) {
      Jt(t, "beforeDatasetsDraw", o.clip);
    },
    afterDatasetsDraw(t, e, o) {
      Jt(t, "afterDatasetsDraw", o.clip);
    },
    beforeDraw(t, e, o) {
      Jt(t, "beforeDraw", o.clip);
    },
    afterDraw(t, e, o) {
      Jt(t, "afterDraw", o.clip);
    },
    beforeEvent(t, e, o) {
      Q(Lt.get(t), e.event, o) && (e.changed = !0);
    },
    afterDestroy(t) {
      Lt.delete(t);
    },
    _getState: (t) => Lt.get(t),
    defaults: {
      animations: {
        numbers: {
          properties: [
            "x",
            "y",
            "x2",
            "y2",
            "width",
            "height",
            "centerX",
            "centerY",
            "pointX",
            "pointY",
            "radius",
          ],
          type: "number",
        },
      },
      clip: !0,
      interaction: { mode: void 0, axis: void 0, intersect: void 0 },
      common: { drawTime: "afterDatasetsDraw", init: !1, label: {} },
    },
    descriptors: {
      _indexable: !1,
      _scriptable: (t) => !$t.includes(t) && "init" !== t,
      annotations: {
        _allKeys: !1,
        _fallback: (t, e) => `elements.${Tt[Wt(e.type)].id}`,
      },
      interaction: { _fallback: !0 },
      common: { label: { _indexable: Et, _fallback: !0 }, _indexable: Et },
    },
    additionalOptionScopes: [""],
  };
  function Jt(t, o, n) {
    const { ctx: r, chartArea: i } = t,
      s = Lt.get(t);
    n && e.clipArea(r, i);
    const a = (function (t, e) {
      const o = [];
      for (const n of t)
        if (
          (n.options.drawTime === e && o.push({ element: n, main: !0 }),
          n.elements && n.elements.length)
        )
          for (const t of n.elements)
            t.options.display &&
              t.options.drawTime === e &&
              o.push({ element: t });
      return o;
    })(s.visibleElements, o).sort(
      (t, e) => t.element.options.z - e.element.options.z,
    );
    for (const t of a) Qt(r, i, s, t);
    n && e.unclipArea(r);
  }
  function Qt(t, e, o, n) {
    const r = n.element;
    n.main
      ? (Z(o, r, "beforeDraw"), r.draw(t, e), Z(o, r, "afterDraw"))
      : r.draw(t, e);
  }
  return t.Chart.register(Ut), Ut;
});
