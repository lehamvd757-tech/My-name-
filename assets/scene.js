(()=>{var S=`
attribute vec2 p;
varying vec2 v;
void main() {
  v = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`,U=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform vec2 uRes;
uniform vec2 uLook;
uniform float uAspect;
uniform float uTime;
uniform float uMotion;

const vec2 VP = vec2(0.5, 0.44);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// \u041F\u044B\u043B\u0438\u043D\u043A\u0438 \u0432 \u043B\u0443\u0447\u0430\u0445 \u0441\u0432\u0435\u0442\u0430: \u044F\u0447\u0435\u0439\u043A\u0438 \u0441\u043E \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u043C\u0438 \u0447\u0430\u0441\u0442\u0438\u0446\u0430\u043C\u0438, \u043C\u0435\u0434\u043B\u0435\u043D\u043D\u043E \u043F\u043B\u044B\u0432\u0443\u0442 \u0432\u0432\u0435\u0440\u0445.
float dust(vec2 st, float scale, float speed, float size) {
  st *= scale;
  st.y += uTime * speed * uMotion;
  vec2 id = floor(st);
  vec2 f = fract(st) - 0.5;
  float h = hash(id);
  vec2 o = (vec2(hash(id + 1.7), hash(id + 9.2)) - 0.5) * 0.6;
  o += 0.1 * vec2(sin(uTime * 0.5 + h * 6.28), cos(uTime * 0.4 + h * 6.28)) * uMotion;
  float r = length(f - o);
  float tw = 0.55 + 0.45 * sin(uTime * 1.4 * uMotion + h * 40.0);
  return smoothstep(size, 0.0, r) * step(0.62, h) * tw;
}

void main() {
  float sa = uRes.x / uRes.y;
  vec2 s = vec2(v.x, 1.0 - v.y);
  vec2 uv = s;
  if (sa > uAspect) uv.y = 0.5 + (s.y - 0.5) * (uAspect / sa);
  else uv.x = 0.5 + (s.x - 0.5) * (sa / uAspect);
  uv = 0.5 + (uv - 0.5) / 1.14;

  // \u041C\u0435\u0434\u043B\u0435\u043D\u043D\u043E\u0435 \xAB\u0434\u044B\u0445\u0430\u043D\u0438\u0435\xBB \u043A\u0430\u043C\u0435\u0440\u044B \u0432\u043F\u0435\u0440\u0451\u0434-\u043D\u0430\u0437\u0430\u0434 \u0438 \u043B\u0451\u0433\u043A\u043E\u0435 \u0431\u043B\u0443\u0436\u0434\u0430\u043D\u0438\u0435 \u0432\u0437\u0433\u043B\u044F\u0434\u0430.
  float dolly = (0.5 - 0.5 * cos(uTime * 0.45)) * uMotion;
  vec2 drift = vec2(sin(uTime * 0.23), cos(uTime * 0.19) * 0.6) * 0.012 * uMotion;
  vec2 look = uLook * vec2(0.045, 0.028) + drift;

  vec2 uvp = uv;
  for (int i = 0; i < 4; i++) {
    float d = texture2D(uDepth, uvp).r;
    float sc = 1.0 - 0.12 * dolly * (0.25 + 0.75 * d);
    uvp = VP + (uv - VP) * sc + look * (d - 0.3);
  }
  uvp = clamp(uvp, 0.002, 0.998);

  vec3 col = texture2D(uImg, uvp).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));

  // \u041B\u0430\u0439\u043C\u043E\u0432\u044B\u0435 \u043B\u0438\u043D\u0438\u0438 \u0441\u0432\u0435\u0442\u0430 \u0441\u043B\u0435\u0433\u043A\u0430 \u043F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u044E\u0442.
  float lime = smoothstep(0.12, 0.45, col.g - max(col.r, col.b));
  col += vec3(0.28, 0.5, 0.04) * lime * (0.12 + 0.10 * sin(uTime * 1.3 * uMotion));

  // \u0425\u043E\u043B\u043E\u0434\u043D\u043E\u0435 \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u0435 \u0432 \u043A\u043E\u043D\u0446\u0435 \u043A\u043E\u0440\u0438\u0434\u043E\u0440\u0430.
  float dv = length((uvp - VP) * vec2(uAspect, 1.0));
  col += vec3(0.05, 0.13, 0.28) * exp(-dv * 5.5) * (0.4 + 0.15 * sin(uTime * 0.7 * uMotion));

  // \u041F\u044B\u043B\u044C: \u0442\u0440\u0438 \u0441\u043B\u043E\u044F \u0441 \u0440\u0430\u0437\u043D\u043E\u0439 \u0433\u043B\u0443\u0431\u0438\u043D\u043E\u0439 \u043F\u0430\u0440\u0430\u043B\u043B\u0430\u043A\u0441\u0430.
  vec2 st = vec2(s.x * sa, s.y);
  float lit = 0.18 + 1.6 * smoothstep(0.04, 0.5, lum);
  float dsum = dust(st + look * 6.0, 14.0, 0.012, 0.09)
             + dust(st + look * 3.0 + 3.1, 26.0, 0.02, 0.08) * 0.8
             + dust(st + look * 1.5 + 7.7, 48.0, 0.03, 0.07) * 0.6;
  col += vec3(0.62, 0.82, 1.0) * dsum * lit * 0.55;

  // \u0412\u0438\u043D\u044C\u0435\u0442\u043A\u0430 \u0438 \u043F\u043B\u0451\u043D\u043E\u0447\u043D\u043E\u0435 \u0437\u0435\u0440\u043D\u043E.
  float vig = 1.0 - 0.5 * pow(length((s - 0.5) * vec2(1.1, 1.25)), 2.2);
  col *= vig;
  col += (hash(s * uRes + fract(uTime) * 91.7) - 0.5) * 0.04;

  gl_FragColor = vec4(col, 1.0);
}`;var O=45,B=70,V=90;function D(e){return new Promise((n,s)=>{let i=new Image;i.decoding="async",i.onload=()=>n(i),i.onerror=s,i.src=e})}function F(e,n,s){let i=e.createShader(n);return e.shaderSource(i,s),e.compileShader(i),e.getShaderParameter(i,e.COMPILE_STATUS)?i:(console.warn("[scene] shader error:",e.getShaderInfoLog(i)),null)}function k(e,n,s){let i=e.createTexture();return e.activeTexture(e.TEXTURE0+n),e.bindTexture(e.TEXTURE_2D,i),e.texImage2D(e.TEXTURE_2D,0,e.RGB,e.RGB,e.UNSIGNED_BYTE,s),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),i}function X(){let e=document.getElementById("hero-scene"),n=e&&e.closest(".hero");if(!e||!n)return;let s=e.getAttribute("data-image"),i=e.getAttribute("data-depth");if(!s||!i)return;let l=window.matchMedia("(prefers-reduced-motion: reduce)").matches,G=window.matchMedia("(max-width: 760px), (pointer: coarse)").matches,t=null;try{t=e.getContext("webgl",{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:"high-performance"})}catch{t=null}if(!t){n.setAttribute("data-scene","no-webgl");return}let _=F(t,t.VERTEX_SHADER,S),L=F(t,t.FRAGMENT_SHADER,U);if(!_||!L)return;let r=t.createProgram();if(t.attachShader(r,_),t.attachShader(r,L),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS)){console.warn("[scene] link error:",t.getProgramInfoLog(r));return}t.useProgram(r);let N=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,N),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW);let b=t.getAttribLocation(r,"p");t.enableVertexAttribArray(b),t.vertexAttribPointer(b,2,t.FLOAT,!1,0,0);let f={img:t.getUniformLocation(r,"uImg"),depth:t.getUniformLocation(r,"uDepth"),res:t.getUniformLocation(r,"uRes"),look:t.getUniformLocation(r,"uLook"),aspect:t.getUniformLocation(r,"uAspect"),time:t.getUniformLocation(r,"uTime"),motion:t.getUniformLocation(r,"uMotion")},c={x:0,y:0},u={x:0,y:0},h=Math.min(window.devicePixelRatio||1,G?1.25:1.5),y=0,v=0,d=0,p=!0,E=!1,I=0,x=0,T=0,w=!1;function R(){let o=n.getBoundingClientRect(),a=Math.max(2,Math.round(o.width*h)),A=Math.max(2,Math.round(o.height*h));(e.width!==a||e.height!==A)&&(e.width=a,e.height=A),t.viewport(0,0,a,A),t.uniform2f(f.res,a,A),w&&!d&&g()}function g(){t.uniform2f(f.look,u.x,u.y),t.uniform1f(f.time,y),t.drawArrays(t.TRIANGLE_STRIP,0,4)}function C(o){if(x+=o,T+=1,T<V)return;let a=x/T;x=0,T=0,a>B?E=!0:a>O&&I===0&&h>1&&(h=1,I=1,R())}function P(o){if(d=0,E||!p||document.hidden){E&&n.setAttribute("data-scene","frozen");return}let a=v?Math.min((o-v)/1e3,.05):0;v=o,y+=a,u.x+=(c.x-u.x)*.06,u.y+=(c.y-u.y)*.06,g(),a&&C(a*1e3),!(l&&Math.abs(c.x-u.x)+Math.abs(c.y-u.y)<.002)&&(d=window.requestAnimationFrame(P))}function m(){!w||E||d||!p||document.hidden||(v=0,d=window.requestAnimationFrame(P))}function M(){d&&window.cancelAnimationFrame(d),d=0}e.addEventListener("webglcontextlost",o=>{o.preventDefault(),M(),w=!1,e.classList.remove("is-ready"),n.classList.remove("has-scene"),n.setAttribute("data-scene","context-lost")}),window.addEventListener("pointermove",o=>{o.pointerType!=="touch"&&(c.x=(o.clientX/window.innerWidth-.5)*2,c.y=(o.clientY/window.innerHeight-.5)*2,l&&m())},{passive:!0}),window.addEventListener("deviceorientation",o=>{o.gamma==null||o.beta==null||(c.x=Math.max(-1,Math.min(1,o.gamma/30)),c.y=Math.max(-1,Math.min(1,(o.beta-45)/30)),l&&m())},{passive:!0}),document.addEventListener("visibilitychange",()=>document.hidden?M():m()),"IntersectionObserver"in window&&new IntersectionObserver(o=>{p=o[o.length-1].isIntersecting,p?m():M()},{threshold:0}).observe(n),"ResizeObserver"in window?new ResizeObserver(R).observe(n):window.addEventListener("resize",R),Promise.all([D(s),D(i)]).then(([o,a])=>{k(t,0,o),k(t,1,a),t.uniform1i(f.img,0),t.uniform1i(f.depth,1),t.uniform1f(f.aspect,o.naturalWidth/o.naturalHeight),t.uniform1f(f.motion,l?0:1),w=!0,R(),g(),n.classList.add("has-scene"),n.setAttribute("data-scene",l?"parallax-only":"running"),e.classList.add("is-ready"),l||m()}).catch(()=>{})}"requestIdleCallback"in window?window.requestIdleCallback(X,{timeout:1200}):window.setTimeout(X,250);})();
