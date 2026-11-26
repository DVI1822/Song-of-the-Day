/* eslint-disable */
// @ts-nocheck
// The doodle world behind the Globe: a watercolor + wobbly-ink scene riding
// round a little planet (coast, farm, suburbs, desert, woods, mountain, city).
// Ported as-is from the design demo Derek signed off on; the look is locked.
// Speed (36 units a second, about 111 s a loop) and curve (Rg 1851, the
// "gentle bow") are fixed for every scene.
//
// createDoodle(root) fills root with its canvases and returns
// { setScene, setInput, resize, frame }. Throws if WebGL2 is missing.
export function createDoodle(root){
let STY;
const HANDF=(()=>{try{const v=getComputedStyle(document.documentElement).getPropertyValue('--font-hand').trim();return v||'cursive'}catch(e){return'cursive'}})();
// ---------- seeded randomness + smooth 1D noise
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let R=Math.random;const rnd=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)],chance=p=>R()<p;
function noise1(seed){const g=[];for(let i=0;i<512;i++)g.push(R()*2-1);return x=>{const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);const a=g[(i%512+512)%512],b=g[((i+1)%512+512)%512];return a+(b-a)*u}}

// ---------- palettes (all from the watercolor ref, pushed different ways)
const PAL={
 'Ochre street':{walls:['#e9b949','#d9893f','#c9744a','#e8c86a','#b85f3c','#d7a35a'],roofs:['#d0622f','#b9532c','#8f8c86'],sky:['#7fb0e6','#9b9ee0','#a9c9f0'],ground:'#e7b57f',door:'#d43a2a'},
 'Rose dusk':{walls:['#e59a8f','#d97a6c','#f0b7a4','#c86a6a','#e8c2a8','#b5576b'],roofs:['#b0473f','#8a3d52','#c46a4a'],sky:['#8e8fd6','#b39ad8','#f2a98c'],ground:'#e6a58d',door:'#9c2f3a'},
 'Sunbaked':{walls:['#f0c25a','#e39a3b','#d46f35','#f4d98a','#c4562e'],roofs:['#c4472a','#a33b22','#e07a3a'],sky:['#6aa6e8','#86b8ee','#5f8fd8'],ground:'#f0c07a',door:'#b02a1e'},
 'Pale morning':{walls:['#f3dfb4','#e8c9a2','#f1e3c8','#dcb48e','#e9d3b9'],roofs:['#d38b62','#a9a39a','#c97c5a'],sky:['#b8d4f2','#cfdcf5','#a6c3ea'],ground:'#ecd2a6',door:'#c8553d'},
 'Terracotta & sage':{walls:['#c9744a','#e2a46a','#9fb38a','#d98d5f','#b7c4a0','#e6c08a'],roofs:['#b4532f','#7f9468','#934a2c'],sky:['#8db8de','#a7c7e2','#9aa9dc'],ground:'#d9b083',door:'#a13a28'},
};

// ---------- ink + wash primitives
let ctx,W,H,INK,LW,WOB,nz,NOBLUR=false,LCTX=null,LPER=4000;
function lit(x,y,w,h){if(!LCTX)return;const m=ctx.getTransform();const ex=((m.e%LPER)+LPER)%LPER;const q=Math.abs(Math.sin(ex*12.9898+m.f*78.233+x*3.1+y*1.7)*43758.5453)%1;if(q>.38)return;
  LCTX.setTransform(m);LCTX.globalAlpha=ctx.globalAlpha;LCTX.fillStyle=q<.12?'#fff0b8':'#ffc65e';LCTX.fillRect(x,y,w,h)}
function jitterPath(pts,amt){const out=[];for(let i=0;i<pts.length-1;i++){const[a,b]=[pts[i],pts[i+1]];const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.ceil(L/14));
  const nx=-(b[1]-a[1])/(L||1),ny=(b[0]-a[0])/(L||1);for(let k=0;k<n;k++){const t=k/n,w=nz(a[0]*.02+a[1]*.013+t*L*.05)*amt;out.push([a[0]+(b[0]-a[0])*t+nx*w,a[1]+(b[1]-a[1])*t+ny*w])}}out.push(pts[pts.length-1]);return out}
function inkLine(pts,lw=LW,col=INK){const p=jitterPath(pts,WOB);ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]);
  ctx.strokeStyle=col;ctx.lineWidth=lw*rnd(.85,1.15);ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()}
function seg(x1,y1,x2,y2,lw){const o=rnd(1,4);const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;inkLine([[x1-dx/L*o*.6,y1-dy/L*o*.6],[x2+dx/L*o,y2+dy/L*o]],lw)} // overshooting corners like a pen sketch
function inkRect(x,y,w,h,lw){seg(x,y,x+w,y,lw);seg(x+w,y,x+w,y+h,lw);seg(x+w,y+h,x,y+h,lw);seg(x,y+h,x,y,lw)}
function hexA(h,a){const n=parseInt(h.slice(1),16);return`rgba(${n>>16},${n>>8&255},${n&255},${a})`}
function darker(h,k){const n=parseInt(h.slice(1),16);const f=c=>Math.max(0,Math.round(c*k));return`rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`}
function wash(poly,col,alpha=.72,loose=1){ // watercolor: a few offset translucent passes, pooled darker edge, never quite inside the lines
  const ox=rnd(-3,3)*loose,oy=rnd(-2,3)*loose;
  for(let k=0;k<3;k++){const p=jitterPath(poly.map(q=>[q[0]+ox+rnd(-1.5,1.5)*loose,q[1]+oy+rnd(-1.5,1.5)*loose]),4*loose);
    ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);p.forEach(q=>ctx.lineTo(q[0],q[1]));ctx.closePath();
    ctx.fillStyle=hexA(col,alpha*(k?0.35:0.75));ctx.fill();
    if(!k){ctx.save();if(!NOBLUR)ctx.filter='blur(1.2px)';ctx.strokeStyle=darker(col,.72).replace('rgb','rgba').replace(')',',.35)');ctx.lineWidth=2.5;ctx.stroke();ctx.restore()}}
}
function rectPoly(x,y,w,h){return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]}

// ---------- sky blob, paper, sun
function paper(){ctx.fillStyle='#fbf8f1';ctx.fillRect(0,0,W,H);const id=ctx.getImageData(0,0,W,H),d=id.data;
  for(let i=0;i<d.length;i+=4){const g=(Math.random()-.5)*10;d[i]+=g;d[i+1]+=g;d[i+2]+=g}ctx.putImageData(id,0,0)}
function skyBlob(cx,cy,rx,ry,cols){
  for(let pass=0;pass<5;pass++){const c=pick(cols),n=noise1();ctx.beginPath();const N=90;
    for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,r=1+.28*n(i*.35+pass*7)+.08*n(i*1.7);const x=cx+Math.cos(a)*rx*r*(1+.1*pass*rnd(-1,1)),y=cy+Math.sin(a)*ry*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
    ctx.closePath();ctx.save();ctx.filter=`blur(${rnd(.6,2.5)}px)`;ctx.fillStyle=hexA(c,rnd(.18,.32));ctx.fill();ctx.restore()}
  // white cloud gaps and a few blooms
  ctx.save();ctx.globalCompositeOperation='destination-out';for(let i=0;i<rnd(2,6);i++){ctx.filter='blur(6px)';ctx.beginPath();ctx.ellipse(cx+rnd(-rx,rx)*.8,cy+rnd(.1,.9)*ry,rnd(20,70),rnd(10,26),0,0,7);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fill()}ctx.restore();
  ctx.save();ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fbf8f1';ctx.fillRect(0,0,W,H);ctx.restore();
}
function sun(x,y,r){ctx.beginPath();const n=noise1();for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,rr=r*(1+.03*n(i*.5));i?ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):ctx.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}ctx.fillStyle=INK;ctx.fill()}

// ---------- buildings, drawn in a local frame with the base at y=0 (up is -y)
function windowsDash(x,y,w,h,mode){
  const cols=Math.max(2,Math.round(w/14)),rows=Math.max(2,Math.round(h/24));
  if(mode==='stripes'){for(let r=0;r<Math.round(h/9);r++){const yy=y+8+r*9;if(yy>y+h-6)break;seg(x+5,yy,x+w-5,yy,LW*.8)}return}
  for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){if(chance(.18))continue;const xx=x+(c+.5)*w/cols+rnd(-1.5,1.5),yy=y+12+r*(h-18)/rows;
    if(mode==='dash'){seg(xx,yy,xx+rnd(-.5,.5),yy+rnd(6,10),LW*.9);lit(xx-2.5,yy,5,10)}
    else{const ww=Math.min(10,w/cols*.55),hh=Math.min(13,(h-18)/rows*.6);ctx.fillStyle=hexA('#3a3a44',.18);ctx.fillRect(xx-ww/2,yy,ww,hh);inkRect(xx-ww/2,yy,ww,hh,LW*.7);lit(xx-ww/2,yy,ww,hh)}}
}
function base(poly){ctx.save();ctx.globalAlpha=1;ctx.fillStyle='#f7f1e8';ctx.beginPath();poly.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();ctx.restore()
  if(LCTX){LCTX.save();LCTX.setTransform(ctx.getTransform());LCTX.globalAlpha=1;LCTX.globalCompositeOperation='destination-out';LCTX.beginPath();poly.forEach((q,i)=>i?LCTX.lineTo(q[0],q[1]):LCTX.moveTo(q[0],q[1]));LCTX.closePath();LCTX.fill();LCTX.restore()}}
function tower(p,w,h,depth){const x=-w/2,y=-h,col=pick(p.walls);base(rectPoly(x,y,w,h));wash(rectPoly(x,y,w,h),col,depth?.45:.7);inkRect(x,y,w,h);windowsDash(x,y,w,h,STY.win);
  const top=STY.tops?pick(STY.tops):'flat';
  if(top==='antenna'||chance(.15))seg(rnd(-w*.25,w*.25),y,0,y-rnd(20,60),LW*.9);
  if(top==='dome'){const r=w*.42;wash([[-r,y],[r,y],[r*.7,y-r*.7],[0,y-r],[-r*.7,y-r*.7]],pick(p.roofs),.6);ctx.beginPath();ctx.arc(rnd(-1,1),y,r,Math.PI,0);ctx.strokeStyle=INK;ctx.lineWidth=LW;ctx.stroke();seg(0,y-r,0,y-r-rnd(25,55),LW*.9)}
  if(top==='spire'){wash([[-w*.3,y],[w*.3,y],[0,y-rnd(40,90)]],INK,.85);inkLine([[-w*.3,y],[0,y-70],[w*.3,y]])}
  if(top==='step'){const w2=w*.6,h2=rnd(20,50);base(rectPoly(-w2/2,y-h2,w2,h2));wash(rectPoly(-w2/2,y-h2,w2,h2),col,.6);inkRect(-w2/2,y-h2,w2,h2);seg(0,y-h2,0,y-h2-rnd(15,40))}
}
function rowhouse(p,w,h,depth){const x=-w/2,y=-h,col=pick(p.walls),roof=pick(p.roofs),rh=rnd(18,34);base(rectPoly(x,y,w,h));
  wash(rectPoly(x,y,w,h),col,depth?.45:.75);inkRect(x,y,w,h);
  const peak=chance(.6);const rp=peak?[[x-4,y],[w/2+4,y],[0,y-rh-8]]:[[x-3,y],[w/2+3,y],[w/2-6,y-rh],[x+6,y-rh]];base(rp);wash(rp,roof,.8);inkLine([...rp,rp[0]]);
  const rows=Math.max(1,Math.floor((h-30)/26)),cols=Math.max(2,Math.floor(w/20));
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const ww=9,hh=12,xx=x+(c+.5)*w/cols-ww/2,yy=y+10+r*26;ctx.fillStyle='rgba(40,40,50,.55)';ctx.fillRect(xx+1.5,yy+1.5,ww-3,hh-3);inkRect(xx,yy,ww,hh,LW*.7);lit(xx+1,yy+1,ww-2,hh-2)}
  if(chance(.7)){const dx=rnd(-w/4,w/4);ctx.beginPath();ctx.moveTo(dx-5,0);ctx.lineTo(dx-5,-12);ctx.arc(dx,-12,5,Math.PI,0);ctx.lineTo(dx+5,0);ctx.fillStyle=p.door;ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke()}
}
function church(p,w,h){const x=-w/2,y=-h;base(rectPoly(x,y,w,h));wash(rectPoly(x,y,w,h),pick(p.walls),.75);inkRect(x,y,w,h);const sh=rnd(50,90);const sp=[[x-3,y],[-x+3,y],[0,y-sh]];base(sp);wash(sp,pick(p.roofs),.85);inkLine([...sp,sp[0]]);seg(0,y-sh,0,y-sh-14,LW*.8);
  for(let r=0;r<3;r++){const yy=y+14+r*28;if(yy>-20)break;inkRect(-4,yy,8,14,LW*.7)}}
function tree(len,ang,depth){if(depth===0||len<3)return;const x2=Math.sin(ang)*len,y2=-Math.cos(ang)*len;inkLine([[0,0],[x2,y2]],Math.max(.6,LW*depth/5));ctx.save();ctx.translate(x2,y2);
  const n=depth>3?2:pick([2,3]);for(let i=0;i<n;i++)tree(len*rnd(.62,.8),ang+rnd(-.65,.65),depth-1);ctx.restore()}

// ---------- one mockup

// ---------- soft fills that also work where canvas filters are missing (Safari)
const HASF=(()=>{const c=document.createElement('canvas').getContext('2d');c.filter='blur(2px)';return c.filter==='blur(2px)'})();
function softFill(build,style,px){ctx.save();
  if(HASF){ctx.filter=`blur(${px}px)`;build();ctx.fillStyle=style;ctx.fill();ctx.restore();return}
  const m=ctx.getTransform(),s=Math.hypot(m.a,m.b);ctx.setTransform(m.a,m.b,m.c,m.d,m.e-30000,m.f);build();
  ctx.shadowColor=style;ctx.shadowBlur=px*s*1.6;ctx.shadowOffsetX=30000;ctx.fillStyle=style;ctx.fill();ctx.restore()}
function skyBlob2(cx,cy,rx,ry,cols,alpha=1){
  for(let pass=0;pass<5;pass++){const c=pick(cols),n=noise1(),N=90,sx=1+.1*rnd(-1,1)*pass/2;
    softFill(()=>{ctx.beginPath();for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,r=1+.26*n(i*.35+pass*7)+.07*n(i*1.7);const x=cx+Math.cos(a)*rx*r*sx,y=cy+Math.sin(a)*ry*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()},hexA(c,Math.min(.9,rnd(.14,.24)*alpha)),rnd(2,7))}
  ctx.save();ctx.globalCompositeOperation='destination-out';
  for(let i=0;i<6;i++){const x=cx+rnd(-rx,rx)*.8,y=cy+rnd(.05,.9)*ry,a=rnd(26,80),b=rnd(10,24);softFill(()=>{ctx.beginPath();ctx.ellipse(x,y,a,b,0,0,7)},'rgba(0,0,0,.6)',8)}
  ctx.restore()}
function mix(h1,h2,t){const a=parseInt(h1.slice(1),16),b=parseInt(h2.slice(1),16);const f=s=>Math.round(((a>>s)&255)*(1-t)+((b>>s)&255)*t);return'#'+((1<<24)+(f(16)<<16)+(f(8)<<8)+f(0)).toString(16).slice(1)}
function blendSeam(c,Lp,Bp){const x=c.getContext('2d');const o=document.createElement('canvas');o.width=Lp;o.height=c.height;const oc=o.getContext('2d');oc.drawImage(c,0,0);
  const A=x.getImageData(0,0,Bp,c.height).data,Bd=x.getImageData(Lp,0,Bp,c.height),Bv=Bd.data;
  for(let y=0;y<c.height;y++)for(let i0=0;i0<Bp;i0++){const t=i0/Bp,i=(y*Bp+i0)*4;for(let k=0;k<4;k++)Bv[i+k]=Bv[i+k]*(1-t)+A[i+k]*t}
  oc.putImageData(Bd,0,0);return o}
function newCanvas(w,h){const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c}

// ---------- mockup 7's settings
const P={pal:'Rose dusk',LW:2.23,WOB:.55,win:'dash',tops:['flat','antenna','dome','step'],BIG:1.29,Rg:1851};
const L=4000,B=260,TH=900,G=740;            // city strip: length, seam blend, height, ground line (mockup units)
const Lf=3000,THf=640,Gf=500,FS=1.75;       // foreground strip
const Lb=2400,THb=760,Gb=740,BS=.22;        // distant skyline strip, drawn small so it comes out soft
const ROADT=16,ROADB=74,FRONT=96;           // road edges below the city ground, foreground ground line below it
let CW=800;
function curveToRg(v){return 4200*Math.pow(560/4200,v/100)}
function rgToCurve(r){return 100*Math.log(r/4200)/Math.log(560/4200)}
const per=(x,Lp,k)=>Math.sin(x/Lp*Math.PI*2*k[0]+k[1])*k[2]+Math.sin(x/Lp*Math.PI*2*k[3]+k[4])*k[5];

// ---------- the city strip, with a road along its front
function buildCity(seed){
  const outerR=mulberry(seed);R=outerR;nz=noise1();NOBLUR=true;
  const c=newCanvas(L+B,TH),lc=newCanvas(L+B,TH);ctx=c.getContext('2d');LCTX=lc.getContext('2d');LPER=L;W=c.width;H=c.height;
  INK='#1d1b20';LW=P.LW;WOB=P.WOB;STY={win:P.win,tops:P.tops};const p=PAL[P.pal];
  const ph=rnd(0,6.28),tall=x=>Math.max(0,Math.sin(x/L*Math.PI*4+ph));
  const items=[];
  for(const row of [{scale:.8,back:1},{scale:1,back:0}]){
    let x=rnd(0,30);
    while(x<L){const t=tall(x);let kind;
      if(t>.55)kind=pick(['tower','tower','tower','row','tree']);else if(t>.15)kind=pick(['tower','row','tower','row','tree','church']);else kind=pick(['row','row','row','church','tree','row']);
      if(row.back&&kind==='tree'){x+=20;continue}
      const w=kind==='tower'?rnd(34,70):kind==='row'?rnd(46,74):kind==='church'?rnd(30,40):12;
      const cx=x+w*P.BIG*row.scale/2;items.push({x:cx,kind,w,row,t:tall(cx),s:Math.floor(R()*1e9)});x+=(w+rnd(-2,8))*P.BIG*row.scale}}
  for(let i=0;i<14;i++)items.push({x:rnd(0,L),kind:'street',row:{scale:1,back:0},s:Math.floor(R()*1e9)});
  function drawItem(it,x){R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(x,G-(it.row.back?6:0)+(it.kind==='street'?2:0));ctx.scale(it.row.scale*P.BIG,it.row.scale*P.BIG);
    if(it.row.back)ctx.globalAlpha=.55;
    if(it.kind==='tower')tower(p,it.w,rnd(90,170)+it.t*rnd(80,260),it.row.back);
    else if(it.kind==='row')rowhouse(p,it.w,rnd(70,130),it.row.back);
    else if(it.kind==='church')church(p,it.w,rnd(110,170));
    else if(it.kind==='tree')tree(rnd(30,50),rnd(-.1,.1),6);
    else tree(rnd(40,70),rnd(-.08,.08),6);
    ctx.restore()}
  // radio tower in the old-town stretch, drawn first so the buildings stand in front of its base
  const xT=((((1.5*Math.PI-ph)/(4*Math.PI))*L)%(L/2)+L/2)%(L/2)+L/2*0;TOWER={x:xT,top:330};
  const drawTower=x=>{R=mulberry(seed+999);nz=noise1();ctx.save();ctx.translate(x,G);const Ht=290;
    for(let i=0;i<7;i++){const y0=-i*Ht/7,y1=-(i+1)*Ht/7,w0=22-i*2.6,w1=22-(i+1)*2.6;if(i%2===0)wash([[-w0,y0],[w0,y0],[w1,y1],[-w1,y1]],'#e8836b',.5,.4);seg(-w0,y0,w1,y1,LW*.7);seg(w0,y0,-w1,y1,LW*.7);seg(-w1,y1,w1,y1,LW*.8)}
    seg(-22,0,-3.8,-Ht,LW*1.1);seg(22,0,3.8,-Ht,LW*1.1);seg(0,-Ht,0,-Ht-40,LW);seg(-10,-Ht-14,10,-Ht-14,LW*.8);ctx.restore()};
  drawTower(xT);if(xT<B+60)drawTower(xT+L);
  for(const it of items){drawItem(it,it.x);if(it.x<B+120)drawItem(it,it.x+L);if(it.x>L-120)drawItem(it,it.x-L)}
  LCTX=null;R=outerR;nz=noise1();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  // sidewalk, road, kerb lines, centre dashes (all periodic so the loop closes)
  const kb=[7,rnd(0,6),2,19,rnd(0,6),1.5],kl=[23,rnd(0,6),1.2,57,rnd(0,6),.7],kr=[11,rnd(0,6),1.5,31,rnd(0,6),.8];
  const band=(y0,y1,k)=>{const t=[],b=[];for(let x=-20;x<=L+B+20;x+=12){t.push([x,y0+per(x,L,k)*.4]);b.push([x,y1+per(x,L,k)])}return[...t,...b.reverse()]};
  wash(band(G,G+ROADT,kb),p.ground,.65,1.2);
  wash(band(G+ROADT,G+ROADB,kr),'#b8aab8',.45,1.4);
  const line=(y,k,lw)=>{ctx.beginPath();for(let x=-20;x<=L+B+20;x+=8){const yy=y+per(x,L,k)*WOB*1.5;x>-20?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.strokeStyle=INK;ctx.lineWidth=lw;ctx.lineCap='round';ctx.stroke()};
  line(G,kl,LW*1.3);line(G+ROADT,kr,LW*.8);line(G+ROADB,kb,LW*1.1);
  ctx.strokeStyle=INK;ctx.lineWidth=LW*.9;for(let x=0;x<L+B;x+=50){ctx.beginPath();ctx.moveTo(x+4,G+(ROADT+ROADB)/2+per(x,L,kr)*.5);ctx.lineTo(x+24,G+(ROADT+ROADB)/2+per(x+20,L,kr)*.5);ctx.stroke()}
  const strip=blendSeam(c,L,B),lights=blendSeam(lc,L,B);
  // cars, drawn once so they don't flicker
  const cars=[];for(let i=0;i<9;i++){const s=newCanvas(120,70);ctx=s.getContext('2d');R=mulberry(seed+i*31);nz=noise1();
    ctx.translate(60,60);const w=rnd(34,50),h=rnd(14,18),col=pick(['#c8553d','#e9b949','#8e8fd6','#9fb38a','#f0b7a4','#7fb0e6']);
    const body=[[-w/2,-6],[w/2,-6],[w/2,-h],[w/4,-h],[w/6,-h-12],[-w/4,-h-12],[-w/3,-h],[-w/2,-h]];
    wash(body,col,.9,.5);inkLine([...body,body[0]],LW*.8);
    inkRect(-w/4+3,-h-9,w/5,6,LW*.6);for(const wx of[-w/3.2,w/3.2]){ctx.beginPath();ctx.arc(wx,-5,5,0,7);ctx.fillStyle='#fbf8f1';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke()}
    const v=(i%2?1:-1)*rnd(30,70);cars.push({img:s,x:R()*L,v,lane:v>0?ROADT+22:ROADB-8})}
  return{strip,lights,cars}}

// ---------- foreground: a grass verge with lamps, benches, bushes, fences, planters and people
const SHIRTS=['#c8553d','#e9b949','#7fb0e6','#9fb38a','#b5576b','#8e8fd6','#e39a3b','#5f8fd8'];
function person(){const shirt=pick(SHIRTS),pants=pick(['#3b3f6e','#6e6a66','#8a5a3c','#2f2f38']),tall=rnd(.9,1.1);ctx.save();ctx.scale(tall,tall);
  const st=rnd(-6,6);seg(-3,-22,-3-st*.5,0,LW*.9);seg(3,-22,3+st*.5,0,LW*.9);
  const torso=[[-8,-24],[8,-24],[6,-46],[-6,-46]];wash(torso,shirt,.9,.4);inkLine([...torso,torso[0]],LW*.85);
  wash([[-3,-24],[3,-24],[3+st*.5,-2],[-3-st*.5,-2]],pants,.6,.3);
  seg(-7,-44,-11,-28,LW*.8);seg(7,-44,11+rnd(-2,4),-28,LW*.8);
  ctx.beginPath();ctx.arc(0,-53,6.5,0,7);ctx.fillStyle='#f3dcc6';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.85;ctx.stroke();
  if(chance(.35)){ctx.beginPath();ctx.arc(0,-55,7,Math.PI,0);ctx.fillStyle=pick(SHIRTS);ctx.fill();ctx.stroke()}
  if(chance(.25)){const dx=rnd(14,22);ctx.beginPath();ctx.ellipse(dx,-8,8,5,0,0,7);ctx.fillStyle='#d7a35a';ctx.fill();ctx.stroke();seg(dx+6,-11,dx+10,-15,LW*.8);seg(dx-4,-4,dx-4,0,LW*.7);seg(dx+4,-4,dx+4,0,LW*.7);seg(11,-28,dx-6,-10,LW*.5)}
  ctx.restore()}
function bush(){const w=rnd(40,95),h=rnd(26,50),n=noise1(),pts=[];for(let i=0;i<=24;i++){const a=Math.PI+i/24*Math.PI,r=1+.18*n(i*.9);pts.push([Math.cos(a)*w/2*r,Math.sin(a)*h*r])}
  base(pts);wash(pts,pick(['#8fae7a','#a3b77f','#7d9c6c','#b5b56d']),.95,.5);inkLine(pts,LW*.9);for(let i=0;i<5;i++){const x=rnd(-w/3,w/3),y=rnd(-h*.8,-6);seg(x,y,x+rnd(-4,4),y+5,LW*.6)}
  if(chance(.4))for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(rnd(-w/3,w/3),rnd(-h*.8,-8),2.4,0,7);ctx.fillStyle=pick(['#c8553d','#e9b949','#f0b7a4']);ctx.fill()}}
function lamp(){const h=rnd(130,160);seg(0,0,0,-h,LW*1.1);seg(0,-h,8,-h-6,LW*.9);const lp=[[2,-h-4],[16,-h-4],[14,-h+12],[4,-h+12]];wash(lp,'#f3d27a',.9,.3);inkLine([...lp,lp[0]],LW*.8);
  if(LCTX){const m=ctx.getTransform();LCTX.setTransform(m);const g=LCTX.createRadialGradient(9,-h+6,2,9,-h+6,44);g.addColorStop(0,'rgba(255,214,120,.85)');g.addColorStop(1,'rgba(255,190,90,0)');LCTX.fillStyle=g;LCTX.fillRect(-40,-h-40,100,100);LCTX.fillStyle='#fff0b8';LCTX.fillRect(4,-h-2,10,12)}}
function bench(){const w=rnd(44,60);wash(rectPoly(-w/2,-16,w,5),'#b5835a',.9,.3);inkRect(-w/2,-16,w,5,LW*.8);seg(-w/2+5,-11,-w/2+5,0,LW*.8);seg(w/2-5,-11,w/2-5,0,LW*.8);
  seg(-w/2+2,-26,w/2-2,-26,LW*.8);seg(-w/2+2,-32,w/2-2,-32,LW*.8);seg(-w/2+6,-34,-w/2+6,-16,LW*.7);seg(w/2-6,-34,w/2-6,-16,LW*.7);}
function fence(){const w=rnd(60,130);for(let x=-w/2;x<=w/2;x+=9){inkLine([[x,0],[x,-28],[x+2.5,-32],[x+5,-28],[x+5,0]],LW*.7)}seg(-w/2,-10,w/2+5,-10,LW*.8);seg(-w/2,-22,w/2+5,-22,LW*.8)}
function planter(){const w=rnd(30,46);base(rectPoly(-w/2,-16,w,16));wash(rectPoly(-w/2,-16,w,16),'#c9744a',.9,.4);inkRect(-w/2,-16,w,16,LW*.8);for(let i=0;i<6;i++){const x=rnd(-w/2+4,w/2-4),h=rnd(8,20);seg(x,-16,x+rnd(-2,2),-16-h,LW*.6);ctx.beginPath();ctx.arc(x,-16-h,3.2,0,7);ctx.fillStyle=pick(['#c8553d','#e9b949','#f0b7a4','#8e8fd6','#fbf8f1']);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.8;ctx.stroke()}}
function hydrant(){const p=[[-6,0],[6,0],[6,-18],[3,-24],[-3,-24],[-6,-18]];base(p);wash(p,'#c8553d',.95,.3);inkLine([...p,p[0]],LW*.8);seg(-9,-14,9,-14,LW*.8)}
function mailbox(){seg(0,0,0,-30,LW);const b=rectPoly(-9,-48,18,18);base(b);wash(b,'#5f8fd8',.9,.3);inkRect(-9,-48,18,18,LW*.8)}
function bike(){for(const x of[-15,15]){ctx.beginPath();ctx.arc(x,-10,10,0,7);ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke()}inkLine([[-15,-10],[-3,-10],[6,-24],[-8,-24],[-15,-10]],LW*.8);inkLine([[6,-24],[15,-10]],LW*.8);seg(6,-24,9,-30,LW*.8);seg(-8,-24,-9,-28,LW*.8)}
function busSign(){seg(0,0,0,-70,LW);ctx.beginPath();ctx.arc(0,-78,10,0,7);ctx.fillStyle=hexA('#c8553d',.9);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke();seg(-5,-78,5,-78,LW*.7)}
function fTree(){tree(rnd(50,85),rnd(-.08,.08),6);for(let i=0;i<10;i++){ctx.beginPath();ctx.arc(rnd(-30,30),rnd(-110,-50),2.2,0,7);ctx.fillStyle=pick(['#e39a3b','#c9744a','#e9b949']);ctx.fill()}}
const FKINDS=[['bush',4],['lamp',1.6],['bench',1.2],['fence',1],['planter',1],['hydrant',.5],['mailbox',.5],['bike',.6],['busSign',.4],['fTree',1.1]];
const FFN={bush,lamp,bench,fence,planter,person,hydrant,mailbox,bike,busSign,fTree};
function buildFront(seed){
  const outerR=mulberry(seed+7);R=outerR;nz=noise1();
  const c=newCanvas(Lf+B,THf),lc=newCanvas(Lf+B,THf);ctx=c.getContext('2d');W=c.width;H=c.height;
  const tot=FKINDS.reduce((a,k)=>a+k[1],0),pickK=()=>{let r=R()*tot;for(const[k,w]of FKINDS){if((r-=w)<0)return k}return'bush'};
  const items=[];let x=rnd(0,40),lastLamp=-999;
  while(x<Lf){let k=pickK();if(x-lastLamp>320)k='lamp';if(k==='lamp')lastLamp=x;items.push({x,k,s:Math.floor(R()*1e9)});x+=rnd(40,120)}
  const drawIt=(it,xx)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,Gf+rnd(-2,4));ctx.scale(FS,FS);LCTX=lc.getContext('2d');FFN[it.k]();LCTX=null;ctx.restore()};
  for(const it of items){drawIt(it,it.x);if(it.x<B+150)drawIt(it,it.x+Lf);if(it.x>Lf-150)drawIt(it,it.x-Lf)}
  R=outerR;nz=noise1();ctx.setTransform(1,0,0,1,0,0);
  const k1=[9,rnd(0,6),3,23,rnd(0,6),1.5],k2=[13,rnd(0,6),5,37,rnd(0,6),2];
  const t=[],b=[];for(let x=-20;x<=Lf+B+20;x+=12){t.push([x,Gf+per(x,Lf,k1)*.5]);b.push([x,Gf+84+per(x,Lf,k2)])}
  ctx.save();ctx.globalCompositeOperation='destination-over';wash([...t,...b.reverse()],'#b9b87a',.7,1.4);ctx.restore();
  ctx.beginPath();for(let x=-20;x<=Lf+B+20;x+=8){const y=Gf+per(x,Lf,k1)*.5;x>-20?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=INK;ctx.lineWidth=LW*1.2;ctx.stroke();
  for(let x=10;x<Lf+B;x+=rnd(14,40)){const y=Gf+rnd(12,76);seg(x,y,x-2,y-6,LW*.6);seg(x+3,y,x+4,y-7,LW*.6)}
  const strip=blendSeam(c,Lf,B),lights=blendSeam(lc,Lf,B);
  // walkers that stroll along the verge
  const walkers=[];for(let i=0;i<1;i++){const s=newCanvas(130,150);ctx=s.getContext('2d');R=mulberry(seed+100+i);nz=noise1();ctx.translate(65,144);ctx.scale(FS,FS);person();walkers.push({img:s,x:rnd(0,Lf),v:(i%2?1:-1)*rnd(10,22),ph:rnd(0,6)})}
  return{strip,lights,walkers}}

