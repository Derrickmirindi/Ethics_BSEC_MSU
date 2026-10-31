/* BSEC 3D motion background: a flowing point field ("harbor") under a drifting
   network of nodes ("partners"), drawn with raw WebGL behind the page content.
   No dependencies. Respects prefers-reduced-motion and the site's light/dark theme. */
(() => {
  const canvas = document.getElementById("bg-motion");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) { canvas.remove(); return; }

  const root = document.documentElement;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const FIELD_VS = `
    attribute vec2 aGrid;
    uniform mat4 uProj, uView;
    uniform float uTime, uFlow, uSize, uDpr;
    varying float vH, vFog;
    float surface(vec2 p, float t) {
      float h = sin(p.x * 0.42 + t * 0.55) * 0.42
              + sin(p.y * 0.55 - t * 0.40) * 0.30
              + sin((p.x + p.y) * 0.9 + t * 0.75) * 0.12;
      vec2 c = vec2(4.0 * sin(t * 0.07), -6.0 + 3.0 * cos(t * 0.05));
      float r = length(p - c);
      return h + sin(r * 1.6 - t * 1.3) * 0.22 * exp(-r * 0.16);
    }
    void main() {
      float z = mod(aGrid.y + uFlow, 30.0) - 23.0;
      vec2 p = vec2(aGrid.x, z);
      float h = surface(p, uTime);
      vec4 view = uView * vec4(p.x, h, p.y, 1.0);
      gl_Position = uProj * view;
      float depth = max(-view.z, 0.1);
      gl_PointSize = max(1.0, uSize * uDpr * (0.85 + h * 0.6) * (8.0 / depth));
      vH = h;
      vFog = smoothstep(30.0, 9.0, depth) * smoothstep(1.5, 4.0, depth);
    }`;

  const FIELD_FS = `
    precision mediump float;
    uniform vec3 uBase, uCrest;
    uniform float uAlpha;
    varying float vH, vFog;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = dot(c, c);
      if (d > 0.25) discard;
      float k = smoothstep(0.05, 0.75, vH);
      float a = uAlpha * vFog * (0.35 + 0.9 * k) * smoothstep(0.25, 0.08, d);
      gl_FragColor = vec4(mix(uBase, uCrest, k) * a, a);
    }`;

  const NET_VS = `
    attribute vec4 aPos; // xyz + alpha
    uniform mat4 uProj, uView;
    uniform float uSize, uDpr;
    varying float vA;
    void main() {
      vec4 view = uView * vec4(aPos.xyz, 1.0);
      gl_Position = uProj * view;
      float depth = max(-view.z, 0.1);
      gl_PointSize = max(1.0, uSize * uDpr * (8.0 / depth));
      vA = aPos.w * smoothstep(32.0, 9.0, depth);
    }`;

  const NET_FS = `
    precision mediump float;
    uniform vec3 uColor;
    uniform float uAlpha, uRound;
    varying float vA;
    void main() {
      float a = uAlpha * vA;
      if (uRound > 0.5) {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        a *= smoothstep(0.5, 0.0, d) * (0.55 + 0.45 * smoothstep(0.2, 0.0, d));
      }
      gl_FragColor = vec4(uColor * a, a);
    }`;

  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let field, net;
  try {
    field = program(FIELD_VS, FIELD_FS);
    net = program(NET_VS, NET_FS);
  } catch (err) {
    console.warn("bg-motion disabled:", err);
    canvas.remove();
    return;
  }

  // Point field: a grid spanning x in [-16, 16] and a 30-unit band that streams toward the viewer.
  const small = innerWidth < 700;
  const GX = small ? 96 : 160, GZ = small ? 80 : 130;
  const grid = new Float32Array(GX * GZ * 2);
  for (let j = 0, k = 0; j < GZ; j++) {
    for (let i = 0; i < GX; i++) {
      grid[k++] = -16 + (32 * i) / (GX - 1);
      grid[k++] = (30 * j) / GZ;
    }
  }
  const gridBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);

  // Partner network: nodes drift on slow Lissajous paths; nearby nodes link up.
  const N = small ? 22 : 36, LINK = 4.6;
  const nodes = Array.from({ length: N }, (_, i) => ({
    x: -11 + 22 * Math.random(), y: 1.0 + 3.6 * Math.random(), z: -16 + 16 * Math.random(),
    ph: i * 2.399, sp: 0.12 + 0.12 * Math.random(),
  }));
  const pos = new Float32Array(N * 4);
  const lines = new Float32Array(N * (N - 1) * 4);
  const nodeBuf = gl.createBuffer();
  const lineBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pos.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
  gl.bufferData(gl.ARRAY_BUFFER, lines.byteLength, gl.DYNAMIC_DRAW);

  const PALETTES = {
    light: { base: [0.09, 0.09, 0.1], crest: [0.86, 0.6, 0.0], field: 0.85, net: [0.72, 0.5, 0.0], lineA: 0.6, nodeA: 0.95, additive: false },
    dark: { base: [0.78, 0.78, 0.82], crest: [0.99, 0.77, 0.0], field: 0.75, net: [0.99, 0.77, 0.0], lineA: 0.55, nodeA: 1.0, additive: true },
  };
  let pal = PALETTES.light;
  const syncTheme = () => { pal = root.dataset.theme === "dark" ? PALETTES.dark : PALETTES.light; };
  syncTheme();

  const proj = new Float32Array(16), view = new Float32Array(16);
  let dpr = 1, vk = 1; // vk scales point sizes with viewport height

  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f;
    out[10] = (far + near) * nf; out[11] = -1;
    out[14] = 2 * far * near * nf;
  }

  function lookAt(out, e, c) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = zz, xy = 0, xz = -zx; // cross((0,1,0), z)
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out.set([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    vk = Math.min(2, Math.max(0.8, innerHeight / 900));
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    perspective(proj, (52 * Math.PI) / 180, w / h, 0.1, 80);
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const scroll = { v: 0, t: 0 };
  const readScroll = () => {
    const max = Math.max(1, root.scrollHeight - innerHeight);
    scroll.t = Math.min(1, Math.max(0, scrollY / max));
  };
  addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  addEventListener("scroll", readScroll, { passive: true });
  readScroll();
  scroll.v = scroll.t;

  function bindAttrib(prog, name, buf, size) {
    const loc = gl.getAttribLocation(prog, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return loc;
  }

  function draw(t) {
    // Ease camera inputs so motion stays fluid.
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    scroll.v += (scroll.t - scroll.v) * 0.06;
    const s = scroll.v;
    const yaw = Math.sin(t * 0.045) * 0.2 + pointer.x * 0.12 + (s - 0.5) * 0.55;
    const r = 10 - s * 2.2;
    lookAt(view,
      [Math.sin(yaw) * r, 3.4 - s * 1.2 - pointer.y * 0.3, Math.cos(yaw) * r - 2],
      [0, 0.3, -5 - s * 3]);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, pal.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);

    // Field
    gl.useProgram(field.p);
    gl.uniformMatrix4fv(field.u.uProj, false, proj);
    gl.uniformMatrix4fv(field.u.uView, false, view);
    gl.uniform1f(field.u.uTime, t);
    gl.uniform1f(field.u.uFlow, t * 0.32);
    gl.uniform1f(field.u.uSize, 2.8 * vk);
    gl.uniform1f(field.u.uDpr, dpr);
    gl.uniform3fv(field.u.uBase, pal.base);
    gl.uniform3fv(field.u.uCrest, pal.crest);
    gl.uniform1f(field.u.uAlpha, pal.field);
    const gLoc = bindAttrib(field.p, "aGrid", gridBuf, 2);
    gl.drawArrays(gl.POINTS, 0, GX * GZ);
    gl.disableVertexAttribArray(gLoc);

    // Network
    for (let i = 0; i < N; i++) {
      const n = nodes[i], a = t * n.sp + n.ph;
      pos[i * 4] = n.x + Math.sin(a) * 1.4;
      pos[i * 4 + 1] = n.y + Math.sin(a * 1.3 + n.ph) * 0.5;
      pos[i * 4 + 2] = n.z + Math.cos(a * 0.8) * 1.4;
      pos[i * 4 + 3] = 0.55 + 0.45 * Math.sin(t * 0.9 + n.ph);
    }
    let m = 0;
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pos[i * 4] - pos[j * 4], dy = pos[i * 4 + 1] - pos[j * 4 + 1], dz = pos[i * 4 + 2] - pos[j * 4 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= LINK) continue;
        const a = (1 - d / LINK) ** 1.5;
        lines.set([pos[i * 4], pos[i * 4 + 1], pos[i * 4 + 2], a, pos[j * 4], pos[j * 4 + 1], pos[j * 4 + 2], a], m);
        m += 8;
      }
    }

    gl.useProgram(net.p);
    gl.uniformMatrix4fv(net.u.uProj, false, proj);
    gl.uniformMatrix4fv(net.u.uView, false, view);
    gl.uniform1f(net.u.uDpr, dpr);
    gl.uniform3fv(net.u.uColor, pal.net);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, lines.subarray(0, m));
    gl.uniform1f(net.u.uAlpha, pal.lineA);
    gl.uniform1f(net.u.uRound, 0);
    gl.uniform1f(net.u.uSize, 1);
    let loc = bindAttrib(net.p, "aPos", lineBuf, 4);
    gl.drawArrays(gl.LINES, 0, m / 4);

    gl.bindBuffer(gl.ARRAY_BUFFER, nodeBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
    gl.uniform1f(net.u.uAlpha, pal.nodeA);
    gl.uniform1f(net.u.uRound, 1);
    gl.uniform1f(net.u.uSize, 13 * vk);
    loc = bindAttrib(net.p, "aPos", nodeBuf, 4);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(loc);
  }

  // Elapsed time only advances while frames are drawn, so pausing never causes a jump.
  let raf = 0, last = 0, elapsed = 12;
  const frame = (now) => {
    elapsed += Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(elapsed);
    raf = requestAnimationFrame(frame);
  };
  const still = () => { pointer.x = pointer.tx; pointer.y = pointer.ty; scroll.v = scroll.t; draw(elapsed); };
  function run() {
    cancelAnimationFrame(raf);
    if (document.hidden) return;
    if (reduceMotion.matches) { still(); return; }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  addEventListener("resize", () => { resize(); if (reduceMotion.matches) still(); });
  document.addEventListener("visibilitychange", run);
  reduceMotion.addEventListener?.("change", run);
  new MutationObserver(() => { syncTheme(); if (reduceMotion.matches) still(); })
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); cancelAnimationFrame(raf); });

  resize();
  run();
})();
