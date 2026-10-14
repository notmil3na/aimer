import { useEffect, useRef } from "react";

const VIRGO_STARS = [
  [0.50, 0.90],
  [0.47, 0.55],
  [0.28, 0.22],
  [0.36, 0.38],
  [0.62, 0.15],
  [0.56, 0.07],
  [0.48, 0.02],
  [0.50, 0.72],
  [0.16, 0.32],
  [0.37, 0.67],
  [0.54, 0.40],
  [0.64, 0.75],
];
const VIRGO_EDGES = [
  [6, 5], [5, 4], [4, 10], [10, 1], [1, 0],
  [3, 1], [2, 3], [8, 2], [9, 1], [7, 0], [11, 0],
];
const N_CONST = VIRGO_STARS.length;

const VERT_POINT = `
attribute vec2 a_pos;
attribute float a_size;
attribute float a_alpha;
uniform vec2 u_res;
varying float v_a;
void main(){
  vec2 c=(a_pos/u_res)*2.0-1.0;
  gl_Position=vec4(c*vec2(1,-1),0,1);
  gl_PointSize=a_size;
  v_a=a_alpha;
}`;

const FRAG_POINT = `
precision mediump float;
varying float v_a;
uniform vec3 u_col;
uniform float u_glow;
void main(){
  float d=length(gl_PointCoord-.5);
  if(d>.48)discard;
  float g=1.-smoothstep(0.18,.48,d);
  float glow=(1.-smoothstep(0.,.5,d))*u_glow*.25;
  gl_FragColor=vec4(u_col,v_a*(g+glow));
}`;

const VERT_LINE = `
attribute vec2 a_pos;
attribute float a_alpha;
uniform vec2 u_res;
varying float v_a;
void main(){
  vec2 c=(a_pos/u_res)*2.0-1.0;
  gl_Position=vec4(c*vec2(1,-1),0,1);
  v_a=a_alpha;
}`;

const FRAG_LINE = `
precision mediump float;
varying float v_a;
uniform vec3 u_col;
void main(){
  gl_FragColor=vec4(u_col,v_a);
}`;

function mkShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}
function mkProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
  return p;
}