// ---------- distant skyline, drawn small so it comes out soft, colours pushed toward the sky
function buildBack(seed){
  R=mulberry(seed+3);nz=noise1();const Bb=200;const c=newCanvas((Lb+Bb)*BS,THb*BS);ctx=c.getContext('2d');ctx.scale(BS,BS);
  const p=PAL[P.pal],haze='#cdc3df';
  const items=[];let x=0;while(x<Lb){const w=rnd(36,110),h=rnd(170,470)*(.6+.4*Math.max(0,Math.sin(x/Lb*Math.PI*6)));items.push({x,w,h,col:mix(pick(p.walls),haze,rnd(.5,.7)),top:pick(['flat','flat','ant','dome','spire','step','crane'])});x+=w*rnd(.55,1.05)}
  const one=(it,x)=>{const y=Gb-it.h;ctx.fillStyle=it.col;ctx.fillRect(x,y,it.w,it.h);ctx.strokeStyle='rgba(60,50,80,.35)';ctx.lineWidth=4;ctx.strokeRect(x,y,it.w,it.h);
    ctx.fillStyle='rgba(255,255,255,.25)';for(let yy=y+16;yy<Gb-10;yy+=22)ctx.fillRect(x+6,yy,it.w-12,5);
    ctx.fillStyle=it.col;
    if(it.top==='ant'){ctx.fillRect(x+it.w/2-2,y-60,4,60)}
    if(it.top==='dome'){ctx.beginPath();ctx.arc(x+it.w/2,y,it.w*.4,Math.PI,0);ctx.fill();ctx.stroke()}
    if(it.top==='spire'){ctx.beginPath();ctx.moveTo(x+it.w*.2,y);ctx.lineTo(x+it.w/2,y-90);ctx.lineTo(x+it.w*.8,y);ctx.fill();ctx.stroke()}
    if(it.top==='step'){ctx.fillRect(x+it.w*.2,y-50,it.w*.6,50);ctx.strokeRect(x+it.w*.2,y-50,it.w*.6,50)}
    if(it.top==='crane'){ctx.fillRect(x+it.w*.3,y-120,5,120);ctx.fillRect(x+it.w*.3-60,y-120,150,5)}};
  for(const it of items){one(it,it.x);if(it.x<Bb+120)one(it,it.x+Lb);if(it.x>Lb-140)one(it,it.x-Lb)}
  ctx.fillStyle=mix(p.ground,haze,.5);ctx.fillRect(-50,Gb-4,Lb+Bb+100,THb-Gb+4);
  return blendSeam(c,Math.round(Lb*BS),Math.round(Bb*BS))}

