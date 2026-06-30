import { useEffect, useRef, useState, type CSSProperties } from 'react'

const CURTAIN_AMP = 0.0035
const CURTAIN_WAVES = 1.0
const CURTAIN_SPEED = 0.22
const CURTAIN_SHADOW = 0.045

const POSTER_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const POSTER_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
uniform float uWaves;
uniform float uShadow;
uniform float uAmpMul;

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  float phase = uv.x * 6.2831853 * uWaves;
  float wave = sin(phase + t) + 0.3 * sin(phase * 0.5 + t * 0.7);
  vec2 d = vec2(
    sin(uv.y * 6.2831853 * uWaves * 0.5 + t * 0.8) * uAmp * 0.4,
    wave * uAmp
  ) * uAmpMul;
  vec3 col = texture2D(uTex, uv + d).rgb;
  float slope = abs(cos(phase + t));
  col *= 1.0 - slope * uShadow * uAmpMul;
  gl_FragColor = vec4(col, 1.0);
}`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh)
    return null
  }
  return sh
}

const BG_CONTAINER: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
}

export function ImageBg({ src, reducedMotion }: { src: string; reducedMotion?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    if (fallback || reducedMotion) return
    const host = hostRef.current
    const cv = canvasRef.current
    if (!host || !cv) return

    const gl = cv.getContext('webgl', {
      antialias: false,
      premultipliedAlpha: false,
      alpha: true,
    }) as WebGLRenderingContext | null
    if (!gl) {
      setFallback(true)
      return
    }

    const vert = compileShader(gl, gl.VERTEX_SHADER, POSTER_VERT)
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, POSTER_FRAG)
    if (!vert || !frag) {
      setFallback(true)
      return
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFallback(true)
      return
    }
    gl.useProgram(prog)

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(prog, 'uTime')
    gl.uniform1f(gl.getUniformLocation(prog, 'uAmp'), CURTAIN_AMP)
    gl.uniform1f(gl.getUniformLocation(prog, 'uSpeed'), CURTAIN_SPEED)
    gl.uniform1f(gl.getUniformLocation(prog, 'uWaves'), CURTAIN_WAVES)
    gl.uniform1f(gl.getUniformLocation(prog, 'uShadow'), CURTAIN_SHADOW)
    gl.uniform1f(gl.getUniformLocation(prog, 'uAmpMul'), 1)

    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)

    const off = document.createElement('canvas')
    const offCtx = off.getContext('2d')
    if (!offCtx) {
      setFallback(true)
      return
    }

    const img = new Image()
    img.decoding = 'async'
    let imgAspect = 16 / 9
    let ready = false
    let lastCssW = 0
    let lastCssH = 0
    let lastBw = 0
    let lastBh = 0
    let textureUploaded = false

    const uploadTexture = () => {
      if (!ready || !img.complete || img.naturalWidth === 0) return
      const canvasAspect = off.width / off.height
      let sx = 0
      let sy = 0
      let sw = img.naturalWidth
      let sh = img.naturalHeight
      if (canvasAspect > imgAspect) {
        sh = Math.round(sw / canvasAspect)
        sy = Math.round((img.naturalHeight - sh) / 2)
      } else {
        sw = Math.round(sh * canvasAspect)
        sx = Math.round((img.naturalWidth - sw) / 2)
      }
      offCtx.clearRect(0, 0, off.width, off.height)
      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, off.width, off.height)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off)
      textureUploaded = true
    }

    const syncLayout = () => {
      const hostW = host.clientWidth
      const hostH = host.clientHeight
      if (hostW === 0 || hostH === 0) return
      const w = Math.max(1, Math.round(hostW))
      const h = Math.max(1, Math.round(hostH))
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const bw = Math.max(1, Math.round(w * dpr))
      const bh = Math.max(1, Math.round(h * dpr))

      if (w === lastCssW && h === lastCssH && bw === lastBw && bh === lastBh) {
        if (!textureUploaded) uploadTexture()
        return
      }
      lastCssW = w
      lastCssH = h
      lastBw = bw
      lastBh = bh
      textureUploaded = false

      cv.style.width = `${w}px`
      cv.style.height = `${h}px`
      cv.width = bw
      cv.height = bh
      off.width = bw
      off.height = bh
      gl.viewport(0, 0, bw, bh)
      uploadTexture()
    }

    const ro = new ResizeObserver(() => syncLayout())
    ro.observe(host)
    window.addEventListener('resize', syncLayout)

    img.onload = () => {
      if (img.naturalWidth > 0) imgAspect = img.naturalWidth / img.naturalHeight
      ready = true
      syncLayout()
    }
    img.src = src

    let raf = 0
    const t0 = performance.now()
    const render = () => {
      raf = requestAnimationFrame(render)
      if (!ready) return
      syncLayout()
      gl.uniform1f(uTime, (performance.now() - t0) / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    raf = requestAnimationFrame(render)

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        raf = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', syncLayout)
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteProgram(prog)
      gl.deleteShader(vert)
      gl.deleteShader(frag)
      gl.deleteBuffer(buf)
      gl.deleteTexture(tex)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [src, fallback, reducedMotion])

  if (fallback || reducedMotion) {
    return (
      <div style={BG_CONTAINER}>
        <img
          src={src}
          alt=""
          aria-hidden="true"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  return (
    <div style={BG_CONTAINER}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  )
}