export default function WebGLBackground({ color, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.innerWidth < 700;
    const BG_COUNT = isMobile ? 40 : 80;
    const TOTAL = BG_COUNT + N_CONST;
    const CONNECT_DIST = isMobile ? 120 * dpr : 170 * dpr;
    const MAX_LINES = isMobile ? 200 : 400;

    const particles = [];
    for (let i = 0; i < TOTAL; i++) {
      const isConst = i >= BG_COUNT;
      const cIdx = isConst ? i - BG_COUNT : -1;
      particles.push({
        x: 0, y: 0,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: isConst
          ? (cIdx === 0 ? 5.5 : 4.5)
          : (3 + Math.random() * 2),
        baseAlpha: isConst
          ? (0.75 + Math.random() * 0.25)
          : (0.3 + Math.random() * 0.4),
        alpha: 0,
        phase: Math.random() * Math.PI * 2,
        isConst,
        constIdx: cIdx,
        targetX: 0,
        targetY: 0,
        locked: false,
        initDone: false,
      });
    }

    let mouseX = -9e4, mouseY = -9e4;
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      mouseX = (cx - r.left) * dpr;
      mouseY = (cy - r.top) * dpr;
    };
    const onLeave = () => { mouseX = -9e4; mouseY = -9e4; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    const pVS = mkShader(gl, gl.VERTEX_SHADER, VERT_POINT);
    const pFS = mkShader(gl, gl.FRAGMENT_SHADER, FRAG_POINT);
    const lVS = mkShader(gl, gl.VERTEX_SHADER, VERT_LINE);
    const lFS = mkShader(gl, gl.FRAGMENT_SHADER, FRAG_LINE);
    const pProg = mkProgram(gl, pVS, pFS);
    const lProg = mkProgram(gl, lVS, lFS);
    if (!pProg || !lProg) return;

    const pPos = gl.getAttribLocation(pProg, "a_pos");
    const pSize = gl.getAttribLocation(pProg, "a_size");
    const pAlpha = gl.getAttribLocation(pProg, "a_alpha");
    const pRes = gl.getUniformLocation(pProg, "u_res");
    const pCol = gl.getUniformLocation(pProg, "u_col");
    const pGlow = gl.getUniformLocation(pProg, "u_glow");

    const lPos = gl.getAttribLocation(lProg, "a_pos");
    const lAlpha = gl.getAttribLocation(lProg, "a_alpha");
    const lRes = gl.getUniformLocation(lProg, "u_res");
    const lCol = gl.getUniformLocation(lProg, "u_col");

    const pPosBuf = gl.createBuffer();
    const pSizeBuf = gl.createBuffer();
    const pAlphaBuf = gl.createBuffer();
    const lPosBuf = gl.createBuffer();
    const lAlphaBuf = gl.createBuffer();

    let W = 0, H = 0;
    const computeTargets = () => {
      const cw = canvas.width, ch = canvas.height;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of VIRGO_STARS) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const constW = maxX - minX || 1;
      const constH = maxY - minY || 1;
      const scale = Math.min(cw * 0.50 / constW, ch * 0.55 / constH);
      const offsetX = cw * 0.5 - (minX + maxX) * 0.5 * scale;
      const offsetY = ch * 0.5 - (minY + maxY) * 0.5 * scale;

      for (const p of particles) {
        if (p.isConst) {
          const [nx, ny] = VIRGO_STARS[p.constIdx];
          p.targetX = nx * scale + offsetX;
          p.targetY = ny * scale + offsetY;
        }
      }
    };

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      W = w; H = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      computeTargets();

      for (const p of particles) {
        if (!p.initDone) {
          p.x = Math.random() * canvas.width;
          p.y = Math.random() * canvas.height;
          p.initDone = true;
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const posArr = new Float32Array(TOTAL * 2);
    const sizeArr = new Float32Array(TOTAL);
    const alphaArr = new Float32Array(TOTAL);
    const MAX_LINE_VERTS = MAX_LINES * 2;
    const linePosArr = new Float32Array(MAX_LINE_VERTS * 2);
    const lineAlphaArr = new Float32Array(MAX_LINE_VERTS);

    let raf;
    let t = 0;
    let phase = "drift";
    let completeTime = -999;
    const starCol = [1.0, 1.0, 0.97];
    const lineCol = [1.0, 1.0, 0.98];

    const render = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        resize();
        raf = requestAnimationFrame(render);
        return;
      }

      t += 0.008;
      const cw = canvas.width, ch = canvas.height;

      if (phase === "drift" && t > 8) phase = "converge";
      const convergeFactor = phase !== "drift"
        ? Math.min(1, Math.max(0, (t - 8) / 20))
        : 0;

      if (phase === "converge") {
        const allLocked = particles.every(p => !p.isConst || p.locked);
        if (allLocked) { phase = "complete"; completeTime = t; }
      }

      const glowFactor = phase === "complete"
        ? Math.min(1, (t - completeTime) / 2)
        : 0;

      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i];

        if (p.isConst && convergeFactor > 0 && !p.locked) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1.5) {
            const pull = convergeFactor * 0.0005 * Math.min(dist * 0.006, 1);
            p.vx += (dx / dist) * pull;
            p.vy += (dy / dist) * pull;
          }
          if (dist < 4 * dpr) {
            p.locked = true;
            p.x = p.targetX;
            p.y = p.targetY;
            p.vx = 0;
            p.vy = 0;
          }
        }

        if (!p.locked) {
          p.vx += Math.sin(t * 0.5 + p.phase) * 0.005;
          p.vy += Math.cos(t * 0.65 + p.phase * 1.5) * 0.005;
        }

        const mdx = mouseX - p.x;
        const mdy = mouseY - p.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 180 * dpr && md > 1 && !p.locked) {
          const f = (1 - md / (180 * dpr)) * 0.15;
          p.vx -= (mdx / md) * f;
          p.vy -= (mdy / md) * f;
        }

        p.vx *= 0.97;
        p.vy *= 0.97;

        if (!p.locked) {
          p.x += p.vx;
          p.y += p.vy;
        }

        if (!p.isConst) {
          const margin = 40 * dpr;
          if (p.x < -margin) p.x = cw + margin;
          if (p.x > cw + margin) p.x = -margin;
          if (p.y < -margin) p.y = ch + margin;
          if (p.y > ch + margin) p.y = -margin;
        }

        const pulse = 0.8 + 0.2 * Math.sin(t * 1.2 + p.phase);
        const glowBoost = p.isConst ? glowFactor * 0.35 : 0;
        p.alpha = Math.min(1, (p.baseAlpha + glowBoost) * pulse);
      }

      gl.viewport(0, 0, cw, ch);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i];
        posArr[i * 2] = p.x;
        posArr[i * 2 + 1] = p.y;
        const sizeMul = p.isConst ? (1 + glowFactor * 0.5) : 1;
        sizeArr[i] = p.size * dpr * sizeMul;
        alphaArr[i] = p.alpha;
      }

      gl.useProgram(pProg);
      gl.uniform2f(pRes, cw, ch);
      gl.uniform3f(pCol, starCol[0], starCol[1], starCol[2]);
      gl.uniform1f(pGlow, glowFactor);

      gl.bindBuffer(gl.ARRAY_BUFFER, pPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pPos);
      gl.vertexAttribPointer(pPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, pSizeBuf);
      gl.bufferData(gl.ARRAY_BUFFER, sizeArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pSize);
      gl.vertexAttribPointer(pSize, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, pAlphaBuf);
      gl.bufferData(gl.ARRAY_BUFFER, alphaArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pAlpha);
      gl.vertexAttribPointer(pAlpha, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, TOTAL);

      let lineCount = 0;

      for (let i = 0; i < TOTAL && lineCount < MAX_LINES; i++) {
        for (let j = i + 1; j < TOTAL && lineCount < MAX_LINES; j++) {
          const ex = particles[i].x - particles[j].x;
          const ey = particles[i].y - particles[j].y;
          const d = Math.sqrt(ex * ex + ey * ey);
          if (d < CONNECT_DIST) {
            const a = (1 - d / CONNECT_DIST) * 0.12;
            const idx = lineCount * 4;
            const aidx = lineCount * 2;
            linePosArr[idx] = particles[i].x;
            linePosArr[idx + 1] = particles[i].y;
            linePosArr[idx + 2] = particles[j].x;
            linePosArr[idx + 3] = particles[j].y;
            lineAlphaArr[aidx] = a;
            lineAlphaArr[aidx + 1] = a;
            lineCount++;
          }
        }
      }

      const cStart = BG_COUNT;
      for (const [a, b] of VIRGO_EDGES) {
        if (lineCount >= MAX_LINES) break;
        const pa = particles[cStart + a];
        const pb = particles[cStart + b];
        if (!pa.locked || !pb.locked) continue;

        const distA = Math.sqrt((pa.x - pa.targetX) ** 2 + (pa.y - pa.targetY) ** 2);
        const distB = Math.sqrt((pb.x - pb.targetX) ** 2 + (pb.y - pb.targetY) ** 2);
        const fadeA = Math.max(0, 1 - distA / (10 * dpr));
        const fadeB = Math.max(0, 1 - distB / (10 * dpr));
        const edgeAlpha = Math.min(fadeA, fadeB) * (0.35 + glowFactor * 0.55);

        if (edgeAlpha > 0.01) {
          const idx = lineCount * 4;
          const aidx = lineCount * 2;
          linePosArr[idx] = pa.x;
          linePosArr[idx + 1] = pa.y;
          linePosArr[idx + 2] = pb.x;
          linePosArr[idx + 3] = pb.y;
          lineAlphaArr[aidx] = edgeAlpha;
          lineAlphaArr[aidx + 1] = edgeAlpha;
          lineCount++;
        }
      }

      if (lineCount > 0) {
        gl.useProgram(lProg);
        gl.uniform2f(lRes, cw, ch);
        gl.uniform3f(lCol, lineCol[0], lineCol[1], lineCol[2]);

        gl.bindBuffer(gl.ARRAY_BUFFER, lPosBuf);
        gl.bufferData(gl.ARRAY_BUFFER, linePosArr.subarray(0, lineCount * 4), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(lPos);
        gl.vertexAttribPointer(lPos, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, lAlphaBuf);
        gl.bufferData(gl.ARRAY_BUFFER, lineAlphaArr.subarray(0, lineCount * 2), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(lAlpha);
        gl.vertexAttribPointer(lAlpha, 1, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.LINES, 0, lineCount * 2);
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      gl.deleteProgram(pProg);
      gl.deleteProgram(lProg);
      gl.deleteShader(pVS); gl.deleteShader(pFS);
      gl.deleteShader(lVS); gl.deleteShader(lFS);
      [pPosBuf, pSizeBuf, pAlphaBuf, lPosBuf, lAlphaBuf].forEach(gl.deleteBuffer.bind(gl));
    };
  }, [color]);

  return (
    <canvas
      ref={ref}
      style={{
        display: "block",
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        maskImage:
          "linear-gradient(to bottom, transparent 0, black calc(env(safe-area-inset-top) + 26px), black calc(100% - env(safe-area-inset-bottom) - 26px), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0, black calc(env(safe-area-inset-top) + 26px), black calc(100% - env(safe-area-inset-bottom) - 26px), transparent 100%)",
        ...style,
      }}
    />
  );
}