// ---------- WebGL: bends a long strip round the planet
// no multisampling or depth buffer: every layer is one full-screen quad, so
// they'd only cost memory and a resolve pass each frame (perf, Nov 2026)
function makeGL(canvas){const gl=canvas.getContext('webgl2',{premultipliedAlpha:true,alpha:true,antialias:false,depth:false,stencil:false});if(!gl)throw new Error('WebGL2 is not available here');
  const vs=`#version 300 es
in vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
  const fs=`#version 300 es
precision highp float;uniform sampler2D T;uniform vec2 res;uniform float k,Rg,off,L,G,TH,A;uniform vec2 C;out vec4 o;
void main(){vec2 u=vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)/k;vec2 d=u-C;float r=length(d);float a=atan(d.x,-d.y);float sy=G-(r-Rg);
  if(sy<0.||sy>TH){o=vec4(0);return;}o=texture(T,vec2((off+a*Rg)/L,sy/TH))*A;}`;
  const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x};
  const prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);gl.useProgram(prog);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const U={};for(const n of['T','res','k','Rg','off','L','G','TH','C','A'])U[n]=gl.getUniformLocation(prog,n);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  return{
    tex(src){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return t},
    free(t){if(t)gl.deleteTexture(t)},
    erase(t,o){gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA);this.draw(t,o);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)},
    clear(){gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.SCISSOR_TEST);gl.scissor(0,0,canvas.width,Math.max(0,canvas.height-BAND));gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)},
    draw(t,o){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(U.T,0);gl.uniform2f(U.res,canvas.width,canvas.height);gl.uniform1f(U.k,dpr*kc);
      gl.uniform1f(U.Rg,o.Rg);gl.uniform1f(U.off,o.off);gl.uniform1f(U.L,o.L);gl.uniform1f(U.G,o.G);gl.uniform1f(U.TH,o.TH);gl.uniform1f(U.A,o.A??1);gl.uniform2f(U.C,CW/2,GYc+Rg);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}}}

// ---------- real sun, moon, time and weather
const rad=Math.PI/180;
function sunPos(date,lat,lon){const d=(date-Date.UTC(2000,0,1,12))/864e5;const g=(357.529+.98560028*d)*rad,q=280.459+.98564736*d;const Lr=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*rad,e=(23.439-.00000036*d)*rad;
  const ra=Math.atan2(Math.cos(e)*Math.sin(Lr),Math.cos(Lr)),dec=Math.asin(Math.sin(e)*Math.sin(Lr));const gmst=((18.697374558+24.06570982441908*d)%24+24)%24;const Hh=(gmst*15+lon)*rad-ra,la=lat*rad;
  const el=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(Hh));const az=Math.atan2(-Math.sin(Hh),Math.tan(dec)*Math.cos(la)-Math.sin(la)*Math.cos(Hh));return{el:el/rad,az:((az/rad)%360+360)%360}}
function moonPhase(date){const d=(date-Date.UTC(2000,0,1,12))/864e5;return(((d-5.76)/29.530588)%1+1)%1}
let LOC={lat:39.74,lon:-104.99};let INPUT={el:30,az:180,kind:'clear',date:null};
const WXNAME={clear:'Clear',partly:'Partly cloudy',cloudy:'Overcast',rain:'Rain',downpour:'Downpour',storm:'Thunderstorm',snow:'Snow',blizzard:'Blizzard',fog:'Fog'};
const PRESET={dawn:{el:4,az:115},day:{el:38,az:180},golden:{el:4,az:248},night:{el:-35,az:330}};
let M={};
function computeMood(){const now=INPUT.date||new Date();const sun={el:INPUT.el,az:INPUT.az};const ph=moonPhase(now);
  const moon=sunPos(new Date(now-ph*24.84*36e5),LOC.lat,LOC.lon);const kind=INPUT.kind;
  const phase=sun.el>12?'day':sun.el>-4?'golden':sun.el>-10?'twilight':'night';
  return{sun,moon,ph,kind,phase,live:true,liveWx:true,temp:null}}
const SKYC={golden:['#f2a98c','#f6c48a','#d9a0c8'],twilight:['#8e7fc4','#c58fb0','#6f6aa8'],night:['#2f3470','#3d3c7c','#252a5a']};
const TINT={day:['#ffffff',0],golden:['#ffb98c',.26],twilight:['#7a6fa8',.45],night:['#30346a',.62]};
const LIGHTS={day:0,golden:.25,twilight:.75,night:1};
const overcast=k=>k!=='clear'&&k!=='partly';
const severe=k=>k==='storm'||k==='downpour'||k==='blizzard';
const isSnow=k=>k==='snow'||k==='blizzard',isRain=k=>k==='rain'||k==='storm'||k==='downpour';
function skyXY(o){const hy=GYc-230;return[CW/2+(o.az-180)/80*CW*.5,hy-Math.max(-.3,o.el)/55*(hy-170)]}

// Perf (Nov 2026): the sky is redrawn whenever the sun moves a degree, every
// few minutes. Resizing every canvas and re-graining the paper pixel by pixel
// each time stalled the app for ~85 ms (and wiped the WebGL layers), so the
// canvases only resize when the screen size changes and the paper grain is
// made once per size. Returns whether the size changed.
let SKYSIZE='',GRAIN=null,BAND=0,litOn=true;
function drawSky(){const w=SIZE.w,h=SIZE.h;dpr=Math.min(2,window.devicePixelRatio||1);
  const sz=Math.round(w*dpr)+'x'+Math.round(h*dpr),resized=sz!==SKYSIZE;
  if(resized){SKYSIZE=sz;GRAIN=null;litOn=true;for(const c of[skyC,cloudC,glC,carC,glFC,fxC,glLC,topC]){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}}
  kc=Math.min(w/800,h/1731);CW=w/kc;Hc=h/kc;GYc=Hc*.7;
  // the strips start at the back skyline's top (GYc-750); nothing above it is ground
  BAND=Math.max(0,Math.floor((GYc-Gb-10-4)*dpr*kc));
  ctx=skyC.getContext('2d');W=CW;H=Hc;R=mulberry(137724);nz=noise1();
  if(!GRAIN){GRAIN=newCanvas(skyC.width,skyC.height);const g=GRAIN.getContext('2d');g.fillStyle='#fbf8f1';g.fillRect(0,0,GRAIN.width,GRAIN.height);
    const id=g.getImageData(0,0,GRAIN.width,GRAIN.height),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*9;d[i]+=n;d[i+1]+=n;d[i+2]+=n}g.putImageData(id,0,0)}
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(GRAIN,0,0);ctx.setTransform(dpr*kc,0,0,dpr*kc,0,0);
  let cols=M.phase==='day'?PAL[P.pal].sky:SKYC[M.phase];
  if(overcast(M.kind))cols=cols.map(c=>mix(c,M.kind==='storm'||M.kind==='downpour'?'#6f6c80':M.kind==='rain'?'#9b98aa':M.kind==='blizzard'?'#d9dbe4':'#c4c1cc',M.kind==='fog'||M.kind==='blizzard'?.8:.6));
  // open sky: just a faint wash that thins toward the horizon
  if(M.kind==='storm'){const gr=ctx.createLinearGradient(0,0,0,GYc);const dk=M.phase==='day'||M.phase==='golden';gr.addColorStop(0,dk?'rgba(62,60,80,.88)':'rgba(30,30,46,.92)');gr.addColorStop(.75,dk?'rgba(92,90,108,.78)':'rgba(44,44,62,.88)');gr.addColorStop(1,dk?'rgba(120,118,134,.6)':'rgba(56,56,74,.8)');ctx.fillStyle=gr;ctx.fillRect(0,0,CW,GYc+40);ctx.fillStyle=dk?'rgba(120,118,134,.6)':'rgba(56,56,74,.8)';ctx.fillRect(0,GYc+40,CW,Hc)}
  {const gr=ctx.createLinearGradient(0,0,0,GYc-150);const al={day:.10,golden:.18,twilight:.22,night:.3}[M.phase]*(overcast(M.kind)?1.8:1);gr.addColorStop(0,hexA(cols[0],al));gr.addColorStop(1,hexA(cols[cols.length-1],0));ctx.fillStyle=gr;ctx.fillRect(0,0,CW,GYc)}
  
  // a watercolour sun; low ones sink behind the city
  if(M.sun.el>-3&&!(overcast(M.kind)&&M.kind!=='fog')){const[x,y]=skyXY(M.sun);const warm=M.sun.el<12;const r=34;
    softFill(()=>{ctx.beginPath();ctx.arc(x,y,r*2.4,0,7)},hexA(warm?'#f6a96a':'#f8d77a',M.kind==='fog'?.18:.3),18);
    ctx.save();ctx.translate(x,y);wash(Array.from({length:24},(_,i)=>[Math.cos(i/24*6.283)*r,Math.sin(i/24*6.283)*r]),warm?'#f08a4b':'#f6c34a',.9,.6);
    ctx.beginPath();for(let i=0;i<=40;i++){const a=i/40*6.283,rr=r*(1+.04*nz(i*.7));i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(rr,0)}ctx.strokeStyle=hexA('#1d1b20',.85);ctx.lineWidth=1.8;ctx.stroke();
    if(!warm)for(let i=0;i<10;i++){const a=i/10*6.283+.2;seg(Math.cos(a)*(r+9),Math.sin(a)*(r+9),Math.cos(a)*(r+20),Math.sin(a)*(r+20),1.6)}
    ctx.restore()}
  return resized;
}
function makeClouds(){const out=[];for(let i=0;i<10;i++){const s=newCanvas(340,170);ctx=s.getContext('2d');R=mulberry(500+i);nz=noise1();
    const w=rnd(150,280),n=noise1(),pts=[];const bumps=Math.round(rnd(3,6)),hA=rnd(10,16),hB=rnd(50,58);
    for(let k=0;k<=60;k++){const t=k/60;const x=-w/2+t*w;const top=-Math.abs(Math.sin(t*Math.PI*bumps))*hA-Math.sin(t*Math.PI)*hB;pts.push([x,top+n(k*.3)*3])}
    pts.push([w/2,-4]);for(let k=0;k<=20;k++){pts.push([w/2-k/20*w,n(k*.5+40)*3])}
    out.push({img:s,pts,seed:500+i})}return out}
function paintCloud(cl,col,ink){const x=cl.img.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,cl.img.width,cl.img.height);ctx=x;ctx.translate(170,140);R=mulberry(cl.seed);nz=noise1();
  wash(cl.pts,col,.85,.8);inkLine(cl.pts.slice(0,61),1.6,hexA('#1d1b20',ink))}

// ---------- wiring and the frame loop
const mk=(tag,z)=>{const e=document.createElement(tag);e.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';root.appendChild(e);return e};
const skyC=mk('canvas'),cloudC=mk('canvas'),glC=mk('canvas'),carC=mk('canvas'),glFC=mk('canvas'),fxC=mk('canvas'),tint=mk('div'),glLC=mk('canvas'),topC=mk('canvas');
tint.style.mixBlendMode='multiply';tint.style.visibility='hidden';let tintT=0;tint.style.transition='background-color 1.2s,opacity 1.2s';tint.style.opacity='0';const status={style:{},innerHTML:''};let SIZE={w:390,h:844};
let dpr,kc,Hc,GYc,Rg=P.Rg,off=0,speed=36,playing=true,curveV=rgToCurve(P.Rg);
let TOWER=null,GLm,GLf,GLl,city,front,backTex,cloudSprites,clouds=[],drops=[],flash=0,stars=[],birds=[];
let PILES=null,pileT=1;
function makePiles(){if(!isSnow(M.kind)){PILES=null;return}const big=M.kind==='blizzard'?1.5:1;const mk=(side)=>{const w=rr(330,410)*big,h=rr(230,280)*Math.min(big,1.25),pts=[];const n=26;
    for(let i=0;i<=n;i++){const u=i/n;const x=u*w;const y=h*Math.pow(1-u,2.1)+Math.sin(u*14+side)*5*(1-u)+(u>.1&&u<.6?Math.sin(u*31)*3:0);pts.push([x,y])}return{pts,side}};PILES=[mk(0),mk(1)]}
function drawPiles(g){const k=.4+.6*pileT;for(const p of PILES){g.save();if(p.side){g.translate(CW,Hc);g.scale(-1,1)}else g.translate(0,Hc);g.scale(1,k);
    g.beginPath();g.moveTo(0,0);for(const[x,y]of p.pts)g.lineTo(x,-y);g.lineTo(p.pts[p.pts.length-1][0],0);g.closePath();g.fillStyle='#fbfbfd';g.fill();
    g.save();g.clip();g.fillStyle='rgba(176,184,214,.35)';g.beginPath();g.moveTo(0,0);for(const[x,y]of p.pts)g.lineTo(x,-y*.45);g.lineTo(p.pts[p.pts.length-1][0],0);g.closePath();g.fill();g.restore();
    g.beginPath();p.pts.forEach(([x,y],i)=>i?g.lineTo(x,-y):g.moveTo(x,-y));g.strokeStyle='#1d1b20';g.lineWidth=2/k**.3;g.lineCap='round';g.stroke();
    for(let i=0;i<4;i++){const q=p.pts[4+i*4];g.beginPath();g.moveTo(q[0]-8,-q[1]+10);g.quadraticCurveTo(q[0],-q[1]+6,q[0]+10,-q[1]+12);g.strokeStyle='rgba(29,27,32,.45)';g.lineWidth=1.2;g.stroke()}g.restore()}}
function applyMood(force){const m=computeMood();const key=[m.phase,m.kind,Math.round(m.sun.el),Math.round(m.sun.az)].join();if(!force&&key===M.key){Object.assign(M,m);updateStatus();return}
  const prevKind=M.kind;M=Object.assign(m,{key});const resized=drawSky();
  const t=TINT[M.phase];let tc=t[0],ta=t[1];if(overcast(M.kind)&&M.phase==='day'){tc=M.kind==='storm'?'#8a879c':'#c9c6d4';ta=M.kind==='storm'?.62:M.kind==='downpour'?.45:M.kind==='rain'?.3:M.kind==='blizzard'?.22:.18}
  tint.style.backgroundColor=tc;tint.style.opacity=ta;
  // a multiply layer costs a blend of everything under it even at opacity 0, so it's switched off once it has faded out
  clearTimeout(tintT);if(ta>0)tint.style.visibility='visible';else tintT=setTimeout(()=>{tint.style.visibility='hidden'},1300);status.style.color=(M.phase==='night'||M.phase==='twilight'||M.kind==='storm')?'#f5efe2':'#1d1b20';
  const ccol=M.kind==='storm'?'#6a6780':M.kind==='downpour'?'#8d8a9e':M.kind==='rain'?'#b1aebf':overcast(M.kind)?'#dcd8e2':'#ffffff';
  cloudSprites.forEach(c=>paintCloud(c,ccol,M.kind==='fog'?.35:.8));
  const nC={clear:1,partly:4,cloudy:9,rain:9,downpour:10,storm:22,snow:8,blizzard:10,fog:4}[M.kind];
  if(prevKind!==M.kind||clouds.length!==nC){clouds=[];for(let i=0;i<nC;i++)clouds.push(M.kind==='storm'?{s:cloudSprites[i%cloudSprites.length],x:(i%6)/6*(CW+340)-200+Math.random()*80,y:-60+Math.floor(i/6)*Math.max(120,(GYc-520)/3)+Math.random()*60,v:Math.random()*8+6,sc:1.3+Math.random()*.6}:{s:cloudSprites[i%cloudSprites.length],x:Math.random()*(CW+300)-150,y:GYc-920+Math.random()*360,v:Math.random()*8+4,sc:.7+Math.random()*.6})}
  const nD={rain:160,storm:240,downpour:460,snow:220,blizzard:420}[M.kind]||0;if(resized||prevKind!==M.kind||drops.length!==nD){drops=[];for(let i=0;i<nD;i++)drops.push({x:Math.random()*CW,y:Math.random()*Hc,v:M.kind==='snow'?Math.random()*30+30:M.kind==='blizzard'?Math.random()*80+90:M.kind==='downpour'?Math.random()*300+900:Math.random()*300+600,w:Math.random()*6})}
  if(isSnow(M.kind)&&!isSnow(prevKind))pileT=prevKind===undefined?1:0;if(resized||prevKind!==M.kind)makePiles();
  if(resized||!stars.length){stars=[];for(let i=0;i<70;i++)stars.push({x:Math.random()*CW,y:Math.random()*(GYc-520),r:Math.random()*1.6+.6,tw:Math.random()*6})}
  updateStatus()}
function updateStatus(){}

function frame(dt,t){
  if(playing&&!drag)off=(off+speed*dt)%L;if(!drag&&Math.abs(fling)>1){off+=fling*dt;fling*=Math.pow(.05,dt)}
  off=(off%L+L)%L;const offF=(off*1.35)%Lf,offB=(off*.5)%Lb;const cx=CW/2,cy=GYc+Rg;
  GLm.clear();GLm.draw(backTex,{Rg:Rg+10,off:offB,L:Lb,G:Gb,TH:THb,A:.75});GLm.draw(city.tex,{Rg,off,L,G,TH});GLf.clear();GLf.draw(front.tex,{Rg:Rg-FRONT,off:offF,L:Lf,G:Gf,TH:THf});
  const la=LIGHTS[M.phase]*(overcast(M.kind)&&M.phase==='day'?.3:1);if(la>0||litOn){GLl.clear();litOn=la>0}if(la>0){GLl.draw(city.ltex,{Rg,off,L,G,TH,A:la});GLl.erase(front.mask,{Rg:Rg-FRONT,off:offF,L:Lf,G:Gf,TH:THf});GLl.draw(front.ltex,{Rg:Rg-FRONT,off:offF,L:Lf,G:Gf,TH:THf,A:la})}
  const cc=cloudC.getContext('2d');cc.setTransform(1,0,0,1,0,0);cc.clearRect(0,0,cloudC.width,cloudC.height);cc.setTransform(dpr*kc,0,0,dpr*kc,0,0);
  for(const c of clouds){if(playing)c.x+=c.v*dt*(severe(M.kind)?2.5:1);if(c.x>CW+200)c.x=-340;cc.drawImage(c.s.img,c.x,c.y,340*c.sc,170*c.sc)}
  let f=fxC.getContext('2d');f.setTransform(1,0,0,1,0,0);f.clearRect(0,0,fxC.width,fxC.height);f.setTransform(dpr*kc,0,0,dpr*kc,0,0);
  const f0=f;{const k=carC.getContext('2d');k.setTransform(1,0,0,1,0,0);k.clearRect(0,0,carC.width,carC.height);k.setTransform(dpr*kc,0,0,dpr*kc,0,0);f=k}
  for(const c of city.cars){if(playing)c.x=(c.x+c.v*dt+L)%L;let dx=c.x-off;dx=((dx%L)+L*1.5)%L-L/2;const a=dx/Rg;if(Math.abs(dx)>CW*.8||Math.abs(a)>1.4)continue;
    const r=Rg-c.lane;f.save();f.translate(cx+Math.sin(a)*r,cy-Math.cos(a)*r);f.rotate(a);f.scale((c.v<0?-1.3:1.3)*(c.face||1),1.3);f.drawImage(c.img,-(c.ox||60),-(c.oy||60));f.restore()}
  f=f0;
  for(const w of front.walkers){if(playing){w.x=(w.x+w.v*dt+Lf)%Lf;w.ph+=dt*7}const r=Rg-FRONT;let dx=w.x-offF;dx=((dx%Lf)+Lf*1.5)%Lf-Lf/2;const a=dx/r;if(Math.abs(dx)>CW*.8||Math.abs(a)>1.4)continue;
    f.save();f.translate(cx+Math.sin(a)*r,cy-Math.cos(a)*r);f.rotate(a+Math.sin(w.ph)*.05);f.scale(w.v<0?-1:1,1);f.drawImage(w.img,-65,-144-Math.abs(Math.sin(w.ph))*2);f.restore()}
  if((M.phase==='day'||M.phase==='golden')&&!overcast(M.kind))for(const b of birds){if(playing){b.x+=b.v*dt;b.ph+=dt*6}if(b.x>CW+60){b.x=-60;b.y=Math.random()*400+GYc-820}
    f.drawImage(b.fr[Math.sin(b.ph)>0?0:1],b.x-20,b.y+Math.sin(t/900+b.bob)*6-12)}
  // moon, stars, rain, snow, fog and lightning sit above the tint so they stay bright
  const g=topC.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,topC.width,topC.height);g.setTransform(dpr*kc,0,0,dpr*kc,0,0);
  const dark=M.phase==='night'||M.phase==='twilight';
  drawCampfires(g,t,dark,offF);drawAnims(carC.getContext('2d'),g,t,dark);
  if(dark&&(M.kind==='clear'||M.kind==='partly')){for(const s of stars){g.globalAlpha=(M.phase==='night'?.9:.45)*(.6+.4*Math.sin(t/700+s.tw));g.fillStyle='#fff6d8';g.beginPath();g.arc(s.x,s.y,s.r,0,7);g.fill()}g.globalAlpha=1}
  if(M.sun.el<-2&&M.moon.el>6&&!(overcast(M.kind)&&M.kind!=='fog')){let[x,y]=skyXY(M.moon);y=Math.min(y,GYc-500);const r=24;
    g.save();g.translate(x,y);const glow=g.createRadialGradient(0,0,r,0,0,r*3);glow.addColorStop(0,'rgba(255,246,214,.35)');glow.addColorStop(1,'rgba(255,246,214,0)');g.fillStyle=glow;g.fillRect(-r*3,-r*3,r*6,r*6);
    g.beginPath();g.arc(0,0,r,0,7);g.fillStyle='#f6eed2';g.fill();
    const k=Math.cos(M.ph*2*Math.PI);g.save();g.beginPath();g.arc(0,0,r+.5,0,7);g.clip();g.fillStyle='rgba(48,52,106,.85)';g.beginPath();
    if(M.ph<.5){g.arc(0,0,r+1,Math.PI/2,-Math.PI/2,false);g.ellipse(0,0,Math.abs(k)*r+.01,r+1,0,-Math.PI/2,Math.PI/2,k<0)}else{g.arc(0,0,r+1,-Math.PI/2,Math.PI/2,false);g.ellipse(0,0,Math.abs(k)*r+.01,r+1,0,Math.PI/2,-Math.PI/2,k<0)}
    g.fill();g.restore();g.beginPath();g.arc(0,0,r,0,7);g.strokeStyle='#1d1b20';g.lineWidth=1.6;g.stroke();g.restore()}
  if(isRain(M.kind)){const dp=M.kind==='downpour';g.strokeStyle=dark?'rgba(220,225,255,.55)':`rgba(40,40,60,${dp?.5:.45})`;g.lineWidth=dp?1.6:1.4;g.lineCap='round';g.beginPath();const sl=dp?.32:.18,ln=dp?30:18;
    for(const d of drops){if(playing){d.y+=d.v*dt;d.x+=d.v*sl*dt}if(d.y>Hc){d.y=-30;d.x=Math.random()*CW}if(d.x>CW)d.x-=CW;g.moveTo(d.x,d.y);g.lineTo(d.x-ln*sl,d.y-ln)}g.stroke();
    if(dp){g.strokeStyle=dark?'rgba(220,225,255,.6)':'rgba(40,40,60,.5)';g.lineWidth=1.1;g.beginPath();for(let i=0;i<26;i++){const x=Math.random()*CW,y=GYc+30+Math.random()*120;g.moveTo(x-4,y-5);g.lineTo(x,y);g.lineTo(x+4,y-5)}g.stroke();
      const gr=g.createLinearGradient(0,0,0,Hc);gr.addColorStop(0,'rgba(120,125,150,.10)');gr.addColorStop(1,'rgba(120,125,150,.22)');g.fillStyle=gr;g.fillRect(0,0,CW,Hc)}}
  if(M.kind==='snow'){g.fillStyle='#ffffff';g.strokeStyle='rgba(40,40,60,.55)';g.lineWidth=.9;for(const d of drops){if(playing){d.y+=d.v*dt;d.x+=Math.sin(t/800+d.w)*12*dt}if(d.y>Hc){d.y=-10;d.x=Math.random()*CW}g.beginPath();g.arc(d.x,d.y,4+d.w*.5,0,7);g.fill();g.stroke()}}
  if(M.kind==='blizzard'){const gr=g.createLinearGradient(0,0,0,Hc);gr.addColorStop(0,'rgba(250,250,252,.35)');gr.addColorStop(.6,'rgba(250,250,252,.5)');gr.addColorStop(1,'rgba(250,250,252,.3)');g.fillStyle=gr;g.fillRect(0,0,CW,Hc);
    g.fillStyle='#ffffff';g.strokeStyle='rgba(40,40,60,.5)';g.lineWidth=.8;const gust=1+.6*Math.sin(t/1300);
    for(const d of drops){if(playing){d.y+=d.v*dt;d.x+=(260+d.w*30)*gust*dt}if(d.y>Hc){d.y=-10;d.x=Math.random()*CW}if(d.x>CW+10){d.x=-10;d.y=Math.random()*Hc}g.beginPath();g.ellipse(d.x,d.y,3.5+d.w*.4,2.2+d.w*.25,.25,0,7);g.fill();g.stroke()}
    g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=2;g.beginPath();for(let i=0;i<10;i++){const y=(i*173+t/9)%Hc,x=(i*311+t/2.2)%(CW+200)-100;g.moveTo(x,y);g.quadraticCurveTo(x+40,y-8,x+90,y+2)}g.stroke()}
  if(isSnow(M.kind)&&PILES){if(playing)pileT=Math.min(1,pileT+dt/10);drawPiles(g)}
  if(M.kind==='fog'){for(let i=0;i<4;i++){const y=GYc-260+i*90,x=((t/60*(i%2?1:-1)*(8+i*3))%(CW*2)+CW*2)%(CW*2)-CW*.5;const gr=g.createLinearGradient(0,y-60,0,y+60);gr.addColorStop(0,'rgba(251,248,241,0)');gr.addColorStop(.5,'rgba(251,248,241,.55)');gr.addColorStop(1,'rgba(251,248,241,0)');g.fillStyle=gr;g.fillRect(x-CW,y-60,CW*2.2,120)}}
  if(M.kind==='storm'&&playing){if(Math.random()<dt*.15)flash=1;if(flash>0){g.fillStyle=`rgba(255,255,245,${flash*.55})`;g.fillRect(0,0,CW,Hc);
    if(flash>.8){g.strokeStyle='#fff8d0';g.lineWidth=3;g.beginPath();let x=Math.random()*CW,y=GYc-700;g.moveTo(x,y);while(y<GYc-300){x+=Math.random()*40-20;y+=Math.random()*40+20;g.lineTo(x,y)}g.stroke()}flash-=dt*2.5}}
  if(TOWER){let dx=TOWER.x-off;dx=((dx%L)+L*1.5)%L-L/2;const a=dx/Rg;if(Math.abs(dx)<CW*.8){const r=Rg+TOWER.top,x=cx+Math.sin(a)*r,y=cy-Math.cos(a)*r,on=(t/1000)%1.4<.7;
    if(on){const gl2=f.createRadialGradient(x,y,1,x,y,dark?26:14);gl2.addColorStop(0,'rgba(255,90,70,.9)');gl2.addColorStop(1,'rgba(255,90,70,0)');f.fillStyle=gl2;f.fillRect(x-30,y-30,60,60)}
    f.beginPath();f.arc(x,y,4,0,7);f.fillStyle=on?'#ff5a46':'#8a3d3d';f.fill();f.strokeStyle='#1d1b20';f.lineWidth=1.2;f.stroke();
    const wv=(t/1000)%5;if(wv<2.4)for(let i=0;i<3;i++){const k=(wv-i*.4)/1.6;if(k<0||k>1)continue;f.globalAlpha=1-k;f.beginPath();f.arc(x,y,12+k*60,-2.4+a,-.74+a);f.strokeStyle=dark?'#fff0c8':'#1d1b20';f.lineWidth=1.6;f.stroke();f.beginPath();f.arc(x,y,12+k*60,-2.4+a+Math.PI*1.0-.0,-.74+a+Math.PI*1.0);f.globalAlpha=0;f.stroke();f.globalAlpha=1}}}
  drawGondola(f,t,dark);
  for(const s of SMOKE){let dx=s.x-off;dx=((dx%L)+L*1.5)%L-L/2;if(Math.abs(dx)>CW*.8)continue;const a=dx/Rg,r=Rg+s.top,x=cx+Math.sin(a)*r,y=cy-Math.cos(a)*r;
    for(let i=0;i<5;i++){const q=((t/1000)*.35+i/5+s.ph)%1;f.globalAlpha=(1-q)*(dark?.45:.75);f.beginPath();f.arc(x+q*28+Math.sin(q*6+i)*4,y-q*80,3+q*9,0,7);f.fillStyle='#f3efe6';f.fill();f.strokeStyle='#1d1b20';f.lineWidth=1;f.stroke()}f.globalAlpha=1}
  runEvents(dt,{sky:cc,front:f,top:g,cars:carC.getContext('2d')});
  skyC.style.transform=`translateX(${Math.sin(t/7000)*1.2}%)`;
}
// ---------- random moments: picked to fit the real time, weather and season
const rr=(a,b)=>a+(b-a)*Math.random();
const INKC='#1d1b20';
function inkStroke(c,lw=1.8){c.strokeStyle=INKC;c.lineWidth=lw;c.lineCap='round';c.lineJoin='round';c.stroke()}
const clear=m=>m.kind==='clear'||m.kind==='partly';
const isDay=m=>m.phase==='day'||m.phase==='golden';
const isDark=m=>m.phase==='night'||m.phase==='twilight';
const autumn=()=>{const mo=new Date().getMonth();return mo>=8&&mo<=10};
const EVDEF={
  shootingStar:{name:'Shooting star',layer:'top',dur:1.6,w:m=>isDark(m)&&clear(m)?3:0,
    init(e){e.x=rr(120,680);e.y=rr(80,GYc-760);e.s=Math.random()<.5?1:-1},
    draw(c,e,p){const len=560,dx=e.s*.86,dy=.5,hx=e.x+dx*len*p,hy=e.y+dy*len*p,tl=170;const a=p>.75?(1-p)/.25:1;
      const gr=c.createLinearGradient(hx-dx*tl,hy-dy*tl,hx,hy);gr.addColorStop(0,'rgba(255,246,214,0)');gr.addColorStop(1,`rgba(255,246,214,${.95*a})`);
      c.strokeStyle=gr;c.lineWidth=2.6;c.lineCap='round';c.beginPath();c.moveTo(hx-dx*tl,hy-dy*tl);c.lineTo(hx,hy);c.stroke();
      c.globalAlpha=a;c.fillStyle='#fff6d8';c.beginPath();for(let i=0;i<10;i++){const r=i%2?2.2:6,an=i/10*6.283;c.lineTo(hx+Math.cos(an)*r,hy+Math.sin(an)*r)}c.closePath();c.fill();c.globalAlpha=1}},
  ufo:{name:'UFO',layer:'top',dur:10,w:m=>severe(m.kind)?0:.7,
    init(e){e.s=Math.random()<.5?1:-1;e.tx=rr(260,540);e.y=GYc-rr(560,640)},
    draw(c,e,p,t){const s=e.s,start=s>0?-90:CW+90,end=s>0?CW+120:-120;let x,y=e.y+Math.sin(t*2.2)*6;
      if(p<.3)x=start+(e.tx-start)*(1-Math.pow(1-p/.3,3));else if(p<.72)x=e.tx+Math.sin(t*1.3)*8;else{const q=(p-.72)/.28;x=e.tx+(end-e.tx)*q*q;y-=q*q*260}
      if(p>.38&&p<.68){const b=Math.min(1,(p-.38)/.05,(.68-p)/.05);c.fillStyle=`rgba(255,236,150,${.38*b})`;c.beginPath();c.moveTo(x-14,y+6);c.lineTo(x+14,y+6);c.lineTo(x+70,GYc);c.lineTo(x-70,GYc);c.closePath();c.fill()}
      c.save();c.translate(x,y);c.scale(1.3,1.3);c.rotate(p<.3?.12*s*(1-p/.3):p>.72?-.18*s:0);
      c.beginPath();c.ellipse(0,-6,15,13,0,Math.PI,0);c.fillStyle='rgba(196,232,240,.95)';c.fill();inkStroke(c,1.6);
      c.beginPath();c.ellipse(0,0,38,10,0,0,7);c.fillStyle='#b9bfcc';c.fill();inkStroke(c,1.8);
      c.beginPath();c.moveTo(-34,1);c.quadraticCurveTo(0,8,34,1);inkStroke(c,1.1);
      ['#c8553d','#e9b949','#7fb0e6'].forEach((col,i)=>{c.fillStyle=(Math.floor(t*4)+i)%3?col:'#fff6d8';c.beginPath();c.arc(-18+i*18,4,3,0,7);c.fill()});c.restore()}},
  plane:{name:'Plane',layer:'sky',dur:24,w:m=>isDay(m)&&!severe(m.kind)&&m.kind!=='fog'?2.2:0,
    init(e){e.s=Math.random()<.5?1:-1;e.y=GYc-rr(620,760);e.banner=Math.random()<.4},
    draw(c,e,p){const s=e.s,x=s>0?-140+(CW+300)*p:CW+140-(CW+300)*p,y=e.y-p*20;
      c.save();c.setLineDash([10,9]);c.beginPath();c.moveTo(x-s*30,y+1);c.lineTo(x-s*(30+260),y+8);c.strokeStyle='rgba(29,27,32,.35)';c.lineWidth=1.4;c.stroke();c.restore();
      if(e.banner){const bx=x-s*60;c.beginPath();c.moveTo(x-s*22,y+2);c.lineTo(bx,y+6);inkStroke(c,1);const w=118,x0=s>0?bx-w:bx;
        c.beginPath();for(let i=0;i<=12;i++){const xx=x0+i/12*w;c.lineTo(xx,y-4+Math.sin(i*.9+p*90)*2)}for(let i=12;i>=0;i--){const xx=x0+i/12*w;c.lineTo(xx,y+18+Math.sin(i*.9+p*90)*2)}c.closePath();c.fillStyle='#fbf3df';c.fill();inkStroke(c,1.3);
        c.fillStyle=INKC;c.font='700 15px '+HANDF;c.textAlign='center';c.fillText('TopTrack ♪',x0+w/2,y+12)}
      c.save();c.translate(x,y);c.scale(s*1.5,1.5);c.beginPath();c.moveTo(-26,0);c.quadraticCurveTo(0,-6,24,-1);c.quadraticCurveTo(28,1,24,3);c.lineTo(-24,3);c.closePath();c.fillStyle='#f3efe6';c.fill();inkStroke(c,1.6);
      c.beginPath();c.moveTo(-4,0);c.lineTo(-12,10);c.lineTo(-4,10);c.lineTo(6,1);inkStroke(c,1.4);c.beginPath();c.moveTo(-22,0);c.lineTo(-28,-10);c.lineTo(-22,-10);c.lineTo(-14,-1);inkStroke(c,1.4);
      for(let i=0;i<4;i++){c.beginPath();c.arc(-10+i*7,-1,1,0,7);c.fillStyle=INKC;c.fill()}c.restore()}},
  balloon:{name:'Hot air balloon',layer:'sky',dur:30,w:m=>isDay(m)&&clear(m)?1.4:0,
    init(e){e.s=Math.random()<.5?1:-1;e.y=GYc-rr(520,640)},
    draw(c,e,p,t){const x=e.s>0?-60+(CW+120)*p:CW+60-(CW+120)*p,y=e.y-p*120+Math.sin(t*.8)*4;c.save();c.translate(x,y);
      c.beginPath();c.moveTo(0,32);c.bezierCurveTo(-38,8,-38,-40,0,-40);c.bezierCurveTo(38,-40,38,8,0,32);c.closePath();c.save();c.clip();
      const cols=['#c8553d','#e9b949','#f3efe6','#7fb0e6'];for(let i=0;i<8;i++){c.fillStyle=cols[i%4];c.fillRect(-40+i*10,-45,10,80)}c.restore();
      c.beginPath();c.moveTo(0,32);c.bezierCurveTo(-38,8,-38,-40,0,-40);c.bezierCurveTo(38,-40,38,8,0,32);inkStroke(c,1.7);
      c.beginPath();c.moveTo(-8,30);c.lineTo(-7,42);c.moveTo(8,30);c.lineTo(7,42);inkStroke(c,1.1);c.beginPath();c.rect(-8,42,16,11);c.fillStyle='#b5835a';c.fill();inkStroke(c,1.4);c.restore()}},
  blimp:{name:'Blimp',layer:'sky',dur:34,w:m=>isDay(m)&&!severe(m.kind)&&m.kind!=='rain'?.8:0,
    init(e){e.s=Math.random()<.5?1:-1;e.y=GYc-rr(600,700)},
    draw(c,e,p){const x=e.s>0?-120+(CW+240)*p:CW+120-(CW+240)*p;c.save();c.translate(x,e.y);c.scale(e.s,1);
      c.beginPath();c.moveTo(-58,0);c.lineTo(-72,-14);c.lineTo(-66,0);c.lineTo(-72,14);c.closePath();c.fillStyle='#c8553d';c.fill();inkStroke(c,1.4);
      c.beginPath();c.ellipse(0,0,64,20,0,0,7);c.fillStyle='#d9d3e3';c.fill();inkStroke(c,1.8);c.beginPath();c.moveTo(-50,-6);c.quadraticCurveTo(0,-14,50,-6);c.strokeStyle='rgba(29,27,32,.5)';c.lineWidth=1;c.stroke();
      c.beginPath();c.rect(-12,19,24,7);c.fillStyle='#f3efe6';c.fill();inkStroke(c,1.3);c.restore()}},
  flock:{name:'Bird flock',layer:'sky',dur:16,w:m=>isDay(m)&&!overcast(m.kind)?1.6:0,
    init(e){e.y=GYc-rr(640,780)},
    draw(c,e,p,t){const lead=-80+(CW+260)*p;for(let i=0;i<9;i++){const row=Math.ceil(i/2),side=i%2?1:-1,x=lead-row*22,y=e.y+side*row*12+Math.sin(t*5+i)*2;
      const up=Math.sin(t*9+i)>0;c.beginPath();c.moveTo(x-9,y+(up?-5:2));c.quadraticCurveTo(x-4,y-2,x,y+1);c.quadraticCurveTo(x+4,y-2,x+9,y+(up?-5:2));inkStroke(c,1.5)}}},
  fireworks:{name:'Fireworks',layer:'top',dur:6,w:m=>isDark(m)&&clear(m)?.9:0,
    init(e){e.b=[0,1,2].map(i=>({x:rr(160,640),y:GYc-rr(560,700),t0:i*1.4+rr(0,.4),col:['#c8553d','#e9b949','#7fb0e6','#f0b7a4','#9fb38a'][Math.floor(rr(0,5))]}))},
    draw(c,e,p){const tt=p*6;for(const b of e.b){const q=(tt-b.t0)/1.8;if(q<0||q>1)continue;
      if(q<.25){const yy=GYc-200+(b.y-(GYc-200))*(q/.25);c.beginPath();c.moveTo(b.x,yy+20);c.lineTo(b.x,yy);c.strokeStyle='rgba(255,246,214,.8)';c.lineWidth=2;c.stroke();continue}
      const k=(q-.25)/.75,r=14+k*120,a=1-k;c.globalAlpha=a;for(let i=0;i<16;i++){const an=i/16*6.283,x1=b.x+Math.cos(an)*r*.6,y1=b.y+Math.sin(an)*r*.6+k*14,x2=b.x+Math.cos(an)*r,y2=b.y+Math.sin(an)*r+k*18;
        c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=b.col;c.lineWidth=3.2;c.lineCap='round';c.stroke();c.strokeStyle='rgba(255,246,214,.8)';c.lineWidth=1;c.stroke()}c.globalAlpha=1}}},
};
let EVS=[],nextEv=5,clock=0;
function startEvent(type){const d=EVDEF[type];const e={type,t0:clock};d.init(e);EVS.push(e)}
function pickEvent(){const list=Object.entries(EVDEF).map(([k,d])=>[k,(d.scenes&&!d.scenes.includes(SCENE))?0:d.w(M)]).filter(x=>x[1]>0);const tot=list.reduce((a,x)=>a+x[1],0);if(!tot)return null;let r=Math.random()*tot;for(const[k,w]of list){if((r-=w)<0)return k}return list[0][0]}
function runEvents(dt,layers){if(playing)clock+=dt;
  if(playing&&clock>nextEv){const k=pickEvent();if(k)startEvent(k);nextEv=clock+rr(9,20)}
  EVS=EVS.filter(e=>clock-e.t0<EVDEF[e.type].dur);
  for(const e of EVS){const d=EVDEF[e.type],c=layers[d.layer];c.save();d.draw(c,e,(clock-e.t0)/d.dur,clock);c.restore()}}

// ================= MOUNTAIN SCENE (same toolkit, same planet) =================
const MP={rock:['#a49fb5','#8f8aa3','#b3a9bf','#9d93a8'],pine:['#7d9c6c','#5f7f5a','#8fae7a','#6b8f73','#587a5e'],wood:['#b5835a','#c9744a','#a8714a','#d39a62'],
  roof:['#6e6a66','#b4532f','#7f9468','#8a3d3d'],hill:['#9fb38a','#a9b98a','#93ab80'],lake:'#7fa8d8',stone:'#9d97a6'};
let SMOKE=[];
function polyPath(p){ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath()}
function pine(h,col,lw=LW*.8){const w=h*rnd(.34,.44),R3=[],tiers=3;
  for(let i=1;i<=tiers;i++){const y=-h+h*.86*i/tiers,ww=w/2*i/tiers;R3.push([ww+rnd(-1,1),y]);if(i<tiers)R3.push([ww*.42,y-2])}
  const poly=[[0,-h],...R3,...R3.slice().reverse().map(([x,y])=>[-x,y])];
  seg(0,-h*.14,0,0,lw);base(poly);wash(poly,col,.92,.4);inkLine([...poly,poly[0]],lw)}
// big peaks, drawn straight onto the strip
function peak(x0,w,h,col,Gb){const sx=x0+w*rnd(.4,.6),sy=Gb-h,ridge=[];const n=7;
  for(let i=0;i<=n;i++){const t=i/n;ridge.push([x0+(sx-x0)*t,Gb-h*Math.pow(t,1.05)+(i&&i<n?rnd(-1,1)*h*.05:0)])}
  for(let i=1;i<=n;i++){const t=i/n;ridge.push([sx+(x0+w-sx)*t,sy+h*Math.pow(t,.95)+(i<n?rnd(-1,1)*h*.05:0)])}
  const body=[...ridge,[x0+w,Gb+40],[x0,Gb+40]];base(body);wash(body,col,.85,.8);
  // snow cap: the ridge above ~62% plus a zigzag edge
  const cut=Gb-h*.62,cap=ridge.filter(p=>p[1]<cut);if(cap.length>1){const a=cap[0],b=cap[cap.length-1],z=[];const m=8;for(let i=1;i<m;i++){const t=i/m;z.push([b[0]+(a[0]-b[0])*t,cut+rnd(-6,14)])}
    const sp=[...cap,...z];base(sp);ctx.save();polyPath(sp);ctx.fillStyle='#fbf9f4';ctx.fill();ctx.restore();inkLine([b,...z,a],LW*.6)}
  // shadow hatching on the right face, away from the light
  for(let i=0;i<7;i++){const t=rnd(.15,.85),px=sx+(x0+w-sx)*t,py=sy+h*t;if(py<cut+4)continue;seg(px-4,py+4,px-rnd(18,40),py+rnd(26,60),LW*.5)}
  inkLine(ridge,LW*1.05)}
function cabin(primary,big){const w=big?rnd(110,150):rnd(54,84),h=big?rnd(58,76):rnd(34,48),col=pick(MP.wood),roof=pick(MP.roof);const x=-w/2,y=-h;
  const rh=big?rnd(34,46):rnd(22,34),chx=rnd(-w*.3,w*.3),ytop=y-rh*(1-Math.abs(chx)/(w/2+6))-14;
  base(rectPoly(chx-5,ytop,10,y-ytop+2));wash(rectPoly(chx-5,ytop,10,y-ytop+2),MP.stone,.9,.3);inkRect(chx-5,ytop,10,y-ytop+2,LW*.7);
  if(primary){const m=ctx.getTransform();SMOKE.push({x:m.e+chx*m.a,top:G-(m.f+ytop*m.d),ph:Math.random()})}
  base(rectPoly(x,y,w,h));wash(rectPoly(x,y,w,h),col,.85,.5);inkRect(x,y,w,h);for(let yy=y+7;yy<-3;yy+=7)seg(x+2,yy,x+w-2,yy,LW*.4);
  const rp=[[x-6,y],[-x+6,y],[0,y-rh]];base(rp);wash(rp,roof,.88,.4);inkLine([...rp,rp[0]]);
  const rows=big?2:1,cols=big?4:2;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const wx=x+(c+.5)*w/cols-5,wy=y+9+r*24;if(!big&&c===0&&chance(.5))continue;
    ctx.fillStyle='rgba(40,40,50,.55)';ctx.fillRect(wx+1,wy+1,8,8);inkRect(wx,wy,10,10,LW*.6);seg(wx+5,wy,wx+5,wy+10,LW*.4);lit(wx+1,wy+1,8,8)}
  const dx=rnd(-w/4,w/4);base(rectPoly(dx-5,-15,10,15));ctx.fillStyle=pick(['#8a3d3d','#3b3f6e','#c8553d']);ctx.fillRect(dx-5,-15,10,15);inkRect(dx-5,-15,10,15,LW*.7)}
function aframe(primary){const w=rnd(62,84),h=w*rnd(1.0,1.2),roof=pick(['#6e5a4a','#8a3d3d','#5f6b5a','#7a6a8a']),wood=pick(MP.wood);
  const deck=rectPoly(-w/2-8,-8,w+16,8);base(deck);wash(deck,'#a8714a',.9,.3);inkRect(-w/2-8,-8,w+16,8,LW*.7);for(const x of[-w/2-4,w/2+4])seg(x,0,x,-8,LW*.6);
  const tri=[[-w/2,-8],[w/2,-8],[0,-8-h]];base(tri);wash(tri,roof,.9,.5);inkLine([...tri,tri[0]],LW);
  const gi=[[-w/2+9,-8],[w/2-9,-8],[0,-8-h+14]];wash(gi,wood,.92,.3);inkLine([...gi,gi[0]],LW*.8);
  const gl=[[-w/4,-8-h*.18],[w/4,-8-h*.18],[0,-8-h*.62]];ctx.save();polyPath(gl);ctx.fillStyle='rgba(40,40,50,.6)';ctx.fill();ctx.restore();inkLine([...gl,gl[0]],LW*.7);seg(0,-8-h*.18,0,-8-h*.62,LW*.5);seg(-w/8,-8-h*.40,w/8,-8-h*.40,LW*.5);
  if(LCTX){const m=ctx.getTransform();LCTX.save();LCTX.setTransform(m);LCTX.beginPath();gl.forEach((q,i)=>i?LCTX.lineTo(q[0],q[1]):LCTX.moveTo(q[0],q[1]));LCTX.closePath();LCTX.fillStyle='#ffc65e';LCTX.fill();LCTX.restore()}
  const d=rectPoly(-6,-24,12,16);base(d);ctx.fillStyle='#3b3f6e';ctx.fillRect(-6,-24,12,16);inkRect(-6,-24,12,16,LW*.6);
  const px=w*.18,pt=-8-h*.64-16;seg(px,-8-h*.64+4,px,pt,LW*1.2);if(primary){const m=ctx.getTransform();SMOKE.push({x:m.e+px*m.a,top:G-(m.f+pt*m.d),ph:Math.random()})}}
// a smaller snowy ski hill: runs between strips of trees, a gondola to the top, run lights at night
let GONDOLA=null;
function skiHill(x0,w,h,Gb,lctx){const prof=t=>Math.pow(Math.max(0,Math.sin(Math.PI*t)),1.6);const ridge=[];for(let i=0;i<=30;i++){const t=i/30;ridge.push([x0+t*w,Gb-h*prof(t)])}
  const body=[...ridge,[x0+w,Gb+40],[x0,Gb+40]];base(body);ctx.save();polyPath(body);ctx.fillStyle='#fbf9f4';ctx.fill();ctx.restore();
  ctx.save();polyPath([[x0+w*.5,Gb-h],...ridge.slice(15),[x0+w,Gb+40],[x0+w*.55,Gb+40]]);ctx.fillStyle='rgba(176,184,210,.35)';ctx.fill();ctx.restore();
  const ry=x=>Gb-h*prof((x-x0)/w);
  // tree strips between the runs
  const strips=[.22,.36,.5,.64,.78].map(u=>x0+u*w+rnd(-8,8));
  for(const xc of strips){for(let y=ry(xc)+18;y<Gb-12;y+=9){const xx=xc+rnd(-5,5);if(y<ry(xx)+12)continue;ctx.save();ctx.translate(xx,y);pine(rnd(9,15),pick(MP.pine),LW*.45);ctx.restore()}}
  // run lights down the middle of each run
  if(lctx){for(let k=0;k<strips.length-1;k++){const xa=(strips[k]+strips[k+1])/2;for(let y=ry(xa)+18;y<Gb-14;y+=14){const xx=xa+Math.sin(y*.05+k)*6;lctx.save();lctx.setTransform(ctx.getTransform());const g=lctx.createRadialGradient(xx,y,0,xx,y,7);g.addColorStop(0,'rgba(255,236,170,1)');g.addColorStop(1,'rgba(255,220,140,0)');lctx.fillStyle=g;lctx.fillRect(xx-7,y-7,14,14);lctx.restore()}}}
  for(let i=0;i<5;i++){const t=rnd(.55,.9),px=x0+t*w,py=ry(px);seg(px+2,py+6,px+rnd(14,30),py+rnd(30,60),LW*.45)}
  inkLine(ridge,LW*1.05);
  // gondola: bottom station low on the left, top station on the summit
  const bx=x0+w*.08,by=Gb-36,tx=x0+w*.5,ty=Gb-h-2;const cab=[[bx,by]];for(const u of[.22,.42,.62,.8]){const px=bx+(tx-bx)*u;cab.push([px,ry(px)-22])}cab.push([tx,ty]);
  for(const[px,py]of cab.slice(1,-1)){seg(px,py,px,ry(px)+3,LW*.9);seg(px-6,py,px+6,py,LW*.7)}
  {const st=rectPoly(bx-26,Gb-30,40,30);base(st);wash(st,'#b5835a',.9,.3);inkRect(bx-26,Gb-30,40,30,LW*.8);const sr=[[bx-32,Gb-30],[bx+20,Gb-30],[bx-6,Gb-46]];base(sr);wash(sr,'#8a3d3d',.9,.3);inkLine([...sr,sr[0]],LW*.8);
   for(const wx of[bx-20,bx-4]){ctx.fillStyle='rgba(40,40,50,.55)';ctx.fillRect(wx,Gb-24,10,9);inkRect(wx,Gb-24,10,9,LW*.5);if(lctx){lctx.save();lctx.setTransform(ctx.getTransform());lctx.fillStyle='#ffc65e';lctx.fillRect(wx,Gb-24,10,9);lctx.restore()}}}
  ctx.strokeStyle=INK;ctx.lineWidth=LW*.55;for(const o of[0,4]){ctx.beginPath();cab.forEach(([x,y],i)=>i?ctx.lineTo(x,y+o):ctx.moveTo(x,y+o));ctx.stroke()}
  const hut=rectPoly(tx-14,ty-16,28,18);base(hut);wash(hut,'#b5835a',.9,.3);inkRect(tx-14,ty-16,28,18,LW*.8);const hr=[[tx-18,ty-16],[tx+18,ty-16],[tx,ty-28]];base(hr);wash(hr,'#8a3d3d',.9,.3);inkLine([...hr,hr[0]],LW*.8);
  ctx.fillStyle='rgba(40,40,50,.55)';ctx.fillRect(tx-8,ty-12,16,7);if(lctx){lctx.save();lctx.setTransform(ctx.getTransform());lctx.fillStyle='#ffc65e';lctx.fillRect(tx-8,ty-12,16,7);lctx.restore()}
  GONDOLA={pts:cab.map(([x,y])=>[x,G-y])}}
function lookout(){const h=rnd(150,180);seg(-22,0,-12,-h,LW);seg(22,0,12,-h,LW);for(let i=0;i<4;i++){const y0=-i*h/4,y1=-(i+1)*h/4,w0=22-i*2.5,w1=22-(i+1)*2.5;seg(-w0,y0,w1,y1,LW*.6);seg(w0,y0,-w1,y1,LW*.6);seg(-w1,y1,w1,y1,LW*.7)}
  const cb=rectPoly(-22,-h-28,44,28);base(cb);wash(cb,'#b5835a',.9,.3);inkRect(-22,-h-28,44,28);
  for(let i=0;i<3;i++){const wx=-18+i*13;ctx.fillStyle='rgba(40,40,50,.55)';ctx.fillRect(wx,-h-23,10,10);inkRect(wx,-h-23,10,10,LW*.5);lit(wx,-h-23,10,10)}
  const rf=[[-28,-h-28],[28,-h-28],[0,-h-48]];base(rf);wash(rf,'#8a3d3d',.9,.3);inkLine([...rf,rf[0]]);seg(0,-h-48,0,-h-64,LW*.8);
  wash([[0,-h-64],[14,-h-60],[0,-h-56]],'#c8553d',.95,.2);inkLine([[0,-h-64],[14,-h-60],[0,-h-56]],LW*.6)}
function rocks(){const w=rnd(40,90),h=rnd(24,50),n=noise1(),pts=[];for(let i=0;i<=10;i++){const a=Math.PI+i/10*Math.PI;pts.push([Math.cos(a)*w/2*(1+.2*n(i)),Math.sin(a)*h*(1+.25*n(i+9))])}
  base(pts);wash(pts,pick(MP.rock),.88,.5);inkLine(pts,LW*.9);for(let i=0;i<3;i++){const x=rnd(-w/3,w/3);seg(x,-h*rnd(.4,.8),x+rnd(-8,8),-rnd(2,10),LW*.5)}}
function pineCluster(){const n=Math.round(rnd(2,6));const order=[];for(let i=0;i<n;i++)order.push({x:rnd(-40,40),h:rnd(50,140),y:rnd(-6,4)});order.sort((a,b)=>a.y-b.y);
  for(const o of order){ctx.save();ctx.translate(o.x,o.y);pine(o.h,pick(MP.pine));ctx.restore()}}

function buildMountainMain(seed){
  const outerR=mulberry(seed+11);R=outerR;nz=noise1();NOBLUR=true;SMOKE=[];
  const c=newCanvas(L+B,TH),lc=newCanvas(L+B,TH);ctx=c.getContext('2d');LCTX=null;LPER=L;W=c.width;H=c.height;INK='#1d1b20';LW=P.LW;WOB=P.WOB;
  // 1 big peaks
  const peaks=[];let x=-200;while(x<L){const w=rnd(420,820);peaks.push({x,w,h:rnd(300,600),col:pick(MP.rock),s:Math.floor(R()*1e9)});x+=w*rnd(.45,.7)}
  const drawPeak=(pk,xx)=>{R=mulberry(pk.s);nz=noise1();peak(xx,pk.w,pk.h,pk.col,G-50)};
  for(const pk of peaks){drawPeak(pk,pk.x);if(pk.x<B+200)drawPeak(pk,pk.x+L);if(pk.x+pk.w>L-200)drawPeak(pk,pk.x-L)}
  R=outerR;nz=noise1();LCTX=lc.getContext('2d');
  // 2 forested hills (periodic outline so the loop closes)
  const kh=[5,rnd(0,6),1,13,rnd(0,6),.45],hy=x=>G-60-48*(per(x,L,kh)+1.2);
  const top=[];for(let x=-20;x<=L+B+20;x+=14)top.push([x,hy(x)]);const hillPoly=[...top,[L+B+20,G+6],[-20,G+6]];
  base(hillPoly);wash(hillPoly,MP.hill[0],.8,1.2);inkLine(top,LW);
  const tp=[];for(let x=0;x<L;x+=rnd(9,20)){const yt=hy(x),y=yt+rnd(4,Math.max(8,(G-yt)*.85));tp.push({x,y,h:rnd(16,34)*(.6+.5*(y-yt)/(G-yt+1)),s:Math.floor(R()*1e9)})}tp.sort((a,b)=>a.y-b.y);
  const LWs=LW;for(const p of tp){for(const xx of p.x<B+30?[p.x,p.x+L]:[p.x]){R=mulberry(p.s);nz=noise1();ctx.save();ctx.translate(xx,p.y);pine(p.h,pick(MP.pine),LWs*.55);ctx.restore()}}
  LCTX=null;R=outerR;nz=noise1();
  // 3 a lake with a dock and a canoe
  const lx=rnd(700,L-1600),lw=rnd(760,1000);
  {const tp2=[],bt=[];for(let i=0;i<=40;i++){const t=i/40,xx=lx+t*lw,d=Math.min(1,Math.min(t,1-t)*7);tp2.push([xx,G-48*d]);bt.push([xx,G+2])}
   const poly=[...tp2,...bt.reverse()];base(poly);wash(poly,MP.lake,.85,.6);inkLine(tp2,LW*.9);
   for(let i=0;i<26;i++){const xx=lx+rnd(.08,.92)*lw,yy=G-rnd(4,40);seg(xx,yy,xx+rnd(10,26),yy,LW*.45)}
   for(let i=0;i<10;i++){const xx=lx+rnd(.1,.9)*lw;ctx.fillStyle=hexA(pick(MP.pine),.35);ctx.fillRect(xx,G-46,rnd(4,9),rnd(14,26))}
   const dk=lx+lw*rnd(.15,.3);base(rectPoly(dk,G-20,90,6));wash(rectPoly(dk,G-20,90,6),'#b5835a',.9,.3);inkRect(dk,G-20,90,6,LW*.7);for(let i=0;i<4;i++)seg(dk+8+i*26,G-14,dk+8+i*26,G-2,LW*.7);
   const cx0=lx+lw*rnd(.5,.8),cy0=G-26,cn=[[cx0-26,cy0],[cx0+26,cy0],[cx0+18,cy0+7],[cx0-18,cy0+7]];base(cn);wash(cn,'#c8553d',.95,.3);inkLine([...cn,cn[0]],LW*.8);
   seg(cx0-6,cy0,cx0+8,cy0-16,LW*.7)}
  // 3b the ski hill sits on the ground, clear of the lake, with its base station
  let skiX,skiW;{GONDOLA=null;const lcx=lc.getContext('2d');R=mulberry(seed+77);nz=noise1();skiW=rnd(560,660);skiX=rnd(300,L-1000);
   if(skiX+skiW>lx-60&&skiX<lx+lw+60)skiX=(lx+lw+200)%(L-skiW-300)+150;LCTX=lcx;ctx.save();skiHill(skiX,skiW,rnd(270,310),G-2,lcx);ctx.restore();LCTX=null}
  R=outerR;nz=noise1();
  // 4 things along the ground line: pine clusters, cabins, a lodge, the fire lookout, a chapel, rocks
  const items=[];x=rnd(0,30);const lookX=((lx+lw+L*.45)%L);let didLook=false;
  while(x<L){if(x>lx-40&&x<lx+lw+30){x=lx+lw+30;continue}if(x>skiX-70&&x<skiX+skiW*.16){x=skiX+skiW*.16;continue}
    let k=pick(['pines','pines','pines','pines','pines','cabin','cabin','rocks','pines','lodge','chapel']);
    if(!didLook&&Math.abs(x-lookX)<120){k='lookout';didLook=true}
    if(k==='lodge'&&chance(.6))k='cabin';if(k==='chapel'&&chance(.6))k='pines';
    const w=k==='pines'?rnd(60,110):k==='cabin'?90:k==='lodge'?160:k==='lookout'?70:k==='chapel'?60:70;items.push({x:x+w/2,k,s:Math.floor(R()*1e9)});x+=w+rnd(4,40)}
  const chapelP={walls:['#f3efe6','#efe4d2'],roofs:['#8a3d3d','#6e6a66']};
  const drawIt=(it,xx,primary)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,G+1);LCTX=lc.getContext('2d');
    if(it.k==='pines')pineCluster();else if(it.k==='cabin'){if(chance(.45))aframe(primary);else cabin(primary,false)}else if(it.k==='lodge')cabin(primary,true);else if(it.k==='lookout')lookout();else if(it.k==='chapel'){church(chapelP,rnd(30,40),rnd(80,110))}else rocks();
    LCTX=null;ctx.restore()};
  for(const it of items){drawIt(it,it.x,true);if(it.x<B+120)drawIt(it,it.x+L,false);if(it.x>L-120)drawIt(it,it.x-L,false)}
  R=outerR;nz=noise1();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  // 5 railway on the shoulder, gravel road in front
  const kb=[7,rnd(0,6),2,19,rnd(0,6),1.5],kr=[11,rnd(0,6),1.5,31,rnd(0,6),.8];
  const band=(y0,y1,k)=>{const t=[],b=[];for(let x=-20;x<=L+B+20;x+=12){t.push([x,y0+per(x,L,k)*.4]);b.push([x,y1+per(x,L,k)])}return[...t,...b.reverse()]};
  wash(band(G,G+ROADT,kb),'#d9c49a',.7,1.2);wash(band(G+ROADT,G+40,kr),'#b6a593',.55,1.2);wash(band(G+40,G+ROADB,kb),'#c9bba6',.6,1.4);
  ctx.strokeStyle=INK;ctx.lineCap='round';for(let x=0;x<L+B;x+=14){ctx.lineWidth=LW*.8;ctx.beginPath();ctx.moveTo(x,G+19);ctx.lineTo(x+2,G+36);ctx.stroke()}
  const line=(y,k,lw)=>{ctx.beginPath();for(let x=-20;x<=L+B+20;x+=8){const yy=y+per(x,L,k)*WOB;x>-20?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.strokeStyle=INK;ctx.lineWidth=lw;ctx.stroke()};
  line(G,kb,LW*1.2);line(G+22,[3,0,.2,5,0,.1],LW*.9);line(G+32,[3,1,.2,5,1,.1],LW*.9);line(G+40,kr,LW*.7);line(G+ROADB,kb,LW*1.1);
  for(let x=0;x<L+B;x+=60){ctx.beginPath();ctx.moveTo(x+6,G+57);ctx.lineTo(x+22,G+57);ctx.strokeStyle='rgba(29,27,32,.55)';ctx.lineWidth=LW*.7;ctx.stroke()}
  const strip=blendSeam(c,L,B),lights=blendSeam(lc,L,B);
  return{strip,lights,cars:makeTrucks(seed)}}

function makeTrucks(seed){const out=[];for(let i=0;i<6;i++){const s=newCanvas(130,80);ctx=s.getContext('2d');R=mulberry(seed+i*53);nz=noise1();ctx.translate(65,70);
  const col=pick(['#c8553d','#7f9468','#e9b949','#7fb0e6','#b5835a','#f3efe6']),kind=pick(['pickup','van','jeep']);let body;
  if(kind==='pickup')body=[[-30,-6],[30,-6],[30,-18],[6,-18],[2,-30],[-12,-30],[-14,-18],[-30,-18]];
  else if(kind==='van')body=[[-28,-6],[28,-6],[28,-34],[-18,-34],[-28,-20]];
  else body=[[-24,-6],[24,-6],[24,-20],[12,-20],[10,-30],[-18,-30],[-24,-20]];
  wash(body,col,.92,.4);inkLine([...body,body[0]],LW*.8);
  if(kind==='van'){inkRect(-14,-30,12,9,LW*.5);inkRect(2,-30,12,9,LW*.5);if(chance(.6)){base(rectPoly(-20,-44,40,8));wash(rectPoly(-20,-44,40,8),pick(['#c8553d','#e9b949','#7fb0e6']),.9,.2);inkRect(-20,-44,40,8,LW*.6)}}
  else inkRect(-8,-27,12,8,LW*.5);
  for(const wx of[-18,18]){ctx.beginPath();ctx.arc(wx,-5,6,0,7);ctx.fillStyle='#3b3a40';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.7;ctx.stroke()}
  const v=(i%2?1:-1)*rnd(28,60);out.push({img:s,x:R()*L,v,lane:v>0?50:66,w:130,h:80,ox:65,oy:70,face:kind==='jeep'?1:-1})}return out}

// ---------- mountain foreground
function boulder(){rocks()}
function flowers(){for(let i=0;i<9;i++){const x=rnd(-22,22),h=rnd(8,24);seg(x,0,x+rnd(-3,3),-h,LW*.5);ctx.beginPath();ctx.arc(x,-h,3,0,7);ctx.fillStyle=pick(['#c8553d','#e9b949','#f0b7a4','#8e8fd6','#fbf8f1']);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.7;ctx.stroke()}}
function stump(){const p=rectPoly(-10,-16,20,16);base(p);wash(p,'#a8714a',.9,.3);inkRect(-10,-16,20,16,LW*.8);ctx.beginPath();ctx.ellipse(0,-16,10,3.5,0,0,7);ctx.fillStyle='#e6c79c';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.7;ctx.stroke()}
function railFence(){const w=rnd(80,140);for(let x=-w/2;x<=w/2;x+=w/3){seg(x,0,x,-30,LW*.9)}inkLine([[-w/2,-24],[w/2,-20]],LW*.8);inkLine([[-w/2,-12],[w/2,-10]],LW*.8)}
function trailSign(){seg(-10,0,-10,-44,LW);seg(10,0,10,-44,LW);const b=rectPoly(-22,-56,44,18);base(b);wash(b,'#b5835a',.9,.3);inkRect(-22,-56,44,18,LW*.8);ctx.fillStyle=INK;ctx.font='700 11px '+HANDF;ctx.textAlign='center';ctx.fillText('TRAIL',0,-43)}
function campfire(){for(let i=0;i<5;i++){const x=-14+i*7;ctx.beginPath();ctx.arc(x,-2,3,0,7);ctx.fillStyle=MP.stone;ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.8;ctx.stroke()}
  seg(-12,-2,10,-8,LW*.9);seg(12,-2,-10,-8,LW*.9);{const m=ctx.getTransform();const fx=((Math.round(m.e)%Lf)+Lf)%Lf;if(!CAMPS.some(c=>Math.abs(c.x-fx)<4))CAMPS.push({x:fx,ph:Math.random()*6})}
}
function campsite(){ctx.save();ctx.translate(-46,0);tent();ctx.restore();campfire();for(const s of[-1,1]){const lg=rectPoly(s*26-12,-8,24,8);base(lg);wash(lg,'#a8714a',.9,.2);inkRect(s*26-12,-8,24,8,LW*.7)}}
function tent(){const w=rnd(44,60),h=rnd(30,40),t=[[-w/2,0],[w/2,0],[0,-h]];base(t);wash(t,pick(['#e9b949','#c8553d','#7fb0e6']),.92,.3);inkLine([...t,t[0]]);inkLine([[0,-h],[-6,0]],LW*.7);inkLine([[0,-h],[6,0]],LW*.7);seg(0,-h,0,-h-8,LW*.6)}
function deer(){ctx.save();if(chance(.5))ctx.scale(-1,1);const bd=[];for(let i=0;i<=16;i++){const a=i/16*6.283;bd.push([Math.cos(a)*17,-36+Math.sin(a)*8])}base(bd);wash(bd,'#c49a6c',.92,.3);inkLine([...bd,bd[0]],LW*.8);
  for(const lx of[-12,-7,8,13])seg(lx,-30,lx+rnd(-1,1),0,LW*.7);inkLine([[-14,-40],[-20,-56]],LW*.9);const hd=[[-26,-58],[-16,-60],[-18,-54],[-26,-54]];base(hd);wash(hd,'#c49a6c',.95,.2);inkLine([...hd,hd[0]],LW*.7);
  if(chance(.5)){inkLine([[-19,-60],[-17,-70],[-13,-74]],LW*.6);inkLine([[-17,-70],[-21,-75]],LW*.6)}ctx.beginPath();ctx.arc(18,-38,2.5,0,7);ctx.fillStyle='#fbf8f1';ctx.fill();ctx.restore()}
function bigPine(){pine(rnd(70,120),pick(MP.pine))}
function hiker(){person();const bp=rectPoly(-12,-46,7,16);base(bp);wash(bp,pick(['#c8553d','#7f9468','#e9b949']),.95,.2);inkRect(-12,-46,7,16,LW*.6)}
const MFKINDS=[['bigPine',3.2],['boulder',1.6],['flowers',1.6],['bush',1.4],['stump',.8],['railFence',1],['trailSign',.35],['tent',.3],['deer',.45],['bench',.3],['mailbox',.25]];
const MFFN={campsite,bigPine,boulder,flowers,bush,stump,railFence,trailSign,campfire,tent,deer,bench,mailbox,hiker};
let CAMPS=[];
function buildMountainFront(seed){CAMPS=[];
  const outerR=mulberry(seed+17);R=outerR;nz=noise1();
  const c=newCanvas(Lf+B,THf),lc=newCanvas(Lf+B,THf);ctx=c.getContext('2d');W=c.width;H=c.height;
  const tot=MFKINDS.reduce((a,k)=>a+k[1],0),pickK=()=>{let r=R()*tot;for(const[k,w]of MFKINDS){if((r-=w)<0)return k}return'bush'};
  const items=[];let x=rnd(0,40);const campX=rnd(.2,.7)*Lf;let didCamp=false;while(x<Lf){let k=pickK();if(!didCamp&&x>campX){k='campsite';didCamp=true}items.push({x:x+(k==='campsite'?50:0),k,s:Math.floor(R()*1e9)});x+=rnd(45,130)+(k==='campsite'?110:0)}
  const drawIt=(it,xx)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,Gf+rnd(-2,4));ctx.scale(FS,FS);LCTX=lc.getContext('2d');MFFN[it.k]();LCTX=null;ctx.restore()};
  for(const it of items){drawIt(it,it.x);if(it.x<B+150)drawIt(it,it.x+Lf);if(it.x>Lf-150)drawIt(it,it.x-Lf)}
  R=outerR;nz=noise1();ctx.setTransform(1,0,0,1,0,0);
  const k1=[9,rnd(0,6),3,23,rnd(0,6),1.5],k2=[13,rnd(0,6),5,37,rnd(0,6),2];
  const t=[],b=[];for(let x=-20;x<=Lf+B+20;x+=12){t.push([x,Gf+per(x,Lf,k1)*.5]);b.push([x,Gf+84+per(x,Lf,k2)])}
  ctx.save();ctx.globalCompositeOperation='destination-over';wash([...t,...b.reverse()],'#a9b07a',.72,1.4);ctx.restore();
  ctx.beginPath();for(let x=-20;x<=Lf+B+20;x+=8){const y=Gf+per(x,Lf,k1)*.5;x>-20?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=INK;ctx.lineWidth=LW*1.2;ctx.stroke();
  for(let x=10;x<Lf+B;x+=rnd(14,40)){const y=Gf+rnd(12,76);seg(x,y,x-2,y-6,LW*.6);seg(x+3,y,x+4,y-7,LW*.6)}
  const strip=blendSeam(c,Lf,B),lights=blendSeam(lc,Lf,B);
  const walkers=[];{const s=newCanvas(130,150);ctx=s.getContext('2d');R=mulberry(seed+300);nz=noise1();ctx.translate(65,144);ctx.scale(FS,FS);hiker();walkers.push({img:s,x:rnd(0,Lf),v:rnd(10,18),ph:0})}
  return{strip,lights,walkers}}

// ---------- far ranges: small and soft, pushed toward the sky
function buildMountainBack(seed){
  R=mulberry(seed+23);nz=noise1();const Bb=200;const c=newCanvas((Lb+Bb)*BS,THb*BS);ctx=c.getContext('2d');ctx.scale(BS,BS);
  const haze='#c9c3de',pk=[];let x=-100;while(x<Lb){const w=rnd(260,520);pk.push({x,w,h:rnd(380,700),col:mix(pick(MP.rock),haze,rnd(.45,.65)),sx:rnd(.4,.6)});x+=w*rnd(.4,.7)}
  const one=(p,x0)=>{const sx=x0+p.w*p.sx;ctx.beginPath();ctx.moveTo(x0,Gb);ctx.lineTo(sx,Gb-p.h);ctx.lineTo(x0+p.w,Gb);ctx.closePath();ctx.fillStyle=p.col;ctx.fill();ctx.strokeStyle='rgba(60,50,80,.3)';ctx.lineWidth=4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(sx-p.w*p.sx*.3,Gb-p.h*.7);ctx.lineTo(sx,Gb-p.h);ctx.lineTo(sx+p.w*(1-p.sx)*.3,Gb-p.h*.7);ctx.lineTo(sx+10,Gb-p.h*.74);ctx.lineTo(sx-14,Gb-p.h*.69);ctx.closePath();ctx.fillStyle='rgba(251,249,244,.9)';ctx.fill()};
  for(const p of pk){one(p,p.x);if(p.x<Bb+100)one(p,p.x+Lb);if(p.x+p.w>Lb-100)one(p,p.x-Lb)}
  ctx.fillStyle=mix('#9fb38a',haze,.5);ctx.fillRect(-50,Gb-4,Lb+Bb+100,THb-Gb+4);
  return blendSeam(c,Math.round(Lb*BS),Math.round(Bb*BS))}

// ---------- mountain moments
Object.assign(EVDEF,{
  train:{name:'Train',layer:'cars',dur:30,scenes:['mountain'],w:()=>2.4,
    init(e){e.dir=Math.random()<.5?1:-1;e.x0=off-e.dir*(CW*.55+40);e.v=e.dir*rr(70,95);e.cols=['#e9b949','#7fb0e6','#9fb38a','#b5835a','#c8553d'].sort(()=>Math.random()-.5)},
    draw(c,e,p){const el=p*30,head=e.x0+e.v*el,cx=CW/2,cy=GYc+Rg,r=Rg-32;
      for(let i=0;i<6;i++){const xs=head-e.dir*i*66;let dx=xs-off;dx=((dx%L)+L*1.5)%L-L/2;if(Math.abs(dx)>CW*.8)continue;const a=dx/Rg;
        c.save();c.translate(cx+Math.sin(a)*r,cy-Math.cos(a)*r);c.rotate(a);c.scale(e.dir*1.3,1.3);
        if(i===0){c.beginPath();c.rect(-26,-24,40,18);c.fillStyle='#c8553d';c.fill();inkStroke(c,1.5);c.beginPath();c.rect(-28,-34,16,28);c.fillStyle='#3b3f6e';c.fill();inkStroke(c,1.5);
          c.beginPath();c.rect(4,-34,7,10);c.fillStyle='#3b3a40';c.fill();inkStroke(c,1.2);c.beginPath();c.moveTo(14,-6);c.lineTo(24,-6);c.lineTo(14,-16);c.closePath();c.fillStyle='#e9b949';c.fill();inkStroke(c,1.2);
          for(let k=0;k<5;k++){const q=((el*1.4+k/5)%1);c.globalAlpha=(1-q)*.8;c.beginPath();c.arc(7-e.dir*q*50*e.dir-q*40,-38-q*40,4+q*10,0,7);c.fillStyle='#f3efe6';c.fill();inkStroke(c,1);c.globalAlpha=1}}
        else{c.beginPath();c.rect(-28,-28,56,22);c.fillStyle=e.cols[i%5];c.fill();inkStroke(c,1.5);c.beginPath();c.moveTo(-6,-26);c.lineTo(-6,-8);c.moveTo(6,-26);c.lineTo(6,-8);inkStroke(c,.9)}
        for(const wx of i===0?[-20,-4,10]:[-18,18]){c.beginPath();c.arc(wx,-5,5,0,7);c.fillStyle='#3b3a40';c.fill();inkStroke(c,1.1)}
        if(i>0){c.beginPath();c.moveTo(-34,-10);c.lineTo(-28,-10);inkStroke(c,1.2)}c.restore()}}},
  eagle:{name:'Eagle',layer:'sky',dur:20,scenes:['mountain'],w:m=>isDay(m)&&!severe(m.kind)?1.6:0,
    init(e){e.cx=rr(200,600);e.cy=GYc-rr(620,720);e.s=Math.random()<.5?1:-1},
    draw(c,e,p,t){const a=p*Math.PI*2.4*e.s,x=e.cx+Math.cos(a)*170+(p-.5)*300*e.s,y=e.cy+Math.sin(a)*40,fl=Math.sin(t*1.6)*4;c.save();c.translate(x,y);c.rotate(Math.cos(a)*.15);
      c.beginPath();c.moveTo(-38,fl-6);c.quadraticCurveTo(-18,-10,-6,0);c.lineTo(6,0);c.quadraticCurveTo(18,-10,38,fl-6);c.quadraticCurveTo(18,-2,8,4);c.lineTo(-8,4);c.quadraticCurveTo(-18,-2,-38,fl-6);c.closePath();c.fillStyle='#6e5a4a';c.fill();inkStroke(c,1.4);
      c.beginPath();c.arc(0,-2,3.4,0,7);c.fillStyle='#fbf8f1';c.fill();inkStroke(c,1);c.restore()}},
  aurora:{name:'Northern lights',layer:'top',dur:18,scenes:['mountain'],w:m=>isDark(m)&&clear(m)?1.2:0,
    init(e){e.ph=[rr(0,6),rr(0,6),rr(0,6)]},
    draw(c,e,p,t){const env=Math.sin(Math.PI*p);c.save();c.globalCompositeOperation='lighter';
      for(let k=0;k<3;k++){const yb=GYc-760+k*70;for(let x=-10;x<CW+10;x+=5){const h=60+50*Math.sin(x*.012+t*.6+e.ph[k])+30*Math.sin(x*.031-t*.4);const y=yb+22*Math.sin(x*.008+t*.3+e.ph[k]);
        const g=c.createLinearGradient(0,y,0,y-h);const col=k===1?'170,120,230':'110,230,170';g.addColorStop(0,`rgba(${col},${.22*env})`);g.addColorStop(1,`rgba(${col},0)`);c.fillStyle=g;c.fillRect(x,y-h,5,h)}}
      c.restore()}},
});
EVDEF.fireworks.scenes=['city'];
function drawCampfires(f,t,dark,offF){if(!CAMPS.length)return;const cx=CW/2,cy=GYc+Rg,r0=Rg-FRONT;
  for(const c of CAMPS){let dx=c.x-offF;dx=((dx%Lf)+Lf*1.5)%Lf-Lf/2;if(Math.abs(dx)>CW*.8)continue;const a=dx/r0,r=r0+3,x=cx+Math.sin(a)*r,y=cy-Math.cos(a)*r;
    f.save();f.translate(x,y);f.rotate(a);f.scale(FS*1.35,FS*1.35);const tt=t/1000+c.ph;
    if(dark){const g=f.createRadialGradient(0,-10,2,0,-10,46);g.addColorStop(0,'rgba(255,170,80,.6)');g.addColorStop(1,'rgba(255,140,60,0)');f.fillStyle=g;f.fillRect(-50,-60,100,100)}
    const tongue=(w,h,ox,col)=>{f.beginPath();f.moveTo(ox-w,-6);f.quadraticCurveTo(ox-w*1.1,-6-h*.5,ox+Math.sin(tt*7+ox)*2,-6-h);f.quadraticCurveTo(ox+w*1.1,-6-h*.5,ox+w,-6);f.closePath();f.fillStyle=col;f.fill();f.strokeStyle='#1d1b20';f.lineWidth=1;f.stroke()};
    tongue(7,15+4*Math.sin(tt*9),0,'#f08a4b');tongue(4,10+3*Math.sin(tt*11+1),-4,'#f6a96a');tongue(4,11+3*Math.sin(tt*10+2),4,'#f6a96a');tongue(2.6,7+2*Math.sin(tt*13),0,'#f6d77a');
    for(let i=0;i<3;i++){const q=(tt*.9+i/3)%1;f.fillStyle=`rgba(255,${200-80*q|0},90,${1-q})`;f.fillRect(Math.sin(tt*5+i*2)*6,-14-q*26,1.6,1.6)}
    for(let i=0;i<4;i++){const q=(tt*.3+i/4)%1;f.globalAlpha=(1-q)*(dark?.35:.6);f.beginPath();f.arc(q*16+Math.sin(q*6+i)*3,-26-q*60,2.5+q*7,0,7);f.fillStyle='#e9e5de';f.fill();f.strokeStyle='#1d1b20';f.lineWidth=.8;f.stroke()}f.globalAlpha=1;
    f.restore()}}
function drawGondola(f,t,dark){if(!GONDOLA||SCENE!=='mountain')return;const cx=CW/2,cy=GYc+Rg,P=GONDOLA.pts;
  const segL=[];let tot=0;for(let i=1;i<P.length;i++){const d=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);segL.push(d);tot+=d}
  const at=u=>{let d=u*tot;for(let i=0;i<segL.length;i++){if(d<=segL[i]||i===segL.length-1){const k=Math.min(1,d/segL[i]);return[P[i][0]+(P[i+1][0]-P[i][0])*k,P[i][1]+(P[i+1][1]-P[i][1])*k]}d-=segL[i]}};
  for(let i=0;i<3;i++){const u0=((t/1000)*.03+i/3)%1,up=u0<.5,u=up?u0*2:2-u0*2;const[sx,hh]=at(u);const h=hh-(up?0:4);
    let dx=sx-off;dx=((dx%L)+L*1.5)%L-L/2;if(Math.abs(dx)>CW*.8)continue;const a=dx/Rg,r=Rg+h,x=cx+Math.sin(a)*r,y=cy-Math.cos(a)*r;
    f.save();f.translate(x,y);f.rotate(a);f.beginPath();f.moveTo(0,0);f.lineTo(0,6);f.strokeStyle='#1d1b20';f.lineWidth=1;f.stroke();
    f.beginPath();f.rect(-5,6,10,9);f.fillStyle='#c8553d';f.fill();f.stroke();f.fillStyle=dark?'#ffd27a':'rgba(220,235,245,.95)';f.fillRect(-3.5,8,7,3.5);f.restore()}}EVDEF.blimp.scenes=['city'];

// ================= FIVE MORE BIOMES (same toolkit, same planet, same speed + curve as the city) =================
let ANIMS=[],LAKES=[];
const season=()=>{const mo=new Date().getMonth();return mo>=8&&mo<=10?'fall':(mo===11||mo<=1)?'winter':mo<=4?'spring':'summer'};
function smokeAt(lx,ly){const m=ctx.getTransform();SMOKE.push({x:m.e+lx*m.a,top:G-(m.f+ly*m.d),ph:Math.random()})}
function animAt(k,lx,ly,o={}){const m=ctx.getTransform();ANIMS.push(Object.assign({k,x:((m.e+lx*m.a)%L+L)%L,top:G-(m.f+ly*m.d)},o))}
function glowAt(x,y,r,col='255,214,120',a=.85){if(!LCTX)return;LCTX.save();LCTX.setTransform(ctx.getTransform());const g=LCTX.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`);LCTX.fillStyle=g;LCTX.fillRect(x-r,y-r,r*2,r*2);LCTX.restore()}
function blobPts(cx,cy,rx,ry,n=18,amp=.16){const q=noise1(),o=[];for(let i=0;i<n;i++){const a=i/n*6.283,r=1+amp*q(i*.8);o.push([cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r])}return o}
function inkPoly(p,col,al=.9,lw=LW*.85,loose=.4){base(p);wash(p,col,al,loose);inkLine([...p,p[0]],lw)}
function inkText(t,x,y,px=11,col=INK){ctx.fillStyle=col;ctx.font=`700 ${px}px ${HANDF}`;ctx.textAlign='center';ctx.fillText(t,x,y)}
function mainSetup(seed,salt){const outerR=mulberry(seed+salt);R=outerR;nz=noise1();NOBLUR=true;SMOKE=[];ANIMS=[];LAKES=[];
  const c=newCanvas(L+B,TH),lc=newCanvas(L+B,TH);ctx=c.getContext('2d');LCTX=null;LPER=L;W=c.width;H=c.height;INK='#1d1b20';LW=P.LW;WOB=P.WOB;return{outerR,c,lc}}
function wrapDraw(items,fn,Lp,m=140){for(const it of items){fn(it,it.x,true);if(it.x<B+m)fn(it,it.x+Lp,false);if(it.x>Lp-m)fn(it,it.x-Lp,false)}}
// a periodic hill band: returns its height function, draws fill + ink top
function hillBand(k,y0,amp,col,al=.8){const hy=x=>y0-amp*(per(x,L,k)+1.2);const top=[];for(let x=-20;x<=L+B+20;x+=14)top.push([x,hy(x)]);const poly=[...top,[L+B+20,G+6],[-20,G+6]];base(poly);wash(poly,col,al,1.2);inkLine(top,LW);return hy}
// sprinkle tiny things over a hill face (the way the mountain does its pines)
function speckle(hy,step,fn,lc,skip){const tp=[];for(let x=0;x<L;x+=rnd(step[0],step[1])){if(skip&&skip(x))continue;const yt=hy(x),y=yt+rnd(4,Math.max(8,(G-yt)*.85));tp.push({x,y,f:(y-yt)/(G-yt+1),s:Math.floor(R()*1e9)})}tp.sort((a,b)=>a.y-b.y);
  if(lc)LCTX=lc;for(const p of tp){for(const xx of p.x<B+30?[p.x,p.x+L]:[p.x]){R=mulberry(p.s);nz=noise1();ctx.save();ctx.translate(xx,p.y);fn(p);ctx.restore()}}LCTX=null}
function sizedLayout(Lp,pickFn,skips=[]){const items=[];let x=rnd(0,30);while(x<Lp-20){const s=skips.find(r=>x>r[0]-30&&x<r[1]);if(s){x=s[1]+rnd(10,30);continue}const it=pickFn(x);if(x+it.w>Lp+10&&it.big){x+=40;continue}
  const sk=skips.find(r=>x+it.w>r[0]-20&&x<r[0]);if(sk){x=sk[1]+rnd(10,30);continue}items.push({x:x+it.w/2,k:it.k,w:it.w,s:Math.floor(R()*1e9)});x+=it.w+rnd(...(it.gap||[4,36]))}return items}
// the road along the front of every scene: same lanes and depth as the city and mountain
function groundBands(o){ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  const kb=[7,rnd(0,6),2,19,rnd(0,6),1.5],kr=[11,rnd(0,6),1.5,31,rnd(0,6),.8];
  const band=(y0,y1,k)=>{const t=[],b=[];for(let x=-20;x<=L+B+20;x+=12){t.push([x,y0+per(x,L,k)*.4]);b.push([x,y1+per(x,L,k)])}return[...t,...b.reverse()]};
  const line=(y,k,lw,col=INK)=>{ctx.beginPath();for(let x=-20;x<=L+B+20;x+=8){const yy=y+per(x,L,k)*WOB;x>-20?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.stroke()};
  const roadCol={gravel:'#c9bba6',asphalt:'#9d98a3',dirt:'#d3b48a'}[o.road];ctx.strokeStyle=INK;ctx.lineCap='round';
  if(o.shoulder==='rail'){wash(band(G,G+ROADT,kb),o.edge||'#d9c49a',.7,1.2);wash(band(G+ROADT,G+40,kr),'#b6a593',.55,1.2);wash(band(G+40,G+ROADB,kb),roadCol,.6,1.4);
    for(let x=0;x<L+B;x+=14){ctx.lineWidth=LW*.8;ctx.beginPath();ctx.moveTo(x,G+19);ctx.lineTo(x+2,G+36);ctx.stroke()}
    line(G,kb,LW*1.2);line(G+22,[3,0,.2,5,0,.1],LW*.9);line(G+32,[3,1,.2,5,1,.1],LW*.9);line(G+40,kr,LW*.7);line(G+ROADB,kb,LW*1.1)}
  else{const sc={walk:'#e2dbcf',board:'#d6b07e',verge:'#aab37a',sand:'#e8d2a0'}[o.shoulder];wash(band(G,G+22,kb),sc,.75,1.2);wash(band(G+22,G+ROADB,kb),roadCol,.6,1.4);
    if(o.shoulder==='walk')for(let x=0;x<L+B;x+=38)seg(x,G+3,x-2,G+20,LW*.5);
    if(o.shoulder==='board')for(let x=0;x<L+B;x+=9){ctx.lineWidth=LW*.45;ctx.beginPath();ctx.moveTo(x,G+3);ctx.lineTo(x+1,G+21);ctx.stroke()}
    if(o.shoulder==='verge'||o.shoulder==='sand')for(let x=6;x<L+B;x+=rnd(14,34)){const y=G+rnd(6,18);seg(x,y,x-2,y-5,LW*.5);seg(x+3,y,x+4,y-6,LW*.5)}
    line(G,kb,LW*1.2);line(G+22,kr,LW*.9);line(G+ROADB,kb,LW*1.1)}
  const mid=o.shoulder==='rail'?57:48;
  if(o.road==='asphalt')for(let x=0;x<L+B;x+=54){ctx.beginPath();ctx.moveTo(x+6,G+mid);ctx.lineTo(x+28,G+mid);ctx.strokeStyle='#e9b949';ctx.lineWidth=LW*1.3;ctx.stroke();ctx.strokeStyle='rgba(29,27,32,.45)';ctx.lineWidth=.8;ctx.stroke()}
  else if(o.road==='gravel')for(let x=0;x<L+B;x+=60){ctx.beginPath();ctx.moveTo(x+6,G+mid);ctx.lineTo(x+22,G+mid);ctx.strokeStyle='rgba(29,27,32,.55)';ctx.lineWidth=LW*.7;ctx.stroke()}
  else{line(G+mid-8,[5,2,.4,9,1,.3],LW*.45,'rgba(29,27,32,.4)');line(G+mid+8,[5,3,.4,9,2,.3],LW*.45,'rgba(29,27,32,.4)')}
  return o.shoulder==='rail'?[50,66]:[40,62]}

// ---------- vehicles for any scene (drawn the same way as the mountain trucks)
function makeVehicles(seed,kinds,lanes,n=6){const out=[];for(let i=0;i<n;i++){const s=newCanvas(180,90);ctx=s.getContext('2d');R=mulberry(seed+i*61+7);nz=noise1();ctx.translate(90,80);
  const kind=pick(kinds),col=pick(['#c8553d','#7f9468','#e9b949','#7fb0e6','#b5835a','#f3efe6','#e59a8f','#5f8fd8']);let body,wheels=[-18,18],wr=6;
  const win=(x,y,w,h)=>inkRect(x,y,w,h,LW*.5);
  if(kind==='pickup'||kind==='hay'){body=[[-30,-6],[30,-6],[30,-18],[6,-18],[2,-30],[-12,-30],[-14,-18],[-30,-18]];inkPoly(body,col,.92,LW*.8);win(-8,-27,8,8);
    if(kind==='hay')for(const bx of[14,24]){ctx.beginPath();ctx.arc(bx,-24,7,0,7);ctx.fillStyle='#e8c86a';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.6;ctx.stroke();ctx.beginPath();ctx.arc(bx,-24,3,0,5);ctx.stroke()}}
  else if(kind==='van'||kind==='surf'){body=[[-28,-6],[28,-6],[28,-34],[-18,-34],[-28,-20]];inkPoly(body,col,.92,LW*.8);win(-14,-30,12,9);win(2,-30,12,9);
    if(kind==='surf'){const sb=[[-26,-38],[30,-38],[34,-41],[30,-44],[-26,-44],[-30,-41]];inkPoly(sb,pick(['#e9b949','#7fb0e6','#f0b7a4']),.95,LW*.6);seg(-20,-34,-20,-38,LW*.6);seg(20,-34,20,-38,LW*.6)}}
  else if(kind==='jeep'||kind==='canoe'){body=[[-24,-6],[24,-6],[24,-20],[12,-20],[10,-30],[-18,-30],[-24,-20]];inkPoly(body,col,.92,LW*.8);win(-14,-27,10,7);
    if(kind==='canoe'){const cn=[[-34,-34],[34,-34],[28,-40],[-28,-40]];inkPoly(cn,pick(['#c8553d','#e9b949','#7f9468']),.95,LW*.6);seg(-10,-30,-10,-34,LW*.6);seg(6,-30,6,-34,LW*.6)}}
  else if(kind==='sedan'||kind==='wagon'){body=kind==='sedan'?[[-32,-6],[32,-6],[32,-16],[16,-18],[8,-29],[-14,-29],[-22,-18],[-32,-16]]:[[-34,-6],[32,-6],[32,-16],[18,-18],[10,-29],[-34,-29]];inkPoly(body,col,.92,LW*.8);
    win(-12,-26,9,7);win(0,-26,8,7);if(kind==='wagon')win(-30,-26,14,7)}
  else if(kind==='tractor'){body=[[-24,-10],[18,-10],[18,-22],[0,-22],[-2,-40],[-22,-40],[-24,-22]];inkPoly(body,pick(['#c8553d','#7f9468','#e9b949']),.95,LW*.8);win(-18,-36,12,10);seg(10,-22,10,-34,LW*.9);wheels=[];
    for(const[wx,r]of[[-14,12],[16,7]]){ctx.beginPath();ctx.arc(wx,-r+1,r,0,7);ctx.fillStyle='#3b3a40';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.7;ctx.stroke();ctx.beginPath();ctx.arc(wx,-r+1,r*.4,0,7);ctx.fillStyle='#e9b949';ctx.fill();ctx.stroke()}}
  else if(kind==='rv'){body=[[-44,-6],[40,-6],[40,-22],[30,-30],[30,-40],[-44,-40]];inkPoly(body,'#f3efe6',.95,LW*.8);wash(rectPoly(-44,-22,84,5),pick(['#c8553d','#e39a3b','#7fb0e6']),.9,.2);
    for(const wx of[-34,-18,-2])win(wx,-34,11,8);win(22,-30,8,8);wheels=[-30,26]}
  else if(kind==='bus'){body=[[-50,-6],[46,-6],[46,-22],[40,-36],[-50,-36]];inkPoly(body,'#e9b949',.95,LW*.8);for(let wx=-46;wx<30;wx+=13)win(wx,-32,9,9);seg(-50,-16,46,-16,LW*.6);wheels=[-34,32]}
  for(const wx of wheels){ctx.beginPath();ctx.arc(wx,-5,wr,0,7);ctx.fillStyle='#3b3a40';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.7;ctx.stroke()}
  const slow=kind==='tractor';const v=(i%2?1:-1)*(slow?rnd(14,20):rnd(28,60));out.push({img:s,x:R()*L,v,lane:v>0?lanes[0]:lanes[1],w:180,h:90,ox:90,oy:80,face:['pickup','hay','van','surf'].includes(kind)?-1:1})}return out}

// ---------- shared drawings
const LEAF={summer:['#8fae7a','#7d9c6c','#a3b77f','#6b8f73'],spring:['#a3c27f','#b5c98a','#8fb07a','#f0b7a4'],fall:['#e39a3b','#c9744a','#e9b949','#c8553d','#b5835a','#a3b77f'],winter:null};
function roundTree(h,cols){cols=cols===undefined?LEAF[season()]:cols;seg(0,0,rnd(-2,2),-h*.55,LW*1.1);
  if(!cols){ctx.save();ctx.translate(0,-h*.4);tree(h*.3,rnd(-.1,.1),5);ctx.restore();return}
  const r=h*rnd(.26,.34),cy=-h+r;inkPoly(blobPts(0,cy,r,r*rnd(.85,1),20,.14),pick(cols),.92,LW*.85,.5);
  for(let i=0;i<5;i++){const x=rnd(-r*.6,r*.6),y=cy+rnd(-r*.6,r*.5);seg(x,y,x+rnd(-3,3),y+5,LW*.5)}}
function birch(h){const w=rnd(5,7),lean=rnd(-6,6),tr=[[-w/2,0],[w/2,0],[w/2+lean,-h],[-w/2+lean,-h]];inkPoly(tr,'#f3efe6',.9,LW*.7,.2);
  for(let y=-8;y>-h+6;y-=rnd(8,16)){const xx=lean*(-y/h);seg(xx-w/2,y,xx-w/2+rnd(2,4),y,LW*.8)}
  const s=season(),cols=s==='fall'?['#e9b949','#e8c86a','#e39a3b']:s==='winter'?null:['#a3c27f','#b5c98a','#8fae7a'];
  if(!cols){for(let i=0;i<4;i++){const y=-h*rnd(.5,.95);seg(lean*(-y/h),y,lean*(-y/h)+rnd(-14,14),y-rnd(8,16),LW*.5)}return}
  for(let i=0;i<3;i++){const r=rnd(10,17);inkPoly(blobPts(lean+rnd(-9,9),-h+rnd(-4,22),r,r*.9,14,.18),pick(cols),.9,LW*.7,.4)}}
const HOUSEC={walls:['#f0b7a4','#e8c86a','#9fb38a','#7fb0e6','#f3efe6','#e59a8f','#c9b4d9','#e6c08a'],roofs:['#8a3d3d','#6e6a66','#5f6b5a','#b0473f','#7a6a8a','#3b3f6e'],doors:['#c8553d','#3b3f6e','#e9b949','#7f9468','#f3efe6']};
function house(primary,o={}){const two=o.two!==undefined?o.two:chance(.45),w=o.w||rnd(two?66:84,two?94:120),h=two?rnd(62,76):rnd(36,46),x=-w/2,y=-h,col=o.wall||pick(HOUSEC.walls),roof=o.roof||pick(HOUSEC.roofs),al=o.fade?.5:.78;
  if(o.garage!==undefined?o.garage:chance(.4)){const gw=rnd(42,52),gh=rnd(30,35),gx=chance(.5)?x-gw+2:-x-2;inkPoly(rectPoly(gx,-gh,gw,gh),col,al,LW*.9);const rp=[[gx-3,-gh],[gx+gw+3,-gh],[gx+gw-5,-gh-10],[gx+5,-gh-10]];inkPoly(rp,roof,.85,LW*.9);
    inkRect(gx+6,-gh+9,gw-12,gh-9,LW*.7);for(let k=1;k<4;k++)seg(gx+7,-gh+9+k*(gh-9)/4,gx+gw-7,-gh+9+k*(gh-9)/4,LW*.4)}
  const style=o.roofStyle||pick(['gable','gable','hip','gable','salt']),rh=rnd(22,34);
  const roofY=cx=>style==='gable'?y-rh*(1-Math.abs(cx)/(w/2+6)):style==='hip'?y-rh*.8:y-rh*.5;
  const chx=rnd(-w*.3,w*.3),cht=roofY(chx)-rnd(10,16);if(o.chimney!==false&&chance(.7)){inkPoly(rectPoly(chx-5,cht,10,y-cht+4),'#b4532f',.9,LW*.8,.3);if(primary&&chance(o.smoke||.5))smokeAt(chx,cht)}
  inkPoly(rectPoly(x,y,w,h),col,al,LW);
  let rp;if(style==='gable')rp=[[x-6,y],[-x+6,y],[0,y-rh]];else if(style==='hip')rp=[[x-6,y],[-x+6,y],[-x-w*.18,y-rh*.8],[x+w*.18,y-rh*.8]];else rp=[[x-6,y],[-x+6,y],[w*.18,y-rh],[x-2,y-rh*.32]];inkPoly(rp,roof,.85,LW);
  const rows=two?2:1,cols=Math.max(2,Math.floor(w/26)),dc=Math.floor(R()*cols);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const xx=x+(c+.5)*w/cols;if(r===rows-1&&c===dc){const dp=rectPoly(xx-6,-20,12,20);inkPoly(dp,pick(HOUSEC.doors),.95,LW*.8,.2);continue}
    const yy=y+10+r*30,ww=12,hh=14;ctx.fillStyle='rgba(40,40,50,.45)';ctx.fillRect(xx-ww/2+1.5,yy+1.5,ww-3,hh-3);inkRect(xx-ww/2,yy,ww,hh,LW*.7);seg(xx,yy+1,xx,yy+hh-1,LW*.4);lit(xx-ww/2+1,yy+1,ww-2,hh-2)}
  if(chance(.35)){seg(x+4,-24,-x-4,-24,LW*.8);seg(x+6,-24,x+6,0,LW*.6);seg(-x-6,-24,-x-6,0,LW*.6)}}
function inkCircle(x,y,r,col,lw=LW*.7){ctx.beginPath();ctx.arc(x,y,r,0,7);if(col){ctx.fillStyle=col;ctx.fill()}ctx.strokeStyle=INK;ctx.lineWidth=lw;ctx.stroke()}
function waterBody(x0,w,depth,col,lc){const tp=[],bt=[];for(let i=0;i<=40;i++){const t=i/40,xx=x0+t*w,d=Math.min(1,Math.min(t,1-t)*7);tp.push([xx,G-depth*d]);bt.push([xx,G+2])}
  const poly=[...tp,...bt.reverse()];base(poly);wash(poly,col,.85,.6);inkLine(tp,LW*.9);
  for(let i=0;i<w/30;i++){const xx=x0+rnd(.08,.92)*w,yy=G-rnd(4,depth-8);seg(xx,yy,xx+rnd(10,26),yy,LW*.45)}}
function genericBack(seed,salt,draw,ground){R=mulberry(seed+salt);nz=noise1();const Bb=200;const c=newCanvas((Lb+Bb)*BS,THb*BS);ctx=c.getContext('2d');ctx.scale(BS,BS);
  const wrap=(x,w,fn)=>{fn(x);if(x<Bb+100)fn(x+Lb);if(x+w>Lb-100)fn(x-Lb)};draw(wrap,Bb);ctx.fillStyle=ground;ctx.fillRect(-50,Gb-4,Lb+Bb+100,THb-Gb+4);return blendSeam(c,Math.round(Lb*BS),Math.round(Bb*BS))}
function backPoly(p,col,sl=.3){ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle=`rgba(60,50,80,${sl})`;ctx.lineWidth=4;ctx.stroke()}
// one front builder for every new scene: items at the city's scale, a ground wash, one walker
function genericFront(seed,salt,KINDS,FN,ground,forced=[],walker=person,tufts=1){CAMPS=[];
  const outerR=mulberry(seed+salt);R=outerR;nz=noise1();
  const c=newCanvas(Lf+B,THf),lc=newCanvas(Lf+B,THf);ctx=c.getContext('2d');W=c.width;H=c.height;
  const tot=KINDS.reduce((a,k)=>a+k[1],0),pickK=()=>{let r=R()*tot;for(const[k,w]of KINDS){if((r-=w)<0)return k}return KINDS[0][0]};
  const fx=forced.map(f=>({k:f[0],x:f[1]*Lf,w:f[2]||0,done:false}));const items=[];let x=rnd(0,40);
  while(x<Lf){let k=pickK(),w=0;const f=fx.find(q=>!q.done&&x>q.x);if(f){k=f.k;w=f.w;f.done=true}items.push({x:x+w/2,k,s:Math.floor(R()*1e9)});x+=rnd(45,130)+w}
  const drawIt=(it,xx)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,Gf+rnd(-2,4));ctx.scale(FS,FS);LCTX=lc.getContext('2d');FN[it.k]();LCTX=null;ctx.restore()};
  for(const it of items){drawIt(it,it.x);if(it.x<B+150)drawIt(it,it.x+Lf);if(it.x>Lf-150)drawIt(it,it.x-Lf)}
  R=outerR;nz=noise1();ctx.setTransform(1,0,0,1,0,0);
  const k1=[9,rnd(0,6),3,23,rnd(0,6),1.5],k2=[13,rnd(0,6),5,37,rnd(0,6),2];
  const t=[],b=[];for(let x=-20;x<=Lf+B+20;x+=12){t.push([x,Gf+per(x,Lf,k1)*.5]);b.push([x,Gf+84+per(x,Lf,k2)])}
  ctx.save();ctx.globalCompositeOperation='destination-over';wash([...t,...b.reverse()],ground,.72,1.4);ctx.restore();
  ctx.beginPath();for(let x=-20;x<=Lf+B+20;x+=8){const y=Gf+per(x,Lf,k1)*.5;x>-20?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=INK;ctx.lineWidth=LW*1.2;ctx.stroke();
  for(let x=10;x<Lf+B;x+=rnd(14,40)/tufts){const y=Gf+rnd(12,76);if(tufts<1){ctx.beginPath();ctx.arc(x,y,1.2,0,7);ctx.fillStyle='rgba(29,27,32,.45)';ctx.fill();continue}seg(x,y,x-2,y-6,LW*.6);seg(x+3,y,x+4,y-7,LW*.6)}
  const strip=blendSeam(c,Lf,B),lights=blendSeam(lc,Lf,B);
  const walkers=[];{const s=newCanvas(130,150);ctx=s.getContext('2d');R=mulberry(seed+salt+300);nz=noise1();ctx.translate(65,144);ctx.scale(FS,FS);walker();walkers.push({img:s,x:rnd(0,Lf),v:rnd(10,18)*(chance(.5)?1:-1),ph:0})}
  return{strip,lights,walkers}}
function bonfire(){campfire();for(const s of[-1,1]){const lg=rectPoly(s*30-13,-8,26,8);inkPoly(lg,'#a8714a',.9,LW*.7,.2)}}

// ================= COAST =================
function lighthouse(primary){const h=rnd(215,240),bw=24,tw=14;const body=[[-bw,0],[bw,0],[tw,-h],[-tw,-h]];base(body);
  ctx.save();polyPath(body);ctx.clip();for(let i=0;i<5;i++){if(i%2)continue;const y0=-i*h/5,y1=-(i+1)*h/5;ctx.fillStyle=hexA('#c8553d',.85);ctx.fillRect(-bw-4,y1,bw*2+8,y0-y1)}ctx.restore();
  wash(body,'#f3efe6',.35,.3);inkLine([...body,body[0]],LW*1.1);
  for(let i=1;i<4;i++){const y=-i*h/4.2;ctx.fillStyle='rgba(40,40,50,.5)';ctx.fillRect(-3,y,6,10);inkRect(-3,y,6,10,LW*.6);lit(-2.5,y+.5,5,9)}
  inkPoly(rectPoly(-6,-16,12,16),'#3b3f6e',.9,LW*.7,.2);
  const gy=-h;inkPoly(rectPoly(-tw-9,gy-5,2*(tw+9),5),'#3b3a40',.9,LW*.8,.2);seg(-tw-9,gy-14,tw+9,gy-14,LW*.6);for(let x=-tw-8;x<=tw+8;x+=6)seg(x,gy-5,x,gy-14,LW*.4);
  const lr=rectPoly(-10,gy-32,20,24);base(lr);ctx.fillStyle='rgba(255,232,160,.95)';ctx.fillRect(-10,gy-32,20,24);inkRect(-10,gy-32,20,24,LW*.8);seg(0,gy-32,0,gy-8,LW*.5);
  ctx.beginPath();ctx.moveTo(-13,gy-32);ctx.quadraticCurveTo(0,gy-52,13,gy-32);ctx.closePath();ctx.fillStyle='#3b3a40';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke();seg(0,gy-46,0,gy-58,LW*.7);
  if(LCTX){LCTX.save();LCTX.setTransform(ctx.getTransform());LCTX.fillStyle='#fff3c4';LCTX.fillRect(-9,gy-31,18,22);LCTX.restore();glowAt(0,gy-20,60,'255,226,140',.8)}
  if(primary)animAt('beam',0,gy-20);
  ctx.save();ctx.translate(bw+38,0);house(false,{two:false,w:60,garage:false,wall:'#f3efe6',roof:'#8a3d3d',roofStyle:'gable'});ctx.restore()}
function stiltCottage(primary){const w=rnd(62,90),h=rnd(36,48),st=rnd(16,24),col=pick(['#7fb0e6','#f0b7a4','#e9b949','#9fb38a','#f3efe6','#c9b4d9','#5f8fd8']),roof=pick(['#6e6a66','#3b3f6e','#8a3d3d','#7a6a8a']);
  for(const sx of[-w/2+6,-w/6,w/6,w/2-6])seg(sx,0,sx,-st,LW*.9);seg(-w/2+6,-st*.5,w/2-6,-st*.15,LW*.5);
  const y=-st-h;if(chance(.4)){const cx=rnd(-w*.25,w*.25);inkPoly(rectPoly(cx-5,y-34,10,30),'#b4532f',.9,LW*.8,.3);if(primary&&chance(.5))smokeAt(cx,y-34)}
  inkPoly(rectPoly(-w/2,y,w,h),col,.8,LW);ctx.save();ctx.globalAlpha=.45;for(let yy=y+7;yy<-st-3;yy+=7)seg(-w/2+3,yy,w/2-3,yy,LW*.3);ctx.restore();
  const rh=rnd(22,30),rp=[[-w/2-6,y],[w/2+6,y],[0,y-rh]];inkPoly(rp,roof,.85,LW);inkCircle(0,y-rh*.42,4.5,'rgba(255,255,255,.6)',LW*.6);
  const n=Math.max(2,Math.floor(w/26));for(let c=0;c<n;c++){const xx=-w/2+(c+.5)*w/n;if(c===n-1){inkPoly(rectPoly(xx-5,-st-20,10,20),pick(HOUSEC.doors),.95,LW*.7,.2);continue}ctx.fillStyle='rgba(40,40,50,.45)';ctx.fillRect(xx-5,y+10,10,12);inkRect(xx-6,y+9,12,14,LW*.7);lit(xx-5,y+10,10,12)}
  seg(-w/2-10,-st,w/2+4,-st,LW*.9);inkLine([[w/2+4,-st],[w/2+22,0]],LW*.8);for(let k=1;k<4;k++){const t=k/4;seg(w/2+4+18*t-4,-st+st*t,w/2+4+18*t+3,-st+st*t,LW*.5)}}
function beachHuts(){const n=Math.round(rnd(3,5));for(let i=0;i<n;i++){const x=-n*13+i*26,h=rnd(28,34);const col=pick(['#c8553d','#7fb0e6','#e9b949','#9fb38a','#f0b7a4','#f3efe6']);
  inkPoly([[x-11,0],[x+11,0],[x+11,-h],[x,-h-12],[x-11,-h]],col,.92,LW*.8);inkRect(x-5,-18,10,18,LW*.6);ctx.save();ctx.globalAlpha=.4;for(let xx=x-9;xx<x+10;xx+=4)seg(xx,-h+2,xx,-2,LW*.3);ctx.restore()}}
function lifeguard(){const lh=rnd(34,42);seg(-14,0,-10,-lh,LW*.9);seg(14,0,10,-lh,LW*.9);seg(-12,-lh*.4,12,-lh*.7,LW*.5);inkLine([[18,0],[8,-lh]],LW*.7);
  inkPoly(rectPoly(-16,-lh-26,32,26),'#f3efe6',.9,LW*.9);inkPoly([[-20,-lh-26],[20,-lh-26],[14,-lh-36],[-14,-lh-36]],'#c8553d',.92,LW*.8);inkRect(-9,-lh-21,18,10,LW*.6);lit(-8,-lh-20,16,8);
  seg(16,-lh-36,16,-lh-62,LW*.7);inkPoly([[16,-lh-62],[34,-lh-57],[16,-lh-52]],'#c8553d',.95,LW*.6,.2)}
function fishShack(){const w=rnd(60,76),h=rnd(34,42);inkPoly(rectPoly(-w/2,-h,w,h),pick(['#a9a39a','#b9b2a6','#9d97a6']),.8);inkPoly([[-w/2-5,-h],[w/2+5,-h],[0,-h-22]],'#6e6a66',.85);
  inkPoly(rectPoly(-w*.36,-h-34,w*.72,14),'#f3efe6',.95,LW*.7,.2);inkText(pick(['FISH','CRABS','CLAMS','OYSTERS']),0,-h-23,11);
  inkRect(-w/2+8,-h+10,12,12,LW*.7);lit(-w/2+9,-h+11,10,10);inkRect(6,-22,12,22,LW*.7);
  for(let i=0;i<3;i++){const bx=-w/2+26+i*7,by=-h+16;seg(bx,-h+6,bx,by-4,LW*.4);ctx.beginPath();ctx.ellipse(bx,by,3,5,0,0,7);ctx.fillStyle=pick(['#c8553d','#e9b949','#f3efe6','#7fb0e6']);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.8;ctx.stroke()}}
function palm(){const h=rnd(110,150),lean=rnd(-30,30);const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push([lean*t*t,-h*t])}
  for(let i=0;i<8;i++){const a=pts[i],b=pts[i+1];inkPoly([[a[0]-4,a[1]],[a[0]+4,a[1]],[b[0]+3.5,b[1]],[b[0]-3.5,b[1]]],'#c49a6c',.9,LW*.6,.2)}
  const[tx,ty]=pts[8];for(let k=0;k<7;k++){const an=-Math.PI+k/6*Math.PI+rnd(-.15,.15),len=rnd(36,52),ex=tx+Math.cos(an)*len,ey=ty+Math.sin(an)*len*.55+18;
    const fr=[[tx,ty],[tx+Math.cos(an)*len*.5,ty+Math.sin(an)*len*.4-6],[ex,ey],[tx+Math.cos(an)*len*.5,ty+Math.sin(an)*len*.4+3]];inkPoly(fr,pick(['#7d9c6c','#8fae7a','#6b8f73']),.92,LW*.6,.2)}
  for(const[dx,dy]of[[-3,3],[3,4]])inkCircle(tx+dx,ty+dy,3.4,'#8a5a3c',LW*.5)}
function duneGrass(){for(let i=0;i<9;i++){const x=rnd(-20,20),h=rnd(10,24);inkLine([[x,0],[x+rnd(-8,8),-h]],LW*.5)}}
function sandFence(){const w=rnd(70,120);for(let x=-w/2;x<=w/2;x+=6){const lean=rnd(-2,3);seg(x,0,x+lean,-rnd(18,24),LW*.55)}seg(-w/2,-8,w/2,-9,LW*.4);seg(-w/2,-16,w/2,-17,LW*.4)}
function pierAt(x0,len,lc){const dy=G-26;ctx.save();for(let x=x0;x<=x0+len;x+=34)seg(x,dy,x+rnd(-1,1),G+2,LW*.9);inkPoly(rectPoly(x0-10,dy-6,len+20,6),'#b5835a',.9,LW*.8,.3);
  seg(x0-10,dy-18,x0+len+10,dy-18,LW*.6);for(let x=x0-8;x<=x0+len+8;x+=17)seg(x,dy-6,x,dy-18,LW*.5);
  LCTX=lc;for(let x=x0+60;x<x0+len-40;x+=150){seg(x,dy-6,x,dy-46,LW*.8);inkPoly([[x-5,dy-46],[x+5,dy-46],[x+3,dy-56],[x-3,dy-56]],'#f3d27a',.9,LW*.6,.2);glowAt(x,dy-50,34)}
  ctx.translate(x0+len-26,dy-6);inkPoly(rectPoly(-22,-30,44,30),'#f3efe6',.85);inkPoly([[-27,-30],[27,-30],[0,-46]],'#3b3f6e',.9);inkRect(-8,-22,16,12,LW*.6);lit(-7,-21,14,10);LCTX=null;ctx.restore()}
function mooredBoat(){const w=rnd(30,44);const hull=[[-w/2,-4],[w/2,-4],[w/2-6,4],[-w/2+6,4]];inkPoly(hull,pick(['#f3efe6','#c8553d','#7fb0e6','#e9b949']),.95,LW*.7,.2);
  if(chance(.6)){const mh=rnd(40,60);seg(0,-4,0,-4-mh,LW*.8);inkPoly([[2,-8],[2,-4-mh],[w*.45,-8]],'#fbf8f1',.6,LW*.6,.2)}}
function buildCoastMain(seed){const{outerR,c,lc}=mainSetup(seed,31);
  // the open sea behind everything, with a horizon line
  {const kh=[3,rnd(0,6),1.5,7,rnd(0,6),.8],top=[];for(let x=-20;x<=L+B+20;x+=14)top.push([x,G-66+per(x,L,kh)]);const sea=[...top,[L+B+20,G+6],[-20,G+6]];base(sea);wash(sea,'#8fb6e2',.75,1.2);inkLine(top,LW*.8);
   for(let i=0;i<120;i++){const xx=rnd(0,L+B),yy=G-rnd(8,58);seg(xx,yy,xx+rnd(8,22),yy,LW*.4)}}
  // two bays where the land drops to the water; the rest is dunes and town
  const bays=[];{let bx=rnd(250,450);for(let i=0;i<2;i++){const bw=rnd(820,980);bays.push([bx,bx+bw]);bx+=bw+rnd(1000,1150)}}LAKES=bays.map(b=>({x0:b[0],x1:b[1]}));
  const inBay=x=>bays.some(b=>x>b[0]&&x<b[1]);
  const kd=[6,rnd(0,6),1,17,rnd(0,6),.5],dy=x=>{let d=1;for(const b of bays){const e=Math.min(Math.abs(x-b[0]),Math.abs(x-b[1]));if(x>b[0]&&x<b[1])return 0;d=Math.min(d,Math.min(1,e/140))}return d*(26+14*(per(x,L,kd)+1))};
  {const top=[];for(let x=-20;x<=L+B+20;x+=10){const xx=((x%L)+L)%L;top.push([x,G-dy(xx)])}const dune=[...top,[L+B+20,G+6],[-20,G+6]];base(dune);
    const sea2=[];ctx.save();wash(dune,'#ead3a2',.9,1);ctx.restore();inkLine(top,LW);
    for(let x=0;x<L+B;x+=rnd(30,80)){const xx=((x%L)+L)%L;if(dy(xx)<14)continue;ctx.save();ctx.translate(x,G-dy(xx)+3);ctx.scale(.7,.7);duneGrass();ctx.restore()}
    for(const b of bays)for(const xx of b[0]<B+20?[b[0],b[0]+L]:[b[0]]){const bb=[xx,xx+b[1]-b[0]];for(let i=0;i<34;i++){const x=rnd(bb[0]+20,bb[1]-20),y=G-rnd(3,40);ctx.beginPath();ctx.arc(x,y,4,Math.PI*1.1,Math.PI*1.9);ctx.strokeStyle=INK;ctx.lineWidth=LW*.45;ctx.stroke()}}}
  // the pier in the first bay, moored boats in the second, the lighthouse on rocks at the end of the second
  pierAt(bays[0][0]-30,rnd(360,440),lc.getContext('2d'));
  {const b=bays[1];for(let i=0;i<4;i++){R=mulberry(seed+900+i);nz=noise1();ctx.save();ctx.translate(b[0]+120+i*rnd(140,180),G-22);mooredBoat();ctx.restore()}}
  R=outerR;nz=noise1();
  const lhX=bays[1][1]+70;{ctx.save();ctx.translate(lhX,G+1);for(let i=0;i<3;i++){ctx.save();ctx.translate(-50+i*40,0);rocks();ctx.restore()}ctx.translate(0,-20);LCTX=lc.getContext('2d');lighthouse(true);LCTX=null;ctx.restore()}
  const skips=[...bays.map(b=>[b[0]-20,b[1]+20]),[lhX-90,lhX+150]];
  const kinds=[['cottage',5],['huts',1.2],['lifeguard',.8],['shack',1],['palm',1.3],['house',1.6],['grass',1.2],['fence',.8],['pine',.6]];const tot=kinds.reduce((a,k)=>a+k[1],0);
  const W2={cottage:96,huts:120,lifeguard:50,shack:80,palm:60,house:120,grass:40,fence:110,pine:40};
  const items=sizedLayout(L,()=>{let r=R()*tot,k='cottage';for(const[kk,w]of kinds){if((r-=w)<0){k=kk;break}}return{k,w:W2[k]}},skips);
  wrapDraw(items,(it,xx,primary)=>{R=mulberry(it.s);nz=noise1();ctx.save();const yy=G-dy(((xx%L)+L)%L)*.6+1;ctx.translate(xx,yy);LCTX=lc.getContext('2d');
    ({cottage:()=>stiltCottage(primary),huts:beachHuts,lifeguard,shack:fishShack,palm,house:()=>house(primary,{wall:pick(['#f3efe6','#a9b7c8','#e8c86a','#9fb38a']),roof:pick(['#6e6a66','#3b3f6e']),garage:false}),grass:duneGrass,fence:sandFence,pine:()=>pine(rnd(60,100),pick(MP.pine))})[it.k]();
    LCTX=null;ctx.restore()},L);
  R=outerR;nz=noise1();const lanes=groundBands({shoulder:'board',road:'asphalt'});
  return{strip:blendSeam(c,L,B),lights:blendSeam(lc,L,B),cars:makeVehicles(seed,['surf','van','jeep','sedan','wagon','surf'],lanes)}}
function buildCoastBack(seed){return genericBack(seed,41,(wrap)=>{const haze='#c9cfe6';let x=rnd(0,200);
  while(x<Lb){const w=rnd(180,420),h=rnd(80,170),col=mix(pick(['#9fb38a','#a9b98a','#b3a9bf','#c9b49a']),haze,rnd(.45,.6));const sx=rnd(.3,.7);
    wrap(x,w,x0=>{const p=[[x0,Gb-40]];for(let i=0;i<=12;i++){const t=i/12;p.push([x0+t*w,Gb-40-h*Math.pow(Math.sin(Math.PI*Math.min(1,t/sx/2+(t>sx?(t-sx)/(1-sx)/2:0))),.8)])}p.push([x0+w,Gb-40]);backPoly(p,col)});
    if(chance(.4)){const lx=x+w*sx;wrap(lx,10,x0=>{ctx.fillStyle=mix('#f3efe6',haze,.3);ctx.fillRect(x0-6,Gb-40-h-60,12,60);ctx.fillStyle=mix('#c8553d',haze,.4);ctx.fillRect(x0-6,Gb-40-h-40,12,14)})}
    x+=w+rnd(200,600)}
  for(let i=0;i<3;i++){const sx=rnd(0,Lb);wrap(sx,80,x0=>{ctx.fillStyle=mix('#6e6a66',haze,.4);ctx.fillRect(x0,Gb-78,90,16);ctx.fillRect(x0+20,Gb-100,30,22);ctx.fillRect(x0+56,Gb-96,6,18)})}
  ctx.fillStyle=mix('#8fb6e2',haze,.35);ctx.fillRect(-50,Gb-62,Lb+400,62)},mix('#8fb6e2','#c9cfe6',.35))}
// coast foreground
function umbrella(){const h=rnd(58,72),r=rnd(30,38),tilt=rnd(-.2,.2),col=pick(['#c8553d','#7fb0e6','#e9b949','#9fb38a','#b5576b','#e39a3b']);ctx.save();ctx.rotate(tilt);seg(0,4,0,-h,LW*.9);
  const top=[];for(let i=0;i<=16;i++){const a=Math.PI+i/16*Math.PI;top.push([Math.cos(a)*r,-h+6+Math.sin(a)*16])}base(top);
  ctx.save();polyPath(top);ctx.clip();for(let i=0;i<6;i++){ctx.fillStyle=i%2?'#fbf8f1':hexA(col,.92);ctx.beginPath();ctx.moveTo(0,-h-12);ctx.lineTo(-r+i*r/3,-h+8);ctx.lineTo(-r+(i+1)*r/3,-h+8);ctx.closePath();ctx.fill()}ctx.restore();
  inkLine([...top,top[0]],LW*.85);for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(-r+r/6+i*r/3,-h+6,r/6,0,Math.PI);ctx.strokeStyle=INK;ctx.lineWidth=LW*.5;ctx.stroke()}ctx.restore()}
function beachChair(){const col=pick(['#c8553d','#7fb0e6','#e9b949','#9fb38a']);seg(-14,0,8,-14,LW*.8);seg(10,0,-4,-12,LW*.8);const f=[[-6,-6],[12,-4],[4,-30],[-12,-30]];base(f);
  ctx.save();polyPath(f);ctx.clip();for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#fbf8f1':hexA(col,.9);ctx.fillRect(-14+i*6,-32,6,30)}ctx.restore();inkLine([...f,f[0]],LW*.75)}
function surfboard(){const h=rnd(54,70),col=pick(['#e9b949','#7fb0e6','#f0b7a4','#9fb38a','#f3efe6']);ctx.save();ctx.rotate(rnd(-.15,.15));const p=[];for(let i=0;i<=20;i++){const a=i/20*6.283;p.push([Math.sin(a)*8,-h/2-Math.cos(a)*h/2])}inkPoly(p,col,.95,LW*.8,.2);seg(0,-4,0,-h+4,LW*.4);seg(-7,-h*.4,7,-h*.4,LW*.6);ctx.restore()}
function sandcastle(){inkPoly([[-22,0],[22,0],[18,-14],[-18,-14]],'#e3c48e',.95,LW*.7);for(const[x,h]of[[-12,24],[0,32],[12,24]]){inkPoly(rectPoly(x-5,-h,10,h-12),'#e8cf9a',.95,LW*.6);for(let k=0;k<3;k++)inkRect(x-5+k*3.6,-h-3,2.4,3,LW*.35)}seg(0,-35,0,-46,LW*.5);inkPoly([[0,-46],[9,-43],[0,-40]],'#c8553d',.95,LW*.5,.2)}
function gullStand(){ctx.save();if(chance(.5))ctx.scale(-1,1);const b=blobPts(0,-14,11,6,14,.06);inkPoly(b,'#fbf8f1',.95,LW*.7,.1);inkPoly([[-8,-16],[6,-17],[12,-12],[-4,-12]],'#a9a39a',.9,LW*.5,.1);inkCircle(-10,-21,5,'#fbf8f1',LW*.6);
  inkPoly([[-15,-21],[-21,-20],[-15,-19]],'#e9b949',.95,LW*.4,.1);seg(-2,-8,-3,0,LW*.5);seg(2,-8,3,0,LW*.5);ctx.restore()}
function lifebuoy(){seg(0,0,0,-56,LW*1);inkCircle(0,-40,11,'#fbf8f1',LW*.8);ctx.save();for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(0,-40,11,i*Math.PI/2,i*Math.PI/2+.7);ctx.strokeStyle='#c8553d';ctx.lineWidth=6;ctx.stroke()}ctx.restore();ctx.beginPath();ctx.arc(0,-40,5,0,7);ctx.fillStyle='#ead3a2';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.6;ctx.stroke()}
function towel(){const col=pick(['#c8553d','#7fb0e6','#e9b949','#b5576b']),p=[[-28,0],[28,0],[24,-6],[-24,-6]];base(p);ctx.save();polyPath(p);ctx.clip();for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#fbf8f1':hexA(col,.9);ctx.fillRect(-28+i*7,-7,7,8)}ctx.restore();inkLine([...p,p[0]],LW*.6)}
function shells(){for(let i=0;i<4;i++){const x=rnd(-20,20);ctx.beginPath();ctx.arc(x,-2,3,Math.PI,0);ctx.fillStyle=pick(['#f0b7a4','#fbf8f1','#e8c86a']);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.7;ctx.stroke()}
  if(chance(.5)){ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*6.283-Math.PI/2,r=i%2?3:8;ctx.lineTo(14+Math.cos(a)*r,-8+Math.sin(a)*r)}ctx.closePath();ctx.fillStyle='#e39a3b';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.8;ctx.stroke()}}
function beachgoer(){person();if(chance(.6)){ctx.beginPath();ctx.arc(0,-59,10,Math.PI,0);ctx.fillStyle='#e8c86a';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.6;ctx.stroke();seg(-13,-59,13,-59,LW*.7)}}
const CFKINDS=[['umbrella',2.4],['beachChair',1.4],['surfboard',1.2],['sandcastle',.7],['gullStand',.9],['duneGrass',2.4],['sandFence',1.2],['lifebuoy',.5],['towel',.9],['shells',1],['palm',.5]];
const CFFN={umbrella,beachChair,surfboard,sandcastle,gullStand,duneGrass,sandFence,lifebuoy,towel,shells,palm,beachgoer,bonfire};

// ================= FARM =================
const FIELD=['#e8c86a','#9fb38a','#b5c98a','#c49a6c','#d9b56a','#a3b77f','#e6c08a','#b39ad8'];
function barn(primary){const w=rnd(92,122),h=rnd(46,58),col=pick(['#c8553d','#b0473f','#c9744a','#a33b22']),x=-w/2;
  const p=[[x,0],[x,-h],[x+w*.14,-h-24],[0,-h-40],[-x-w*.14,-h-24],[-x,-h],[-x,0]];inkPoly(p,col,.85,LW);
  ctx.save();ctx.globalAlpha=.9;inkLine([[x-4,-h+2],[x+w*.14,-h-24],[0,-h-40],[-x-w*.14,-h-24],[-x+4,-h+2]],LW*2.2,'#f3efe6');ctx.restore();inkLine([[x-4,-h+2],[x+w*.14,-h-24],[0,-h-40],[-x-w*.14,-h-24],[-x+4,-h+2]],LW*.6);
  const dw=w*.42,dh=h*.72;inkPoly(rectPoly(-dw/2,-dh,dw,dh),col,.6,LW*.8);inkLine([[-dw/2,-dh],[dw/2,0]],LW*1.4,'#f3efe6');inkLine([[dw/2,-dh],[-dw/2,0]],LW*1.4,'#f3efe6');inkRect(-dw/2,-dh,dw,dh,LW*.8);seg(0,-dh,0,0,LW*.7);
  inkPoly(rectPoly(-9,-h-20,18,16),'#f3efe6',.9,LW*.7,.2);lit(-7,-h-18,14,12);seg(0,-h-40,0,-h-60,LW*.7);inkLine([[-8,-h-55],[8,-h-55],[4,-h-58]],LW*.6);
  if(chance(.7)){ctx.save();ctx.translate(-x+22,0);silo();ctx.restore()}}
function silo(){const w=rnd(26,34),h=rnd(118,160),col=pick(['#d9d3c8','#a9b7c8','#c8553d','#cfc7b8']);inkPoly(rectPoly(-w/2,-h,w,h),col,.85,LW);for(let y=-18;y>-h;y-=18)seg(-w/2,y,w/2,y,LW*.4);
  ctx.beginPath();ctx.arc(0,-h,w/2+1,Math.PI,0);ctx.closePath();base([[-w/2,-h],[w/2,-h],[0,-h-w/2]]);ctx.fillStyle='#8f8c86';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.9;ctx.stroke();seg(w/2-4,0,w/2-4,-h,LW*.4);seg(w/2-9,0,w/2-9,-h,LW*.4)}
function grainElevator(){const w=rnd(58,70),h=rnd(200,230);for(let i=0;i<3;i++){const cx=-w/2-18-i*22;inkPoly(rectPoly(cx-11,-h*.55,22,h*.55),'#d9d3c8',.85,LW*.8);ctx.beginPath();ctx.arc(cx,-h*.55,11,Math.PI,0);ctx.fillStyle='#b9b2a6';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke()}
  inkPoly(rectPoly(-w/2,-h,w,h),'#e6dccb',.85,LW);inkPoly([[-w/2+8,-h],[w/2-8,-h],[w/2-14,-h-34],[-w/2+14,-h-34]],'#cfc7b8',.85,LW*.9);inkRect(-8,-h-26,16,14,LW*.6);lit(-7,-h-25,14,12);
  inkPoly(rectPoly(-w/2+4,-h*.62,w-8,16),'#f3efe6',.95,LW*.6,.2);inkText('CO-OP',0,-h*.62+12,12);inkLine([[w/2,-h*.8],[w/2+40,-20]],LW*.9);for(let y=-30;y>-h+20;y-=40){inkRect(-w/2+10,y-12,8,10,LW*.5);lit(-w/2+11,y-11,6,8)}}
function farmWindmill(primary){const h=rnd(128,150);seg(-18,0,-4,-h,LW*.9);seg(18,0,4,-h,LW*.9);for(let i=0;i<5;i++){const y0=-i*h/5,y1=-(i+1)*h/5,w0=18-i*14/5,w1=18-(i+1)*14/5;seg(-w0,y0,w1,y1,LW*.45);seg(w0,y0,-w1,y1,LW*.45);seg(-w1,y1,w1,y1,LW*.6)}
  inkPoly(rectPoly(-9,-h-4,18,6),'#6e6a66',.9,LW*.6,.2);seg(0,-h-6,36,-h-6,LW*.9);inkPoly([[30,-h-6],[52,-h-16],[52,h*0-h+4],[30,-h-6]],'#c8553d',.9,LW*.7,.2);
  if(primary)animAt('wheel',0,-h-6,{r:28});else{ctx.beginPath();ctx.arc(0,-h-6,28,0,7);ctx.strokeStyle=INK;ctx.lineWidth=LW*.6;ctx.stroke()}
  ctx.save();ctx.translate(-48,0);inkPoly(rectPoly(-16,-30,32,22),'#b5835a',.85,LW*.8);for(let y=-25;y<-8;y+=6)seg(-16,y,16,y,LW*.35);seg(-14,-8,-14,0,LW*.7);seg(14,-8,14,0,LW*.7);ctx.restore()}
function dutchMill(primary){const h=rnd(104,120);inkPoly([[-28,0],[28,0],[17,-h],[-17,-h]],pick(['#f3efe6','#e6c08a','#d9d3c8']),.85,LW);ctx.beginPath();ctx.moveTo(-20,-h);ctx.quadraticCurveTo(0,-h-34,20,-h);ctx.closePath();ctx.fillStyle='#6e6a66';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.9;ctx.stroke();
  inkPoly(rectPoly(-7,-22,14,22),'#3b3f6e',.9,LW*.7,.2);for(const y of[-h*.45,-h*.75]){inkRect(-5,y,10,12,LW*.6);lit(-4,y+1,8,10)}seg(-34,-h*.2,34,-h*.2,LW*.8);
  if(primary)animAt('sails',0,-h-6,{r:74});else inkCircle(0,-h-6,4,'#3b3a40')}
function orchard(){const n=Math.round(rnd(4,6));for(let i=0;i<n;i++){ctx.save();ctx.translate(-n*16+i*32+rnd(-3,3),0);const h=rnd(38,50);seg(0,0,0,-h*.5,LW*.9);const r=h*.36;inkPoly(blobPts(0,-h+r,r,r*.9,16,.12),pick(['#7d9c6c','#8fae7a','#6b8f73']),.92,LW*.7,.4);
  if(season()!=='winter')for(let k=0;k<5;k++)inkCircle(rnd(-r*.6,r*.6),-h+r+rnd(-r*.5,r*.5),2.2,pick(['#c8553d','#e9b949','#e39a3b']),.6);ctx.restore()}}
function hayBales(){const n=Math.round(rnd(3,5));for(let i=0;i<n;i++){const x=-n*12+i*24+rnd(-3,3),r=rnd(10,13);inkCircle(x,-r,r,'#e8c86a',LW*.7);ctx.beginPath();ctx.arc(x,-r,r*.5,0,5);ctx.strokeStyle=INK;ctx.lineWidth=LW*.4;ctx.stroke()}}
function cow(){ctx.save();if(chance(.5))ctx.scale(-1,1);const bd=blobPts(0,-26,20,10,16,.06);base(bd);ctx.save();polyPath(bd);ctx.clip();ctx.fillStyle='#fbf8f1';ctx.fillRect(-24,-40,48,30);ctx.fillStyle='#2f2f38';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(rnd(-14,14),rnd(-32,-22),rnd(4,8),rnd(3,6),rnd(0,3),0,7);ctx.fill()}ctx.restore();
  inkLine([...bd,bd[0]],LW*.8);for(const lx of[-14,-9,9,14])seg(lx,-20,lx+rnd(-1,1),0,LW*.7);const hd=[[-22,-34],[-32,-32],[-34,-24],[-24,-22]];inkPoly(hd,'#fbf8f1',.95,LW*.7,.1);inkCircle(-31,-26,2.4,'#f0b7a4',.5);seg(-24,-34,-22,-38,LW*.5);ctx.restore()}
function cows(){const n=Math.round(rnd(1,3));for(let i=0;i<n;i++){ctx.save();ctx.translate(-n*24+i*48+rnd(-6,6),0);cow();ctx.restore()}}
function coop(){inkPoly(rectPoly(-22,-26,44,22),'#c8553d',.85,LW*.8);inkPoly([[-26,-26],[26,-26],[0,-40]],'#f3efe6',.9,LW*.8);seg(-18,-4,-18,0,LW*.6);seg(18,-4,18,0,LW*.6);inkLine([[22,-8],[38,0]],LW*.7);inkRect(-6,-20,10,10,LW*.6)}
function farmTree(){roundTree(rnd(70,100))}
function buildFarmMain(seed){const{outerR,c,lc}=mainSetup(seed,51);
  // two bands of rolling patchwork fields
  const fields=(k,y0,amp,fade)=>{const hy=x=>y0-amp*(per(x,L,k)+1.2);const cuts=[0];let x=0;while(x<L-200){x+=rnd(150,340);cuts.push(Math.min(x,L))}if(L-cuts[cuts.length-1]<120)cuts.pop();cuts.push(L);
    const one=(a,b,col,tex,xo)=>{const top=[];for(let x=a;x<=b+.1;x+=Math.min(12,(b-a)/4))top.push([x+xo,hy(x)]);const poly=[...top,[b+xo,G+6],[a+xo,G+6]];base(poly);wash(poly,fade?mix(col,'#e9e3f0',.25):col,.85,.8);
      ctx.save();polyPath(poly);ctx.clip();ctx.strokeStyle='rgba(29,27,32,.32)';ctx.lineWidth=LW*.45;
      if(tex==='rows')for(let d=10;d<G-y0+amp*3;d+=11){ctx.beginPath();for(let x=a;x<=b;x+=12){const y=hy(x)+d;x>a?ctx.lineTo(x+xo,y):ctx.moveTo(x+xo,y)}ctx.stroke()}
      else if(tex==='ticks')for(let i=0;i<(b-a)/6;i++){const x=rnd(a,b),y=hy(x)+rnd(4,G-hy(x));ctx.beginPath();ctx.moveTo(x+xo,y);ctx.lineTo(x+xo+1,y-5);ctx.stroke()}
      else if(tex==='dots')for(let i=0;i<(b-a)/8;i++){const x=rnd(a,b),y=hy(x)+rnd(4,G-hy(x));ctx.beginPath();ctx.arc(x+xo,y,1.4,0,7);ctx.fillStyle='rgba(29,27,32,.3)';ctx.fill()}
      ctx.restore();inkLine(top,LW*.8);seg(a+xo,hy(a),a+xo+rnd(-4,4),G,LW*.5)};
    const spec=[];for(let i=0;i<cuts.length-1;i++)spec.push([cuts[i],cuts[i+1],pick(FIELD),pick(['rows','rows','ticks','dots']),Math.floor(R()*1e9)]);
    for(const[a,b,col,tex,s]of spec){for(const xo of a<B+20?[0,L]:[0]){R=mulberry(s);nz=noise1();one(a,b,col,tex,xo)}}
    R=outerR;nz=noise1();return hy};
  const hy1=fields([4,rnd(0,6),1.2,9,rnd(0,6),.5],G-92,34,true);
  speckle(hy1,[40,120],()=>roundTree(rnd(14,22),LEAF.summer.map(c=>mix(c,'#e9e3f0',.2))),null,x=>chance(.5));
  R=outerR;nz=noise1();
  const hy2=fields([5,rnd(0,6),1,13,rnd(0,6),.45],G-46,26,false);
  R=outerR;nz=noise1();
  // farmsteads along the road
  const forced=[[L*.12,'dutch',90],[L*.45,'elevator',150],[L*.7,'dutch',90]];let fi=0;
  const kinds=[['barn',2.2],['house',1.6],['windmill',1.2],['orchard',1.4],['hay',1.8],['cows',1.8],['tree',2],['coop',.7],['silo',.6]];const tot=kinds.reduce((a,k)=>a+k[1],0);
  const W2={barn:160,house:120,windmill:110,orchard:190,hay:110,cows:120,tree:60,coop:70,silo:40};
  const items=sizedLayout(L,x=>{if(fi<forced.length&&x>forced[fi][0]){const f=forced[fi++];return{k:f[1],w:f[2],big:true}}let r=R()*tot,k='tree';for(const[kk,w]of kinds){if((r-=w)<0){k=kk;break}}return{k,w:W2[k]}});
  wrapDraw(items,(it,xx,primary)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,G+1);LCTX=lc.getContext('2d');
    ({barn:()=>barn(primary),house:()=>house(primary,{wall:pick(['#f3efe6','#e8c86a','#f0e2c4','#c9b4d9']),roof:pick(['#6e6a66','#3b3f6e','#8a3d3d']),garage:false,smoke:.7}),windmill:()=>farmWindmill(primary),orchard,hay:hayBales,cows,tree:farmTree,coop,silo,dutch:()=>dutchMill(primary),elevator:grainElevator})[it.k]();
    LCTX=null;ctx.restore()},L);
  R=outerR;nz=noise1();const lanes=groundBands({shoulder:'rail',road:'dirt',edge:'#d9c48a'});
  return{strip:blendSeam(c,L,B),lights:blendSeam(lc,L,B),cars:makeVehicles(seed,['pickup','hay','tractor','pickup','sedan','wagon'],lanes)}}
function buildFarmBack(seed){return genericBack(seed,61,(wrap)=>{const haze='#cdc8de';
  for(const[y0,amp,k]of[[Gb-260,90,[3,rnd(0,6),1,7,rnd(0,6),.6]],[Gb-150,70,[4,rnd(0,6),1,9,rnd(0,6),.5]]]){const hy=x=>y0-amp*(Math.sin(x/Lb*Math.PI*2*k[0]+k[1])*k[2]+Math.sin(x/Lb*Math.PI*2*k[3]+k[4])*k[5]);
    let x=-200;while(x<Lb+200){const w=rnd(120,300),col=mix(pick(FIELD),haze,rnd(.45,.6)),p=[];for(let t=0;t<=1.001;t+=.1)p.push([x+t*w,hy(x+t*w)]);p.push([x+w,Gb],[x,Gb]);backPoly(p,col,.18);x+=w}}
  for(let i=0;i<7;i++){const x=rnd(0,Lb);wrap(x,60,x0=>{ctx.fillStyle=mix('#c8553d',haze,.5);ctx.fillRect(x0,Gb-130,46,34);ctx.beginPath();ctx.moveTo(x0-4,Gb-130);ctx.lineTo(x0+23,Gb-152);ctx.lineTo(x0+50,Gb-130);ctx.fill();ctx.fillStyle=mix('#d9d3c8',haze,.4);ctx.fillRect(x0+52,Gb-190,16,94)})}},mix('#b5c98a','#cdc8de',.4))}
// farm foreground
function sunflowers(){const n=Math.round(rnd(3,5));for(let i=0;i<n;i++){const x=-n*7+i*14+rnd(-3,3),h=rnd(60,90);seg(x,0,x+rnd(-3,3),-h,LW*.8);inkPoly([[x,-h*.45],[x+14,-h*.5],[x+4,-h*.4]],'#7d9c6c',.9,LW*.5,.2);
  ctx.save();ctx.translate(x,-h);for(let k=0;k<10;k++){ctx.rotate(.628);ctx.beginPath();ctx.ellipse(0,-9,3.2,6,0,0,7);ctx.fillStyle='#e9b949';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.6;ctx.stroke()}ctx.restore();inkCircle(x,-h,5.5,'#8a5a3c',LW*.6)}}
function corn(){const n=Math.round(rnd(4,7)),dry=season()==='fall'||season()==='winter';for(let i=0;i<n;i++){const x=-n*6+i*12+rnd(-2,2),h=rnd(70,96);seg(x,0,x+rnd(-2,2),-h,LW*.8);
  for(let k=0;k<4;k++){const y=-h*(.25+k*.18),s=k%2?1:-1;inkLine([[x,y],[x+s*12,y-8],[x+s*20,y-2]],LW*.6,dry?'#8a6a3c':INK)}if(chance(.6)){ctx.beginPath();ctx.ellipse(x+4,-h*.55,3,8,.3,0,7);ctx.fillStyle='#e8c86a';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.7;ctx.stroke()}}}
function pumpkins(){const n=Math.round(rnd(2,4));for(let i=0;i<n;i++){const x=-n*10+i*20+rnd(-3,3),r=rnd(8,12);ctx.save();ctx.translate(x,-r);ctx.beginPath();ctx.ellipse(0,0,r*1.2,r,0,0,7);ctx.fillStyle='#e39a3b';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.7;ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,r*.45,r,0,0,7);ctx.lineWidth=LW*.4;ctx.stroke();seg(0,-r,2,-r-5,LW*.7);ctx.restore()}}
function scarecrow(){seg(0,0,0,-80,LW*1.1);seg(-28,-58,28,-58,LW*.9);inkPoly([[-10,-64],[10,-64],[12,-34],[-12,-34]],pick(['#c8553d','#7fb0e6','#9fb38a']),.92,LW*.8);inkPoly([[-24,-62],[-10,-64],[-10,-56],[-24,-54]],'#c8553d',.85,LW*.6);inkPoly([[24,-62],[10,-64],[10,-56],[24,-54]],'#c8553d',.85,LW*.6);
  inkCircle(0,-72,8,'#e8c86a',LW*.7);inkPoly([[-14,-76],[14,-76],[6,-80],[4,-92],[-4,-92],[-6,-80]],'#8a5a3c',.92,LW*.7,.2);for(const s of[-1,1])for(let k=0;k<3;k++)seg(s*26,-58,s*(30+k*2),-52+k*3,LW*.4)}
function chickens(){const n=Math.round(rnd(2,3));for(let i=0;i<n;i++){ctx.save();ctx.translate(-n*10+i*20,0);if(chance(.5))ctx.scale(-1,1);const b=blobPts(0,-10,8,6,12,.1);inkPoly(b,pick(['#fbf8f1','#c9744a','#f3efe6']),.95,LW*.6,.1);inkCircle(-7,-17,4,'#fbf8f1',LW*.5);
  inkPoly([[-8,-21],[-5,-24],[-4,-20]],'#c8553d',.95,LW*.3,.1);inkPoly([[-11,-17],[-14,-16],[-11,-15]],'#e9b949',.95,LW*.3,.1);seg(-2,-5,-2,0,LW*.4);seg(2,-5,3,0,LW*.4);ctx.restore()}}
function smallBale(){inkPoly(rectPoly(-20,-18,40,18),'#e8c86a',.92,LW*.8);ctx.save();ctx.globalAlpha=.5;for(let i=0;i<8;i++){const x=rnd(-17,17);seg(x,-16,x+rnd(-3,3),-3,LW*.3)}ctx.restore();seg(-8,-18,-8,0,LW*.5);seg(8,-18,8,0,LW*.5)}
function milkCan(){inkPoly([[-7,0],[7,0],[7,-18],[4,-22],[4,-26],[-4,-26],[-4,-22],[-7,-18]],'#b9bfcc',.9,LW*.7,.2);seg(-7,-12,7,-12,LW*.4)}
function wheelbarrow(){inkPoly([[-18,-20],[14,-20],[8,-8],[-12,-8]],'#c8553d',.9,LW*.7);inkCircle(14,-6,6,'#3b3a40',LW*.6);seg(-18,-14,-30,-10,LW*.7);seg(-10,-8,-12,0,LW*.6)}
function farmer(){person();inkPoly([[-12,-58],[12,-58],[6,-62],[5,-68],[-5,-68],[-6,-62]],'#e8c86a',.95,LW*.6,.2)}
function mailboxRural(){seg(0,0,0,-34,LW);const b=[[-12,-34],[12,-34],[12,-44],[0,-50],[-12,-44]];inkPoly(b,pick(['#b9bfcc','#3b3f6e','#c8553d']),.9,LW*.7);seg(12,-40,16,-52,LW*.6);inkPoly([[16,-52],[22,-50],[16,-47]],'#c8553d',.95,LW*.4,.1)}
const FMKINDS=[['railFence',2.4],['sunflowers',1.6],['corn',1.6],['pumpkins',season()==='fall'?1.4:.3],['scarecrow',.4],['chickens',.8],['smallBale',1.2],['milkCan',.5],['wheelbarrow',.4],['bush',1.2],['flowers',1.2],['mailboxRural',.5]];
const FMFN={railFence,sunflowers,corn,pumpkins,scarecrow,chickens,smallBale,milkCan,wheelbarrow,bush,flowers,mailboxRural,farmer};

// ================= SUBURBS =================
function school(){const w=rnd(210,240),h=rnd(56,64),x=-w/2;inkPoly(rectPoly(x,-h,w,h),'#c9744a',.85,LW);inkPoly(rectPoly(x-4,-h-6,w+8,6),'#e6dccb',.9,LW*.7,.2);
  for(let r=0;r<2;r++)for(let c=0;c<9;c++){const xx=x+10+c*(w-20)/9;if(c===4)continue;const yy=-h+10+r*24;ctx.fillStyle='rgba(40,40,50,.45)';ctx.fillRect(xx+1,yy+1,12,10);inkRect(xx,yy,14,12,LW*.6);lit(xx+1,yy+1,12,10)}
  const ew=34;inkPoly(rectPoly(-ew/2,-h-30,ew,30),'#c9744a',.9,LW*.9);inkPoly([[-ew/2-4,-h-30],[ew/2+4,-h-30],[0,-h-48]],'#6e6a66',.9,LW*.8);inkCircle(0,-h-18,7,'#fbf8f1',LW*.6);seg(0,-h-18,0,-h-23,LW*.5);seg(0,-h-18,4,-h-18,LW*.5);
  inkPoly(rectPoly(-12,-24,24,24),'#3b3f6e',.9,LW*.7,.2);seg(0,-24,0,0,LW*.5);inkPoly(rectPoly(-30,-36,60,10),'#f3efe6',.95,LW*.6,.2);inkText('SCHOOL',0,-28,10);
  seg(-x+22,0,-x+22,-110,LW*.8);inkPoly([[-x+22,-110],[-x+50,-104],[-x+22,-96]],'#c8553d',.95,LW*.6,.2);seg(-x+22,-104,-x+40,-104,LW*.3)}
function waterTower(){const h=rnd(150,170);seg(-30,0,-20,-h,LW*.9);seg(30,0,20,-h,LW*.9);seg(-10,0,-8,-h,LW*.6);seg(10,0,8,-h,LW*.6);for(let i=1;i<4;i++){const y=-i*h/4;seg(-30+i*2.5,y,30-i*2.5,y,LW*.5);seg(-30+(i-1)*2.5,y+h/4,30-i*2.5,y,LW*.35)}
  const tw=88,th=50;const tk=[];for(let i=0;i<=20;i++){const a=Math.PI+i/20*Math.PI;tk.push([Math.cos(a)*tw/2,-h-th*.5+Math.sin(a)*-th*.5])}
  inkPoly([[-tw/2,-h-th],[tw/2,-h-th],[tw/2,-h-12],[tw/3,-h],[-tw/3,-h],[-tw/2,-h-12]],'#c9d6e2',.88,LW);inkPoly([[-tw/2-3,-h-th],[tw/2+3,-h-th],[0,-h-th-24]],'#a9b7c8',.9,LW*.9);seg(0,-h-th-24,0,-h-th-34,LW*.6);
  inkText(pick(['ELMWOOD','MAPLE','OAKDALE','PINECREST']),0,-h-th*.42,13);seg(-tw/2,-h-12,tw/2,-h-12,LW*.6)}
function cornerStore(){const w=rnd(90,110),h=rnd(50,58),col=pick(['#e8c86a','#f0b7a4','#9fb38a','#f3efe6']);inkPoly(rectPoly(-w/2,-h,w,h),col,.85,LW);inkPoly(rectPoly(-w/2-3,-h-16,w+6,16),'#f3efe6',.95,LW*.7,.2);inkText(pick(['RECORDS','DELI','BOOKS','BAKERY','MARKET']),0,-h-4,11);
  const aw=pick(['#c8553d','#7fb0e6','#9fb38a']);const ay=-h+16;base([[-w/2-4,ay-6],[w/2+4,ay-6],[w/2+8,ay+8],[-w/2-8,ay+8]]);ctx.save();polyPath([[-w/2-4,ay-6],[w/2+4,ay-6],[w/2+8,ay+8],[-w/2-8,ay+8]]);ctx.clip();for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#fbf8f1':hexA(aw,.9);ctx.fillRect(-w/2-8+i*(w+16)/14,ay-8,(w+16)/14,18)}ctx.restore();inkLine([[-w/2-4,ay-6],[w/2+4,ay-6],[w/2+8,ay+8],[-w/2-8,ay+8],[-w/2-4,ay-6]],LW*.7);
  ctx.fillStyle='rgba(40,40,50,.35)';ctx.fillRect(-w/2+8,-30,w*.5,24);inkRect(-w/2+8,-30,w*.5,24,LW*.7);lit(-w/2+9,-29,w*.5-2,22);lit(-w/2+9,-29,w*.5-2,22);glowAt(-w/2+8+w*.25,-18,40,'255,214,120',.5);inkRect(w/2-26,-28,16,28,LW*.7)}
function swingSet(){inkLine([[-30,0],[-22,-50],[-14,0]],LW*.8);inkLine([[30,0],[22,-50],[14,0]],LW*.8);seg(-22,-50,22,-50,LW*.9);for(const x of[-10,8]){seg(x-3,-50,x-3,-16,LW*.4);seg(x+3,-50,x+3,-16,LW*.4);inkPoly(rectPoly(x-5,-17,10,3),'#c8553d',.95,LW*.4,.1)}}
function hoop(){seg(0,0,0,-74,LW*1.1);inkPoly(rectPoly(-2,-92,26,20),'#fbf8f1',.9,LW*.7,.2);inkRect(6,-86,10,8,LW*.4);ctx.beginPath();ctx.ellipse(11,-75,7,2.4,0,0,7);ctx.strokeStyle='#c8553d';ctx.lineWidth=LW*.8;ctx.stroke();for(let i=-2;i<=2;i++)seg(11+i*3,-75,11+i*2,-66,LW*.3)}
function picketWhite(){const w=rnd(70,130);seg(-w/2,-10,w/2,-10,LW*.7);seg(-w/2,-22,w/2,-22,LW*.7);for(let x=-w/2;x<=w/2;x+=9){const p=[[x,0],[x+6,0],[x+6,-28],[x+3,-33],[x,-28]];inkPoly(p,'#fbf8f1',.95,LW*.55,.1)}}
function bins(){for(const[x,col]of[[-9,'#7f9468'],[9,'#5f8fd8']]){inkPoly([[x-8,0],[x+8,0],[x+9,-26],[x-9,-26]],col,.92,LW*.7,.2);inkPoly(rectPoly(x-10,-30,20,4),col,.95,LW*.6,.1);inkCircle(x-6,-1,2.4,'#3b3a40',.5)}}
function gnome(){inkPoly([[-7,0],[7,0],[5,-14],[-5,-14]],'#5f8fd8',.95,LW*.6,.1);inkCircle(0,-17,4,'#f3dcc6',LW*.5);inkPoly([[-5,-18],[5,-18],[0,-34]],'#c8553d',.95,LW*.6,.1);inkPoly([[-4,-16],[4,-16],[0,-8]],'#fbf8f1',.95,LW*.4,.1)}
function kidWagon(){inkPoly(rectPoly(-16,-16,32,10),'#c8553d',.95,LW*.7);inkCircle(-10,-5,5,'#3b3a40',.6);inkCircle(10,-5,5,'#3b3a40',.6);inkLine([[16,-12],[30,-26]],LW*.6)}
function mailbox2(){mailboxRural()}
function subTree(){roundTree(rnd(72,108))}
function sprinkler(){seg(0,0,0,-6,LW*.6);for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(0,-6);ctx.quadraticCurveTo(s*16,-26,s*30,-4);ctx.strokeStyle='rgba(95,143,216,.7)';ctx.lineWidth=1.2;ctx.setLineDash([2,3]);ctx.stroke();ctx.setLineDash([])}}
const SFKINDS=[['picketWhite',2.6],['subTree',1.8],['bush',2],['mailbox2',.9],['bins',.6],['swingSet',.35],['hoop',.35],['gnome',.3],['kidWagon',.3],['bike',.4],['planter',.7],['lamp',1],['sprinkler',.3]];
const SFFN={picketWhite,subTree,bush,mailbox2,bins,swingSet,hoop,gnome,kidWagon,bike,planter,lamp,sprinkler,person};
function buildSuburbsMain(seed){const{outerR,c,lc}=mainSetup(seed,71);
  // a gentle hill of distant rooftops and trees behind
  const hy=hillBand([4,rnd(0,6),1,11,rnd(0,6),.4],G-70,26,'#b7c49a',.7);
  speckle(hy,[22,44],p=>{if(chance(.45)){const w=rnd(26,40),h=rnd(14,20);base([[-w/2,0],[w/2,0],[w/2,-h],[0,-h-12],[-w/2,-h]]);wash([[-w/2,0],[w/2,0],[w/2,-h],[-w/2,-h]],mix(pick(HOUSEC.walls),'#e9e3f0',.35),.7,.3);
    const rf=[[-w/2-3,-h],[w/2+3,-h],[0,-h-12]];wash(rf,mix(pick(HOUSEC.roofs),'#e9e3f0',.3),.8,.2);inkLine([[-w/2-3,-h],[0,-h-12],[w/2+3,-h]],LW*.5);lit(-3,-h+5,6,6)}else roundTree(rnd(22,34),LEAF[season()]?LEAF[season()].map(c=>mix(c,'#e9e3f0',.25)):null)},lc.getContext('2d'));
  R=outerR;nz=noise1();
  // the street: houses with yards, and one school, water tower, church and a couple of shops
  const forced=[[L*.08,'tower',110],[L*.32,'school',260],[L*.55,'church',90],[L*.62,'store',120],[L*.85,'store',120]];let fi=0;
  const kinds=[['house',6],['tree',2.4],['park',.5]];const tot=kinds.reduce((a,k)=>a+k[1],0);const W2={house:150,tree:50,park:110};
  const items=sizedLayout(L,x=>{if(fi<forced.length&&x>forced[fi][0]){const f=forced[fi++];return{k:f[1],w:f[2],big:true}}let r=R()*tot,k='house';for(const[kk,w]of kinds){if((r-=w)<0){k=kk;break}}return{k,w:W2[k]}},[]);
  const chP={walls:['#f3efe6','#efe4d2'],roofs:['#6e6a66','#3b3f6e']};
  wrapDraw(items,(it,xx,primary)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,G+1);LCTX=lc.getContext('2d');
    if(it.k==='house'){house(primary,{smoke:season()==='winter'||season()==='fall'?.5:.15});if(chance(.5)){ctx.save();ctx.translate(rnd(-50,50),0);ctx.scale(.8,.8);picketWhite();ctx.restore()}if(chance(.35)){ctx.save();ctx.translate(chance(.5)?-62:62,0);ctx.scale(.8,.8);roundTree(rnd(70,100));ctx.restore()}}
    else if(it.k==='tree')roundTree(rnd(80,120));else if(it.k==='park'){swingSet();ctx.save();ctx.translate(40,0);roundTree(rnd(80,110));ctx.restore()}
    else if(it.k==='tower')waterTower();else if(it.k==='school')school();else if(it.k==='church')church(chP,rnd(34,42),rnd(80,100));else cornerStore();
    LCTX=null;ctx.restore()},L);
  R=outerR;nz=noise1();const lanes=groundBands({shoulder:'walk',road:'asphalt'});
  return{strip:blendSeam(c,L,B),lights:blendSeam(lc,L,B),cars:makeVehicles(seed,['sedan','wagon','van','sedan','bus','jeep'],lanes)}}
function buildSuburbsBack(seed){return genericBack(seed,81,(wrap)=>{const haze='#cdc8de';let x=0;
  while(x<Lb){const w=rnd(40,80),h=rnd(30,60);const col=mix(pick(HOUSEC.walls),haze,.55),rc=mix(pick(HOUSEC.roofs),haze,.45),k=chance(.4);
    wrap(x,w+40,x0=>{if(k){ctx.fillStyle=mix('#8fae7a',haze,.5);ctx.beginPath();ctx.arc(x0+w/2,Gb-60-h*.5,h*.8,0,7);ctx.fill();ctx.fillRect(x0+w/2-3,Gb-60-h*.4,6,h*.4+60)}else{ctx.fillStyle=col;ctx.fillRect(x0,Gb-60-h,w,h+60);ctx.fillStyle=rc;ctx.beginPath();ctx.moveTo(x0-6,Gb-60-h);ctx.lineTo(x0+w/2,Gb-60-h-24);ctx.lineTo(x0+w+6,Gb-60-h);ctx.fill()}});x+=w*rnd(.6,1.1)}
  {const x0=rnd(200,Lb-300);wrap(x0,80,xx=>{ctx.fillStyle=mix('#a9b7c8',haze,.4);ctx.fillRect(xx+20,Gb-260,8,200);ctx.fillRect(xx+52,Gb-260,8,200);ctx.fillRect(xx,Gb-300,80,46)})}},mix('#a9b77a','#cdc8de',.4))}

// ================= DESERT =================
function mesa(x0,w,h,cols,Gb2){const n=noise1(),tw=w*rnd(.45,.7),tl=x0+(w-tw)*rnd(.3,.7),top=Gb2-h;const p=[[x0,Gb2]];
  const sl=(a,b,steps,y0,y1)=>{for(let i=1;i<=steps;i++){const t=i/steps,yy=y0+(y1-y0)*Math.pow(t,.6);p.push([a+(b-a)*t+n(i+a*.01)*6,yy+n(i*2+a*.02)*8])}};
  sl(x0,tl,6,Gb2,top);for(let i=1;i<=6;i++)p.push([tl+tw*i/6,top+n(i*3)*4]);sl(tl+tw,x0+w,6,top,Gb2);
  base(p);wash(p,cols[0],.85,1);ctx.save();polyPath(p);ctx.clip();const bands=Math.round(rnd(4,7));for(let i=0;i<bands;i++){const y=top+(i+.5)*h/bands;ctx.fillStyle=hexA(cols[(i+1)%cols.length],.4);ctx.fillRect(x0-10,y,w+20,h/bands*.45);
    ctx.strokeStyle='rgba(29,27,32,.35)';ctx.lineWidth=LW*.5;ctx.beginPath();for(let x=x0;x<x0+w;x+=10){const yy=y+n(x*.03+i)*3;x>x0?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke()}ctx.restore();inkLine(p,LW)}
function saguaro(h){h=h||rnd(60,110);const w=Math.max(5,h*.11),col=pick(['#7f9468','#6b8f73','#8fae7a']);const trunk=[[-w,0],[w,0],[w,-h+w],[0,-h],[-w,-h+w]];
  const arm=(s,y,ah)=>{const a=[[s*w,y],[s*(w+ah*.35),y],[s*(w+ah*.35),y-ah],[s*(w+ah*.35-w*1.6),y-ah],[s*(w+ah*.35-w*1.6),y-w*1.6],[s*w,y-w*1.6]];inkPoly(a,col,.92,LW*.7,.2)};
  if(chance(.85))arm(-1,-h*rnd(.35,.55),h*rnd(.25,.4));if(chance(.7))arm(1,-h*rnd(.3,.5),h*rnd(.2,.38));inkPoly(trunk,col,.92,LW*.8,.2);ctx.save();ctx.globalAlpha=.5;seg(0,-4,0,-h+6,LW*.4);ctx.restore();if(chance(.3))inkCircle(0,-h-2,3,'#fbf8f1',.5)}
function adobe(primary){const w=rnd(64,96),h=rnd(36,50),col=pick(['#e2a46a','#d98d5f','#e6c08a','#d7a35a','#e59a8f']);const p=[[-w/2,0],[w/2,0],[w/2,-h+4],[w/2-4,-h],[-w/2+4,-h],[-w/2,-h+4]];inkPoly(p,col,.85,LW);
  for(let i=0;i<4;i++){const x=-w/2+10+i*(w-20)/3;inkPoly(rectPoly(x-3,-h+6,6,4),'#8a5a3c',.95,LW*.4,.1)}
  if(chance(.5)){const w2=w*.5;inkPoly([[-w2/2,-h],[w2/2,-h],[w2/2,-h-24],[-w2/2,-h-24]],col,.85,LW*.9);inkRect(-6,-h-18,12,10,LW*.6);lit(-5,-h-17,10,8)}
  inkPoly(rectPoly(rnd(-w*.3,0),-24,12,24),pick(['#5f8fd8','#7fb0e6','#3b3f6e']),.92,LW*.7,.2);for(const x of[w*.22,-w*.38]){inkRect(x-5,-h+16,10,10,LW*.6);lit(x-4,-h+17,8,8)}
  if(chance(.5)){const cx=w*.3;inkPoly(rectPoly(cx-4,-h-12,8,12),col,.9,LW*.6,.2);if(primary&&chance(.4))smokeAt(cx,-h-12)}if(chance(.4)){for(let i=0;i<3;i++)inkCircle(-w/2+8+i*5,-h+10+i*2,2,'#c8553d',.4)}}
function diner(){const w=rnd(120,140),h=44;const p=[[-w/2,0],[w/2,0],[w/2,-h],[-w/2+10,-h],[-w/2,-h+10]];inkPoly(p,'#d9dde6',.85,LW);inkPoly(rectPoly(-w/2,-16,w,6),'#c8553d',.92,LW*.6,.2);
  for(let i=0;i<5;i++){const x=-w/2+12+i*(w-24)/5;ctx.fillStyle='rgba(40,40,50,.4)';ctx.fillRect(x,-h+8,16,14);inkRect(x,-h+8,16,14,LW*.6);lit(x+1,-h+9,14,12);lit(x+1,-h+9,14,12)}
  seg(w/2+20,0,w/2+20,-110,LW*1.1);inkPoly(rectPoly(w/2-6,-150,52,40),'#f3efe6',.95,LW*.8,.2);inkText('DINER',w/2+20,-124,15,'#c8553d');inkRect(w/2-2,-146,44,32,LW*.5);glowAt(w/2+20,-130,60,'255,120,110',.75);
  ctx.save();ctx.translate(w/2+20,-158);ctx.beginPath();for(let i=0;i<10;i++){const a=i/10*6.283-Math.PI/2,r=i%2?5:11;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fillStyle='#e9b949';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.6;ctx.stroke();ctx.restore();glowAt(w/2+20,-158,24,'255,220,120',.8)}
function gasStation(){const w=130;seg(-w/2+10,0,-w/2+10,-62,LW);seg(w/2-10,0,w/2-10,-62,LW);inkPoly(rectPoly(-w/2,-74,w,12),'#c8553d',.92,LW*.8);inkPoly(rectPoly(-w/2,-62,w,4),'#f3efe6',.95,LW*.5,.1);
  for(const x of[-18,18]){inkPoly(rectPoly(x-8,-30,16,30),'#e9b949',.92,LW*.7);inkRect(x-5,-25,10,8,LW*.4);lit(x-4,-24,8,6)}if(LCTX){glowAt(0,-56,70,'255,230,170',.55)}
  inkPoly(rectPoly(w/2+6,-40,50,40),'#f3efe6',.85,LW);inkRect(w/2+14,-30,14,12,LW*.6);lit(w/2+15,-29,12,10);inkText('GAS',w/2+31,-44+0,11);
  seg(-w/2-24,0,-w/2-24,-96,LW);inkCircle(-w/2-24,-110,15,'#fbf8f1',LW*.8);inkText(pick(['GAS','FUEL']),-w/2-24,-106,10,'#c8553d');glowAt(-w/2-24,-110,30,'255,200,140',.6)}
function motel(){const w=rnd(160,190),h=40;inkPoly(rectPoly(-w/2,-h,w,h),'#f0b7a4',.85,LW);inkPoly(rectPoly(-w/2-4,-h-6,w+8,6),'#6e6a66',.9,LW*.7,.2);for(let i=0;i<6;i++){const x=-w/2+10+i*(w-20)/6;inkRect(x,-28,10,28,LW*.6);inkRect(x+13,-28,9,9,LW*.5);lit(x+14,-27,7,7)}
  seg(-w/2-20,0,-w/2-20,-120,LW*1.1);inkPoly([[-w/2-48,-170],[-w/2+8,-170],[-w/2+8,-124],[-w/2-48,-124]],'#3b3f6e',.92,LW*.8);inkText('MOTEL',-w/2-20,-142,14,'#f6d77a');inkText('vacancy',-w/2-20,-129,10,'#f08a4b');glowAt(-w/2-20,-146,60,'255,140,120',.7)}
function mission(){const w=rnd(90,110),h=rnd(52,60);inkPoly([[-w/2,0],[w/2,0],[w/2,-h],[w*.2,-h],[0,-h-22],[-w*.2,-h],[-w/2,-h]],'#efe4d2',.85,LW);ctx.beginPath();ctx.arc(0,-h+2,6,0,7);ctx.fillStyle='#8a5a3c';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(-9,-22);ctx.arc(0,-22,9,Math.PI,0);ctx.lineTo(9,0);ctx.fillStyle='#8a5a3c';ctx.fill();ctx.stroke();seg(0,-h-22,0,-h-36,LW*.7);seg(-5,-h-31,5,-h-31,LW*.7);for(const x of[-w*.34,w*.34]){inkRect(x-4,-h+16,8,14,LW*.6);lit(x-3,-h+17,6,12)}}
function waterPump(primary){farmWindmill(primary)}
function joshua(){const h=rnd(60,90);inkLine([[0,0],[rnd(-4,4),-h*.6]],LW*2.2,'#8a6a4c');inkLine([[0,0],[rnd(-4,4),-h*.6]],LW*.6);const tops=[[-h*.3,-h],[h*.25,-h*.9],[0,-h*.75]];for(const[x,y]of tops){inkLine([[0,-h*.55],[x,y]],LW*1.6,'#8a6a4c');ctx.save();ctx.translate(x,y);for(let k=0;k<9;k++){const a=-Math.PI/2+(k-4)*.32;seg(0,0,Math.cos(a)*10,Math.sin(a)*10,LW*.7)}ctx.restore()}}
function ocotillo(){const n=7;for(let i=0;i<n;i++){const a=(i-3)*.14,h=rnd(50,80);inkLine([[0,0],[Math.sin(a)*h*.5,-h*.5],[Math.sin(a)*h,-h]],LW*.7);if(chance(.6))inkCircle(Math.sin(a)*h,-h,2.4,'#c8553d',.4)}}
function buildDesertMain(seed){const{outerR,c,lc}=mainSetup(seed,91);
  // striped mesas and buttes like the mountain's peaks
  const MC=[['#d46f35','#e39a3b','#c9744a','#e59a8f'],['#e39a3b','#d98d5f','#f0c25a'],['#c9744a','#e59a8f','#d46f35','#e6c08a'],['#e59a8f','#d98d5f','#b5576b']];
  const ms=[];let x=-150;while(x<L){const w=rnd(260,520);ms.push({x,w,h:rnd(110,250),cols:pick(MC),s:Math.floor(R()*1e9)});x+=w*rnd(1.05,1.7)}
  const dm=(m,xx)=>{R=mulberry(m.s);nz=noise1();mesa(xx,m.w,m.h,m.cols.map(c=>mix(c,'#e9e3f0',.12)),G-30)};for(const m of ms){dm(m,m.x);if(m.x<B+200)dm(m,m.x+L);if(m.x+m.w>L-200)dm(m,m.x-L)}
  R=outerR;nz=noise1();
  const hy=hillBand([5,rnd(0,6),1,12,rnd(0,6),.45],G-24,14,'#e6c08a',.85);
  speckle(hy,[16,40],p=>{if(chance(.35))saguaro(rnd(14,26)*(.6+p.f));else{ctx.beginPath();ctx.arc(0,-3,rnd(2,4),0,7);ctx.fillStyle=hexA(pick(['#9fb38a','#b5b56d','#a3b77f']),.8);ctx.fill()}});
  R=outerR;nz=noise1();
  const forced=[[L*.1,'diner',220],[L*.3,'mission',130],[L*.5,'gas',230],[L*.72,'motel',240]];let fi=0;
  const kinds=[['saguaro',3.4],['adobe',3],['pump',.9],['rocks',1.2],['joshua',.9],['ocotillo',.9]];const tot=kinds.reduce((a,k)=>a+k[1],0);const W2={saguaro:40,adobe:110,pump:110,rocks:70,joshua:60,ocotillo:40};
  const items=sizedLayout(L,x=>{if(fi<forced.length&&x>forced[fi][0]){const f=forced[fi++];return{k:f[1],w:f[2],big:true}}let r=R()*tot,k='saguaro';for(const[kk,w]of kinds){if((r-=w)<0){k=kk;break}}return{k,w:W2[k]}},[]);
  wrapDraw(items,(it,xx,primary)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,G+1);LCTX=lc.getContext('2d');
    ({saguaro:()=>saguaro(),adobe:()=>adobe(primary),pump:()=>waterPump(primary),rocks,joshua,ocotillo,diner,mission,gas:gasStation,motel})[it.k]();LCTX=null;ctx.restore()},L);
  R=outerR;nz=noise1();const lanes=groundBands({shoulder:'rail',road:'asphalt',edge:'#e6c08a'});
  return{strip:blendSeam(c,L,B),lights:blendSeam(lc,L,B),cars:makeVehicles(seed,['pickup','rv','jeep','sedan','pickup','van'],lanes)}}
function buildDesertBack(seed){return genericBack(seed,101,(wrap)=>{const haze='#d6c6de';let x=-100;
  while(x<Lb){const w=rnd(200,480),h=rnd(160,360),tw=w*rnd(.4,.7),tl=w*rnd(.1,.4),col=mix(pick(['#e59a8f','#d98d5f','#c9744a','#b5576b']),haze,rnd(.45,.62));
    wrap(x,w,x0=>{backPoly([[x0,Gb],[x0+tl,Gb-h],[x0+tl+tw,Gb-h],[x0+w,Gb]],col,.2);ctx.fillStyle='rgba(255,255,255,.16)';for(let y=Gb-h+30;y<Gb-20;y+=46)ctx.fillRect(x0+tl*(1-(y-Gb+h)/h)+4,y,tw+(w-tw)*((y-Gb+h)/h)-8,12)});x+=w*rnd(.5,1)}},mix('#e6c08a','#d6c6de',.4))}
// desert foreground
function pricklyPear(){const pads=[[0,-14,12,15],[-12,-34,9,12],[12,-36,10,12],[2,-52,8,10]];const n=Math.round(rnd(2,4));for(let i=0;i<n;i++){const[x,y,rx,ry]=pads[i];inkPoly(blobPts(x,y,rx,ry,14,.08),pick(['#7f9468','#8fae7a','#9fb38a']),.92,LW*.7,.2);for(let k=0;k<4;k++){const a=rnd(0,6.28);seg(x+Math.cos(a)*rx*.5,y+Math.sin(a)*ry*.5,x+Math.cos(a)*rx*.5+2,y+Math.sin(a)*ry*.5-2,LW*.3)}}
  if(chance(.7))for(let k=0;k<3;k++)inkCircle(rnd(-8,14),-28-k*12,2.6,'#e59a8f',.4)}
function barrel(){const r=rnd(10,15);inkPoly(blobPts(0,-r,r,r*1.05,16,.04),'#8fae7a',.92,LW*.7,.2);for(let i=-2;i<=2;i++)inkLine([[i*r*.35,-1],[i*r*.42,-r],[i*r*.3,-r*1.9]],LW*.35);for(let k=0;k<4;k++)inkCircle(-6+k*4,-r*2+1,2.2,pick(['#e9b949','#c8553d']),.4)}
function skull(){const p=[[-10,-2],[10,-2],[12,-10],[6,-16],[-6,-16],[-12,-10]];inkPoly(p,'#fbf8f1',.95,LW*.7,.1);inkCircle(-4,-10,2,'#3b3a40',.4);inkCircle(4,-10,2,'#3b3a40',.4);inkLine([[-10,-14],[-22,-18],[-26,-26]],LW*.9);inkLine([[10,-14],[22,-18],[26,-26]],LW*.9)}
function wireFence(){const w=rnd(90,140);for(let x=-w/2;x<=w/2;x+=w/3)seg(x,0,x+rnd(-2,2),-34,LW*.9);for(const y of[-12,-22,-31]){seg(-w/2,y,w/2,y+rnd(-2,2),LW*.35);for(let x=-w/2+8;x<w/2;x+=14){seg(x-2,y-2,x+2,y+2,LW*.3);seg(x-2,y+2,x+2,y-2,LW*.3)}}}
function tumbleStatic(){ctx.save();ctx.translate(0,-14);for(let i=0;i<18;i++){const a=rnd(0,6.28),b=a+rnd(1,2.6),r=rnd(6,14);ctx.beginPath();ctx.arc(rnd(-2,2),rnd(-2,2),r,a,b);ctx.strokeStyle=i%3?'#8a6a4c':INK;ctx.lineWidth=LW*.45;ctx.stroke()}ctx.restore()}
function agave(){for(let i=0;i<9;i++){const a=-Math.PI/2+(i-4)*.32,h=rnd(18,30);inkPoly([[-3+i*.4-2,0],[Math.cos(a)*h,Math.sin(a)*h],[3+i*.4-2,0]],pick(['#9fb3a8','#8fae9a','#a9bfa4']),.92,LW*.5,.1)}}
function routeSign(){seg(0,0,0,-58,LW);inkPoly([[-14,-84],[14,-84],[14,-66],[0,-58],[-14,-66]],'#fbf8f1',.95,LW*.8,.1);inkText(pick(['66','89','93','191']),0,-68,12)}
function lizardRock(){rocks();ctx.save();ctx.translate(rnd(-10,10),-rnd(28,36));inkPoly([[-10,0],[8,-2],[12,0],[8,2]],'#7f9468',.95,LW*.4,.1);inkLine([[-10,0],[-22,-4]],LW*.5);ctx.restore()}
function cowboy(){person();inkPoly([[-14,-58],[14,-58],[7,-61],[6,-68],[-6,-68],[-7,-61]],'#8a5a3c',.95,LW*.6,.2)}
const DFKINDS=[['pricklyPear',2.4],['barrel',1.6],['saguaroS',1.4],['skull',.4],['wireFence',1.8],['tumbleStatic',.9],['agave',1.4],['boulder',1.4],['routeSign',.4],['lizardRock',.4],['ocotillo',.6]];
const DFFN={pricklyPear,barrel,saguaroS:()=>saguaro(rnd(46,80)),skull,wireFence,tumbleStatic,agave,boulder,routeSign,lizardRock,ocotillo,cowboy};

// ================= WOODS & LAKES =================
function mixedTreeTiny(p){if(chance(.62))pine(rnd(16,34)*(.6+.5*p.f),pick(MP.pine),LW*.55);else{const h=rnd(16,28)*(.6+.5*p.f),c=LEAF[season()]||['#a9a39a'];seg(0,0,0,-h*.4,LW*.5);const r=h*.32;ctx.beginPath();ctx.arc(0,-h+r,r,0,7);ctx.fillStyle=pick(c);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.45;ctx.stroke()}}
function boathouse(){const w=rnd(80,100),h=rnd(40,48);for(let x=-w/2+6;x<=w/2-6;x+=w/4-3)seg(x,0,x,-14,LW*.8);inkPoly(rectPoly(-w/2,-14-h,w,h),pick(['#c8553d','#b5835a','#7f9468']),.85,LW);
  inkPoly([[-w/2-6,-14-h],[w/2+6,-14-h],[0,-14-h-28]],'#6e6a66',.88,LW);ctx.beginPath();ctx.moveTo(-14,-14);ctx.lineTo(-14,-36);ctx.arc(0,-36,14,Math.PI,0);ctx.lineTo(14,-14);ctx.fillStyle='rgba(40,40,60,.55)';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.8;ctx.stroke();
  inkRect(-w/2+8,-14-h+8,10,10,LW*.6);lit(-w/2+9,-14-h+9,8,8);inkRect(w/2-18,-14-h+8,10,10,LW*.6);lit(w/2-17,-14-h+9,8,8)}
function island(){const w=rnd(90,140);const p=[];for(let i=0;i<=12;i++){const t=i/12;p.push([-w/2+t*w,-Math.sin(Math.PI*t)*rnd(12,18)])}inkPoly(p,'#9fb38a',.9,LW*.8,.4);
  for(let i=0;i<Math.round(rnd(2,4));i++){ctx.save();ctx.translate(rnd(-w*.3,w*.3),-8);pine(rnd(30,56),pick(MP.pine));ctx.restore()}}
function birchGrove(){const n=Math.round(rnd(3,5));const o=[];for(let i=0;i<n;i++)o.push({x:rnd(-36,36),h:rnd(60,110),y:rnd(-4,3)});o.sort((a,b)=>a.y-b.y);for(const t of o){ctx.save();ctx.translate(t.x,t.y);birch(t.h);ctx.restore()}}
function ranger(){inkPoly(rectPoly(-46,-44,92,44),'#7f9468',.85,LW);inkPoly([[-52,-44],[52,-44],[40,-64],[-40,-64]],'#6e5a4a',.88,LW);inkRect(-8,-26,16,26,LW*.7);for(const x of[-32,20]){inkRect(x,-34,12,12,LW*.6);lit(x+1,-33,10,10)}
  inkPoly(rectPoly(-30,-82,60,14),'#b5835a',.95,LW*.6,.2);inkText('RANGER',0,-71,11,'#fbf3df');seg(-24,-68,-24,-64,LW*.5);seg(24,-68,24,-64,LW*.5);seg(62,0,62,-100,LW*.8);inkPoly([[62,-100],[86,-94],[62,-88]],'#c8553d',.95,LW*.5,.2)}
function woodsTree(){roundTree(rnd(60,100))}
function buildWoodsMain(seed){const{outerR,c,lc}=mainSetup(seed,111);
  // three bands of forested hills, the far ones paler
  const lcx=lc.getContext('2d');
  const hy0=hillBand([3,rnd(0,6),1.2,8,rnd(0,6),.5],G-230,70,mix(MP.hill[0],'#e9e3f0',.35),.7);
  speckle(hy0,[8,16],p=>{pine(rnd(12,22)*(.6+.5*p.f),mix(pick(MP.pine),'#e9e3f0',.3),LW*.45)});R=outerR;nz=noise1();
  const hy1=hillBand([4,rnd(0,6),1.2,11,rnd(0,6),.5],G-110,46,MP.hill[1],.8);
  speckle(hy1,[8,18],mixedTreeTiny,lcx);R=outerR;nz=noise1();
  // lakes with islands and a boathouse
  const lakes=[];{let lx=rnd(200,400);for(let i=0;i<3;i++){const lw=rnd(620,820);lakes.push([lx,lx+lw]);lx+=lw+rnd(520,720)}while(lakes.length&&lakes[lakes.length-1][1]>L-140)lakes.pop()}LAKES=lakes.map(b=>({x0:b[0],x1:b[1]}));
  lakes.forEach((b,i)=>{R=mulberry(seed+400+i);nz=noise1();waterBody(b[0],b[1]-b[0],52,MP.lake,lcx);
    ctx.save();ctx.translate(b[0]+(b[1]-b[0])*rnd(.45,.7),G-20);island();ctx.restore();
    for(let k=0;k<4;k++){const x=b[0]+rnd(.1,.9)*(b[1]-b[0]);ctx.beginPath();ctx.ellipse(x,G-rnd(6,14),6,2,0,0,7);ctx.fillStyle='#7f9468';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=.8;ctx.stroke()}
    if(i===0){ctx.save();ctx.translate(b[0]+90,G+1);LCTX=lcx;boathouse();LCTX=null;ctx.restore()}
    else{const dk=b[0]+(b[1]-b[0])*rnd(.12,.25);inkPoly(rectPoly(dk,G-20,90,6),'#b5835a',.9,LW*.7,.3);for(let k=0;k<4;k++)seg(dk+8+k*26,G-14,dk+8+k*26,G-2,LW*.7);
      const cx0=dk+60,cy0=G-26,cn=[[cx0-26,cy0],[cx0+26,cy0],[cx0+18,cy0+7],[cx0-18,cy0+7]];inkPoly(cn,pick(['#c8553d','#e9b949','#7f9468']),.95,LW*.8,.3)}});
  R=outerR;nz=noise1();
  const skips=lakes.map(b=>[b[0]-20,b[1]+20]);const forced=[[L*.2,'ranger',150],[L*.5,'lodge',170]];let fi=0;
  const kinds=[['pines',5],['birch',2],['cabin',2.2],['tree',2],['rocks',.8]];const tot=kinds.reduce((a,k)=>a+k[1],0);const W2={pines:90,birch:80,cabin:100,tree:60,rocks:70};
  const items=sizedLayout(L,x=>{if(fi<forced.length&&x>forced[fi][0]){const f=forced[fi++];return{k:f[1],w:f[2],big:true}}let r=R()*tot,k='pines';for(const[kk,w]of kinds){if((r-=w)<0){k=kk;break}}return{k,w:W2[k]}},skips);
  wrapDraw(items,(it,xx,primary)=>{R=mulberry(it.s);nz=noise1();ctx.save();ctx.translate(xx,G+1);LCTX=lcx;
    ({pines:pineCluster,birch:birchGrove,cabin:()=>{if(chance(.45))aframe(primary);else cabin(primary,false)},tree:woodsTree,rocks,ranger,lodge:()=>cabin(primary,true)})[it.k]();LCTX=null;ctx.restore()},L);
  R=outerR;nz=noise1();const lanes=groundBands({shoulder:'verge',road:'gravel'});
  return{strip:blendSeam(c,L,B),lights:blendSeam(lc,L,B),cars:makeVehicles(seed,['canoe','pickup','jeep','wagon','van','canoe'],lanes)}}
function buildWoodsBack(seed){return genericBack(seed,121,(wrap)=>{for(const[y0,amp,col]of[[Gb-300,80,'#b9bcd8'],[Gb-190,60,'#a9b8c8']]){const k=[3,rnd(0,6),1,8,rnd(0,6),.5];const hy=x=>y0-amp*(Math.sin(x/Lb*Math.PI*2*k[0]+k[1])*k[2]+Math.sin(x/Lb*Math.PI*2*k[3]+k[4])*k[5]);
    ctx.beginPath();ctx.moveTo(-100,Gb);for(let x=-100;x<=Lb+300;x+=18){const y=hy(x);ctx.lineTo(x,y);ctx.lineTo(x+9,y-rnd(14,26));}ctx.lineTo(Lb+300,Gb);ctx.closePath();ctx.fillStyle=col;ctx.fill()}},mix('#8fa66e','#cdc8de',.45))}
// woods foreground
function fern(){for(let i=0;i<5;i++){const a=-Math.PI/2+(i-2)*.42,h=rnd(22,34),ex=Math.cos(a)*h,ey=Math.sin(a)*h;inkLine([[0,0],[ex*.5,ey*.6],[ex,ey]],LW*.55);for(let k=1;k<6;k++){const t=k/6,px=ex*t,py=ey*t;seg(px,py,px-5,py-3,LW*.35);seg(px,py,px+5,py-3,LW*.35)}}}
function mushrooms(){const n=Math.round(rnd(2,4));for(let i=0;i<n;i++){const x=-n*6+i*12+rnd(-2,2),h=rnd(8,16),r=rnd(6,10);inkPoly(rectPoly(x-2.5,-h,5,h),'#fbf8f1',.95,LW*.5,.1);const cap=[];for(let k=0;k<=10;k++){const a=Math.PI+k/10*Math.PI;cap.push([x+Math.cos(a)*r,-h+Math.sin(a)*r*.8])}inkPoly(cap,pick(['#c8553d','#e39a3b','#b5835a']),.95,LW*.6,.1);for(let k=0;k<3;k++)inkCircle(x+rnd(-r*.5,r*.5),-h-rnd(2,r*.6),1.4,'#fbf8f1',.3)}}
function fallenLog(){const w=rnd(70,100);inkPoly(rectPoly(-w/2,-14,w,14),'#a8714a',.9,LW*.8,.3);ctx.beginPath();ctx.ellipse(w/2,-7,4,7,0,0,7);ctx.fillStyle='#e6c79c';ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=LW*.7;ctx.stroke();ctx.save();ctx.globalAlpha=.5;for(let i=0;i<5;i++){const x=rnd(-w/2+6,w/2-10);seg(x,-11,x+rnd(8,16),-10,LW*.35)}ctx.restore();for(let i=0;i<3;i++){ctx.save();ctx.translate(rnd(-w/3,w/3),-14);ctx.scale(.5,.5);fern();ctx.restore()}}
function canoeShore(){const cn=[[-38,-10],[38,-10],[30,-2],[-30,-2]];inkPoly(cn,pick(['#c8553d','#e9b949','#7f9468']),.95,LW*.8,.2);seg(-20,-10,24,-20,LW*.7);inkPoly([[24,-20],[32,-22],[30,-17]],'#b5835a',.95,LW*.5,.1)}
function fisherman(){person();seg(10,-30,52,-74,LW*.7);ctx.beginPath();ctx.moveTo(52,-74);ctx.quadraticCurveTo(62,-40,58,-4);ctx.strokeStyle='rgba(29,27,32,.5)';ctx.lineWidth=.8;ctx.stroke();inkPoly([[-10,-58],[10,-58],[7,-64],[-7,-64]],'#7f9468',.95,LW*.6,.1)}
function fox(){ctx.save();if(chance(.5))ctx.scale(-1,1);const bd=blobPts(0,-14,15,7,14,.05);inkPoly(bd,'#e39a3b',.95,LW*.7,.2);for(const lx of[-10,-6,7,11])seg(lx,-9,lx,0,LW*.6);inkPoly([[-14,-18],[-24,-20],[-30,-14],[-20,-10]],'#e39a3b',.95,LW*.6,.1);inkPoly([[-18,-20],[-20,-27],[-14,-20]],'#e39a3b',.95,LW*.5,.1);
  inkPoly([[13,-14],[30,-22],[36,-14],[22,-10]],'#e39a3b',.95,LW*.6,.1);inkPoly([[32,-19],[36,-14],[31,-13]],'#fbf8f1',.95,LW*.4,.1);inkCircle(-30,-14,1.2,'#1d1b20',.3);ctx.restore()}
function smallBirch(){birch(rnd(70,100))}
const WFKINDS=[['bigPine',2.6],['smallBirch',1.4],['fern',2],['mushrooms',.9],['fallenLog',.8],['stump',.8],['boulder',1.2],['flowers',1],['bush',1.2],['canoeShore',.35],['fox',.35],['trailSign',.3]];
const WFFN={bigPine,smallBirch,fern,mushrooms,fallenLog,stump,boulder,flowers,bush,canoeShore,fox,trailSign,fisherman,campsite};

// ---------- spinning windmills and the lighthouse beam (drawn live, under the foreground)
function stripXY(x,h){let dx=x-off;dx=((dx%L)+L*1.5)%L-L/2;const a=dx/Rg,r=Rg+h;return{x:CW/2+Math.sin(a)*r,y:GYc+Rg-Math.cos(a)*r,a,dx}}
function drawAnims(k,g,t,dark){if(!ANIMS.length)return;const T=t/1000;
  for(const an of ANIMS){const P=stripXY(an.x,an.top);if(Math.abs(P.dx)>CW*.8)continue;
    if(an.k==='wheel'){const r=an.r;k.save();k.translate(P.x,P.y);k.rotate(P.a+T*1.4);for(let i=0;i<14;i++){k.rotate(Math.PI*2/14);k.beginPath();k.moveTo(r*.3,-1.5);k.lineTo(r,-4.5);k.lineTo(r,3);k.lineTo(r*.3,1.5);k.closePath();k.fillStyle='#f3efe6';k.fill();k.strokeStyle=INKC;k.lineWidth=1;k.stroke()}
      k.beginPath();k.arc(0,0,r*.62,0,7);k.strokeStyle=INKC;k.lineWidth=1;k.stroke();k.beginPath();k.arc(0,0,4,0,7);k.fillStyle='#3b3a40';k.fill();k.restore()}
    else if(an.k==='sails'){const r=an.r;k.save();k.translate(P.x,P.y);k.rotate(P.a+T*.6);for(let i=0;i<4;i++){k.rotate(Math.PI/2);k.beginPath();k.moveTo(0,0);k.lineTo(r,0);k.strokeStyle=INKC;k.lineWidth=2;k.stroke();
        k.beginPath();k.rect(r*.18,1,r*.82,13);k.fillStyle='rgba(243,239,230,.92)';k.fill();k.strokeStyle=INKC;k.lineWidth=1.1;k.stroke();for(let j=1;j<6;j++){k.beginPath();k.moveTo(r*.18+j*r*.82/6,1);k.lineTo(r*.18+j*r*.82/6,14);k.lineWidth=.6;k.stroke()}}
      k.beginPath();k.arc(0,0,5,0,7);k.fillStyle='#3b3a40';k.fill();k.restore()}
    else if(an.k==='beam'&&dark){g.save();g.translate(P.x,P.y);g.rotate(P.a);const th=T*1.2,cth=Math.cos(th),len=60+420*Math.abs(cth),dir=cth>0?1:-1;
      const gl=g.createRadialGradient(0,0,2,0,0,46);gl.addColorStop(0,'rgba(255,240,190,.9)');gl.addColorStop(1,'rgba(255,240,190,0)');g.fillStyle=gl;g.fillRect(-50,-50,100,100);
      const gr=g.createLinearGradient(0,0,dir*len,0);gr.addColorStop(0,`rgba(255,240,190,${.5+.2*Math.abs(cth)})`);gr.addColorStop(1,'rgba(255,240,190,0)');g.fillStyle=gr;g.beginPath();g.moveTo(0,-4);g.lineTo(dir*len,-30);g.lineTo(dir*len,24);g.lineTo(0,4);g.closePath();g.fill();g.restore()}}}

// ---------- new moments for the new scenes
function nearLake(){let best=null,bd=1e9;for(const k of LAKES){const cx=(k.x0+k.x1)/2;let dx=cx-off;dx=((dx%L)+L*1.5)%L-L/2;const d=Math.abs(dx-CW*.15)-(k.x1-k.x0)/2;if(d<bd){bd=d;best=k}}return best&&bd<CW*.3?best:null}
function anyLake(){return nearLake()||LAKES[0]}
const evSeason=()=>season();
Object.assign(EVDEF,{
  sailboat:{name:'Sailboat',layer:'cars',dur:28,scenes:['coast'],w:m=>nearLake()&&!severe(m.kind)?2.4:0,
    init(e){e.lk=anyLake();e.dir=Math.random()<.5?1:-1;e.col=['#c8553d','#7fb0e6','#e9b949','#fbf8f1'][Math.floor(rr(0,4))];e.u0=rr(.1,.3)},
    draw(c,e,p,t){if(!e.lk)return;const k=e.lk,u=e.dir>0?e.u0+p*.6:1-e.u0-p*.6,P=stripXY(k.x0+(k.x1-k.x0)*u,18);if(Math.abs(P.dx)>CW*.8)return;const env=Math.min(1,p*8,(1-p)*8);c.save();c.globalAlpha=env;c.translate(P.x,P.y);c.rotate(P.a+Math.sin(t*1.4)*.04);c.scale(e.dir*1.2,1.2);
      c.beginPath();c.moveTo(-26,-4);c.lineTo(26,-4);c.lineTo(18,6);c.lineTo(-20,6);c.closePath();c.fillStyle='#f3efe6';c.fill();inkStroke(c,1.5);c.beginPath();c.moveTo(0,-4);c.lineTo(0,-62);inkStroke(c,1.6);
      c.beginPath();c.moveTo(3,-60);c.quadraticCurveTo(24,-30,26,-8);c.lineTo(3,-8);c.closePath();c.fillStyle=e.col;c.fill();inkStroke(c,1.3);c.beginPath();c.moveTo(-3,-54);c.lineTo(-22,-8);c.lineTo(-3,-8);c.closePath();c.fillStyle='#fbf8f1';c.fill();inkStroke(c,1.3);
      c.beginPath();c.moveTo(-34,8);c.quadraticCurveTo(-24,4,-14,8);c.moveTo(14,8);c.quadraticCurveTo(24,4,34,8);c.strokeStyle='rgba(29,27,32,.5)';c.lineWidth=1;c.stroke();c.restore()}},
  whale:{name:'Whale',layer:'cars',dur:10,scenes:['coast'],w:m=>nearLake()?1.4:0,
    init(e){e.lk=anyLake();e.u=rr(.35,.75);e.s=Math.random()<.5?1:-1},
    draw(c,e,p){if(!e.lk)return;const k=e.lk,P=stripXY(k.x0+(k.x1-k.x0)*e.u,14);if(Math.abs(P.dx)>CW*.8)return;c.save();c.translate(P.x,P.y);c.rotate(P.a);c.scale(e.s*1.3,1.3);
      c.beginPath();c.rect(-90,-80,180,80);c.clip();
      if(p<.55){const q=p/.55,rise=Math.sin(Math.PI*q)*16;c.beginPath();c.moveTo(-40+q*20,4);c.quadraticCurveTo(-10+q*20,-rise*1.4,30+q*20,4);c.closePath();c.fillStyle='#5f6b8a';c.fill();inkStroke(c,1.5);
        if(q>.25&&q<.8){const sq=(q-.25)/.55;c.globalAlpha=1-sq;for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(14+q*20,-rise);c.quadraticCurveTo(14+q*20+i*6,-rise-30*sq-10,14+q*20+i*12,-rise-24*sq);c.strokeStyle='#7fb0e6';c.lineWidth=2;c.stroke()}c.globalAlpha=1}}
      else{const q=(p-.55)/.45,up=Math.sin(Math.PI*q)*34;c.beginPath();c.moveTo(-4,4);c.lineTo(0,-up+8);c.quadraticCurveTo(-14,-up-2,-22,-up+2);c.quadraticCurveTo(-8,-up+4,0,-up+10);c.quadraticCurveTo(8,-up+4,22,-up+2);c.quadraticCurveTo(14,-up-2,0,-up+8);c.lineTo(4,4);c.closePath();c.fillStyle='#5f6b8a';c.fill();inkStroke(c,1.4)}
      c.beginPath();c.moveTo(-50,6);c.quadraticCurveTo(0,0,50,6);c.strokeStyle='rgba(29,27,32,.45)';c.lineWidth=1.1;c.stroke();c.restore()}},
  gulls:{name:'Seagulls',layer:'sky',dur:16,scenes:['coast'],w:m=>isDay(m)&&!severe(m.kind)?2:0,
    init(e){e.cx=rr(200,600);e.cy=GYc-rr(380,520);e.g=[0,1,2].map(i=>({r:rr(50,110),ph:rr(0,6),sp:rr(.5,.9)*(i%2?1:-1)}))},
    draw(c,e,p,t){const env=Math.min(1,p*6,(1-p)*6);c.globalAlpha=env;for(const g of e.g){const a=g.ph+t*g.sp,x=e.cx+Math.cos(a)*g.r+(p-.5)*260,y=e.cy+Math.sin(a)*g.r*.3;const fl=Math.sin(t*3+g.ph)*3;
      c.beginPath();c.moveTo(x-14,y-4+fl);c.quadraticCurveTo(x-6,y-8,x,y);c.quadraticCurveTo(x+6,y-8,x+14,y-4+fl);inkStroke(c,1.7)}c.globalAlpha=1}},
  cropDuster:{name:'Crop duster',layer:'sky',dur:14,scenes:['farm'],w:m=>isDay(m)&&!severe(m.kind)&&!isRain(m.kind)?2:0,
    init(e){e.s=Math.random()<.5?1:-1;e.y=GYc-rr(430,520)},
    draw(c,e,p,t){const s=e.s,x=s>0?-80+(CW+160)*p:CW+80-(CW+160)*p,y=e.y+Math.sin(p*6)*10;
      for(let i=0;i<14;i++){const q=i/14,px=x-s*(30+q*240),py=y+8+q*30;c.globalAlpha=(1-q)*.35;c.beginPath();c.arc(px,py,6+q*16,0,7);c.fillStyle='#f3efe6';c.fill();c.globalAlpha=1}
      c.save();c.translate(x,y);c.scale(s*1.3,1.3);c.beginPath();c.moveTo(-22,0);c.lineTo(18,-2);c.lineTo(22,2);c.lineTo(-20,4);c.closePath();c.fillStyle='#e9b949';c.fill();inkStroke(c,1.4);
      for(const yy of[-10,6]){c.beginPath();c.rect(-8,yy,18,3.5);c.fillStyle='#e9b949';c.fill();inkStroke(c,1.1)}c.beginPath();c.moveTo(-2,-7);c.lineTo(-2,6);c.moveTo(6,-7);c.lineTo(6,6);inkStroke(c,.8);
      c.beginPath();c.moveTo(-20,0);c.lineTo(-26,-9);c.lineTo(-20,-9);inkStroke(c,1.2);c.beginPath();c.ellipse(24,0,1.5,7*Math.abs(Math.sin(t*40)),0,0,7);inkStroke(c,1);c.restore()}},
  iceCream:{name:'Ice cream truck',layer:'cars',dur:30,scenes:['suburbs'],w:m=>isDay(m)&&!isRain(m.kind)&&!isSnow(m.kind)?2:0,
    init(e){e.dir=Math.random()<.5?1:-1;e.x0=off-e.dir*(CW*.55+60);e.v=e.dir*26},
    draw(c,e,p,t){const x=e.x0+e.v*p*30,P=stripXY(x,-(e.dir>0?40:62));if(Math.abs(P.dx)>CW*.8)return;c.save();c.translate(P.x,P.y);c.rotate(P.a);c.scale(e.dir*1.3,1.3);
      c.beginPath();c.moveTo(-34,-6);c.lineTo(30,-6);c.lineTo(30,-20);c.lineTo(20,-34);c.lineTo(-34,-34);c.closePath();c.fillStyle='#fbf3f0';c.fill();inkStroke(c,1.5);c.fillStyle='#f0b7a4';c.fillRect(-34,-16,64,5);
      c.beginPath();c.rect(-26,-30,22,12);c.fillStyle='rgba(40,40,60,.5)';c.fill();inkStroke(c,1);c.beginPath();c.rect(8,-30,10,9);inkStroke(c,1);
      c.beginPath();c.moveTo(-14,-34);c.lineTo(-8,-34);c.lineTo(-11,-46);c.closePath();c.fillStyle='#e6c08a';c.fill();inkStroke(c,1);c.beginPath();c.arc(-11,-36-12,6,0,7);c.fillStyle='#f0b7a4';c.fill();inkStroke(c,1);
      for(const wx of[-20,18]){c.beginPath();c.arc(wx,-5,6,0,7);c.fillStyle='#3b3a40';c.fill();inkStroke(c,1)}c.restore();
      for(let i=0;i<3;i++){const q=(t*.5+i/3)%1,nx=P.x+Math.sin(q*6+i)*14,ny=P.y-70-q*70;c.globalAlpha=1-q;c.fillStyle=INKC;c.font='700 20px '+HANDF;c.fillText(i%2?'♪':'♫',nx,ny);c.globalAlpha=1}}},
  kites:{name:'Kites',layer:'sky',dur:22,scenes:['suburbs','coast'],w:m=>isDay(m)&&clear(m)?1.6:0,
    init(e){e.k=[0,1].map(i=>({x:rr(180,620),y:GYc-rr(420,560),col:['#c8553d','#e9b949','#7fb0e6','#b5576b'][Math.floor(rr(0,4))],ph:rr(0,6)}))},
    draw(c,e,p,t){const env=Math.min(1,p*6,(1-p)*6);c.globalAlpha=env;for(const k of e.k){const x=k.x+Math.sin(t*.7+k.ph)*30+(p-.5)*80,y=k.y+Math.sin(t*1.1+k.ph)*12-p*30;
      c.beginPath();c.moveTo(x,y+26);c.quadraticCurveTo(x-60,y+200,x-120,GYc);c.strokeStyle='rgba(29,27,32,.4)';c.lineWidth=1;c.stroke();
      c.save();c.translate(x,y);c.rotate(Math.sin(t*1.3+k.ph)*.2);c.beginPath();c.moveTo(0,-26);c.lineTo(18,0);c.lineTo(0,26);c.lineTo(-18,0);c.closePath();c.fillStyle=k.col;c.fill();inkStroke(c,1.5);c.beginPath();c.moveTo(0,-26);c.lineTo(0,26);c.moveTo(-18,0);c.lineTo(18,0);inkStroke(c,.8);
      c.beginPath();c.moveTo(0,26);for(let i=1;i<=8;i++)c.lineTo(Math.sin(t*3+i)*8,26+i*9);inkStroke(c,1);for(let i=2;i<=8;i+=3){c.beginPath();c.moveTo(Math.sin(t*3+i)*8-4,26+i*9);c.lineTo(Math.sin(t*3+i)*8+4,26+i*9);c.strokeStyle=k.col;c.lineWidth=3;c.stroke()}c.restore()}c.globalAlpha=1}},
  tumbleweed:{name:'Tumbleweed',layer:'front',dur:9,scenes:['desert'],w:m=>severe(m.kind)?0:2.6,
    init(e){e.s=Math.random()<.5?1:-1;e.r=rr(20,28);e.seed=Math.random()*100},
    draw(c,e,p,t){const x=e.s>0?-60+(CW+120)*p:CW+60-(CW+120)*p,r0=Rg-FRONT+4,a=Math.asin(Math.max(-1,Math.min(1,(x-CW/2)/r0))),gy=GYc+Rg-Math.cos(a)*r0,b=Math.abs(Math.sin(p*Math.PI*5))*38;
      c.save();c.translate(x,gy-e.r-b);c.rotate(e.s*p*28);for(let i=0;i<22;i++){const a0=(i*2.39+e.seed)%6.28,r=e.r*(.4+.6*((i*.37+e.seed)%1));c.beginPath();c.arc(Math.cos(i)*3,Math.sin(i*1.3)*3,r,a0,a0+1.6+(i%3)*.5);c.strokeStyle=i%3?'#8a6a4c':INKC;c.lineWidth=1.3;c.stroke()}c.restore()}},
  dustDevil:{name:'Dust devil',layer:'cars',dur:12,scenes:['desert'],w:m=>isDay(m)&&!isRain(m.kind)&&!isSnow(m.kind)?1.4:0,
    init(e){e.x0=off+rr(-200,200);e.v=rr(-30,30)},
    draw(c,e,p,t){const P=stripXY(e.x0+e.v*p*12,-30);if(Math.abs(P.dx)>CW*.8)return;const env=Math.min(1,p*5,(1-p)*5);c.save();c.translate(P.x,P.y);c.rotate(P.a);c.globalAlpha=env;
      for(let i=0;i<16;i++){const q=i/16,y=-q*200,w=8+q*q*60,sx=Math.sin(t*2+q*5)*10*q;c.beginPath();c.ellipse(sx,y,w,4+q*6,0,(t*6+i)%6.28,(t*6+i)%6.28+4);c.strokeStyle=`rgba(110,80,52,${.85-q*.35})`;c.lineWidth=2;c.stroke()}
      c.fillStyle='rgba(243,226,196,.55)';c.beginPath();c.moveTo(-12,0);c.quadraticCurveTo(-60,-120,-70,-200);c.lineTo(70,-200);c.quadraticCurveTo(60,-120,12,0);c.closePath();c.fill();c.restore()}},
  fishJump:{name:'Fish jump',layer:'cars',dur:2.6,scenes:['woods'],w:m=>nearLake()?2.2:0,
    init(e){e.lk=anyLake();e.u=rr(.2,.8);e.s=Math.random()<.5?1:-1},
    draw(c,e,p){if(!e.lk)return;const k=e.lk,P=stripXY(k.x0+(k.x1-k.x0)*e.u,16);if(Math.abs(P.dx)>CW*.8)return;c.save();c.translate(P.x,P.y);c.rotate(P.a);c.scale(e.s*1.3,1.3);
      if(p<.6){const q=p/.6,x=-26+q*52,y=-Math.sin(Math.PI*q)*44;c.save();c.translate(x,y);c.rotate(-Math.cos(Math.PI*q)*.9);c.beginPath();c.ellipse(0,0,11,4.5,0,0,7);c.fillStyle='#a9b7c8';c.fill();inkStroke(c,1.3);c.beginPath();c.moveTo(-10,0);c.lineTo(-17,-5);c.lineTo(-17,5);c.closePath();c.fillStyle='#a9b7c8';c.fill();inkStroke(c,1.1);c.restore()}
      for(const[sx,t0]of[[-26,0],[26,.55]]){const q=(p-t0)/.45;if(q<0||q>1)continue;c.globalAlpha=1-q;c.beginPath();c.ellipse(sx,2,6+q*26,2+q*5,0,0,7);c.strokeStyle='#1d1b20';c.lineWidth=1.1;c.stroke();c.beginPath();c.ellipse(sx,2,3+q*14,1+q*3,0,0,7);c.stroke();c.globalAlpha=1}c.restore()}},
  canoeTrip:{name:'Canoe',layer:'cars',dur:26,scenes:[],w:m=>0,
    init(e){e.lk=anyLake();e.dir=Math.random()<.5?1:-1;e.col=['#c8553d','#e9b949','#7f9468'][Math.floor(rr(0,3))]},
    draw(c,e,p,t){if(!e.lk)return;const k=e.lk,u=e.dir>0?.08+p*.84:.92-p*.84,P=stripXY(k.x0+(k.x1-k.x0)*u,18);if(Math.abs(P.dx)>CW*.8)return;const env=Math.min(1,p*8,(1-p)*8);c.save();c.globalAlpha=env;c.translate(P.x,P.y);c.rotate(P.a);c.scale(e.dir*1.25,1.25);
      for(const px of[-12,12]){const sw=Math.sin(t*3+px)*.5;c.save();c.translate(px,-10);c.beginPath();c.moveTo(0,0);c.lineTo(0,-12);inkStroke(c,1.4);c.beginPath();c.arc(0,-16,4,0,7);c.fillStyle='#f3dcc6';c.fill();inkStroke(c,1.1);c.rotate(sw);c.beginPath();c.moveTo(-6,-14);c.lineTo(8,10);inkStroke(c,1.3);c.beginPath();c.ellipse(9,12,2,4,-.6,0,7);c.fillStyle='#b5835a';c.fill();inkStroke(c,1);c.restore()}
      c.beginPath();c.moveTo(-30,-8);c.lineTo(30,-8);c.lineTo(22,0);c.lineTo(-22,0);c.closePath();c.fillStyle=e.col;c.fill();inkStroke(c,1.4);c.beginPath();c.moveTo(-40,3);c.quadraticCurveTo(-30,0,-20,3);c.strokeStyle='rgba(29,27,32,.45)';c.lineWidth=1;c.stroke();c.restore()}},
  fireflies:{name:'Fireflies',layer:'top',dur:16,scenes:['woods','farm'],w:m=>isDark(m)&&!isRain(m.kind)&&!isSnow(m.kind)&&(evSeason()==='summer'||evSeason()==='spring')?2:0,
    init(e){e.f=[];for(let i=0;i<34;i++)e.f.push({x:rr(20,CW-20),y:GYc+rr(-200,160),ph:rr(0,6),sp:rr(.6,1.4)})},
    draw(c,e,p,t){const env=Math.min(1,p*5,(1-p)*5);for(const f of e.f){const b=Math.max(0,Math.sin(t*f.sp*2+f.ph));if(b<.2)continue;const x=f.x+Math.sin(t*.5+f.ph)*18,y=f.y+Math.cos(t*.4+f.ph)*10;
      const g=c.createRadialGradient(x,y,0,x,y,9);g.addColorStop(0,`rgba(230,255,150,${b*env})`);g.addColorStop(1,'rgba(230,255,150,0)');c.fillStyle=g;c.fillRect(x-9,y-9,18,18)}}},
});
EVDEF.train.scenes.push('farm','desert');EVDEF.eagle.scenes.push('desert','woods','coast');EVDEF.aurora.scenes.push('woods');
const BUILDERS={city:[buildCity,buildFront,buildBack],mountain:[buildMountainMain,buildMountainFront,buildMountainBack],
  coast:[buildCoastMain,s=>genericFront(s,131,CFKINDS,CFFN,'#e6cf9c',[['bonfire',.4,60]],beachgoer,.5),buildCoastBack],
  farm:[buildFarmMain,s=>genericFront(s,141,FMKINDS,FMFN,'#b4b06e',[],farmer),buildFarmBack],
  suburbs:[buildSuburbsMain,s=>genericFront(s,151,SFKINDS,SFFN,'#a9b77a',[],person),buildSuburbsBack],
  desert:[buildDesertMain,s=>genericFront(s,161,DFKINDS,DFFN,'#e3bf8c',[],cowboy,.5),buildDesertBack],
  woods:[buildWoodsMain,s=>genericFront(s,171,WFKINDS,WFFN,'#8fa66e',[['campsite',.45,110]],hiker),buildWoodsBack]};

function fillEv(){}
let drag=false,fling=0;
let citySeed=137724;
function makeBirds(){const out=[];for(let i=0;i<5;i++){const fr=[];for(let f=0;f<2;f++){const s=newCanvas(40,24);const x=s.getContext('2d');x.translate(20,12);
      const up=f?-7:3;x.beginPath();x.moveTo(-12,up);x.quadraticCurveTo(-5,-3,0,2);x.quadraticCurveTo(5,-3,12,up);x.strokeStyle='#1d1b20';x.lineWidth=1.8;x.lineCap='round';x.stroke();fr.push(s)}
    out.push({fr,x:Math.random()*900-50,y:Math.random()*400+300,v:12+Math.random()*16,ph:Math.random()*6,bob:Math.random()*6})}return out}
let SCENE=null;
function buildAll(){TOWER=null;SMOKE=[];EVS=[];CAMPS=[];ANIMS=[];LAKES=[];GONDOLA=null;const[bm,bf,bb]=BUILDERS[SCENE];const c=bm(citySeed),fr=bf(citySeed),bk=bb(citySeed);
  if(city){GLm.free(city.tex);GLl.free(city.ltex);GLf.free(front.tex);GLl.free(front.ltex);GLl.free(front.mask);GLm.free(backTex)}
  city={tex:GLm.tex(c.strip),ltex:GLl.tex(c.lights),cars:c.cars};front={tex:GLf.tex(fr.strip),ltex:GLl.tex(fr.lights),mask:GLl.tex(fr.strip),walkers:[]};backTex=GLm.tex(bk);fillEv()}
let built=null,ready=false;
// the scene drifts ~20 px a second, so it's drawn 30 times a second, not 60 (perf, Nov 2026)
const STEP=1/30-.004;let acc=0;
GLm=makeGL(glC);GLf=makeGL(glFC);GLl=makeGL(glLC);cloudSprites=makeClouds();birds=makeBirds();
return{
  // which scene: coast, farm, suburbs, desert, woods, mountain or city
  setScene(k){if(k===SCENE&&built)return;SCENE=k;buildAll();built=k;fling=0;if(ready)applyMood(true)},
  // the app's real sun (degrees), weather kind, place and clock
  setInput(o){Object.assign(INPUT,o);if(o.lat!=null)LOC={lat:o.lat,lon:o.lon};if(ready)applyMood(false)},
  resize(w,h){if(w===SIZE.w&&h===SIZE.h&&ready)return;SIZE={w,h};applyMood(true);ready=true},
  frame(dt,t){if(!ready||!built)return;acc+=Math.max(0,dt);if(acc<STEP)return;const d=Math.min(.1,acc);acc=0;frame(d,t)},
  scene(){return SCENE},
};
}
