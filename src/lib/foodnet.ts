// @ts-nocheck
// FoodNet: bộ chạy MobileNetV3 int8 bằng JS thuần (chép từ model-training/scripts/foodnet.js).
// FoodNet: tiny pure-JS runner for the int8 MobileNetV3 packed by export.py (no libraries, works offline / file://)
// Hermes có thể thiếu TextDecoder: tự giải mã UTF-8 phần đầu (JSON) của file mô hình
const utf8=b=>{let s='';for(let i=0;i<b.length;){const c=b[i++];if(c<128)s+=String.fromCharCode(c);else if(c<224)s+=String.fromCharCode((c&31)<<6|b[i++]&63);else if(c<240){s+=String.fromCharCode((c&15)<<12|(b[i++]&63)<<6|b[i++]&63);}else{const u=((c&7)<<18|(b[i++]&63)<<12|(b[i++]&63)<<6|b[i++]&63)-65536;s+=String.fromCharCode(55296+(u>>10),56320+(u&1023));}}return s;};
const FoodNet=(()=>{
  const hs=v=>v*Math.min(Math.max(v+3,0),6)/6, hsig=v=>Math.min(Math.max(v+3,0),6)/6;
  function load(bytes){
    const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),hl=dv.getUint32(0,true);
    const head=JSON.parse(utf8(bytes.subarray(4,4+hl)));
    let off=4+hl;off+=(4-off%4)%4;
    const F=new Float32Array(bytes.slice(off,off+head.nf*4).buffer),I=new Int8Array(bytes.buffer,bytes.byteOffset+off+head.nf*4,head.ni);
    const deq=(o,n)=>{const w=new Float32Array(o.cout*n);for(let c=0;c<o.cout;c++){const s=F[o.sc+c],b=c*n;for(let j=0;j<n;j++)w[b+j]=I[o.w+b+j]*s;}return w;};
    const bias=o=>F.subarray(o.b,o.b+o.cout);
    const prep=o=>{if(o.t==="conv"){o.W=deq(o,o.cin/o.g*o.k*o.k);o.B=bias(o);}
      else if(o.t==="fc"){o.W=deq(o,o.cin);o.B=bias(o);}
      else if(o.t==="se"){for(const f of[o.fc1,o.fc2]){f.W=deq(f,f.cin);f.B=bias(f);}}
      else if(o.t==="block")o.ops.forEach(prep);};
    head.ops.forEach(prep);return head;}
  function act(y,a){if(a==="hs")for(let i=0;i<y.length;i++)y[i]=hs(y[i]);else if(a==="relu")for(let i=0;i<y.length;i++){if(y[i]<0)y[i]=0;}else if(a==="hsig")for(let i=0;i<y.length;i++)y[i]=hsig(y[i]);}
  function conv(o,x,H,W){const{k,s,p,cin,cout,g}=o,Ho=Math.floor((H+2*p-k)/s)+1,Wo=Math.floor((W+2*p-k)/s)+1,HW=H*W,P=Ho*Wo,y=new Float32Array(cout*P),Wt=o.W;
    for(let c=0;c<cout;c++)y.fill(o.B[c],c*P,(c+1)*P);
    if(k===1&&s===1&&g===1){ // pointwise: y[co] += w * x[ci]
      for(let co=0;co<cout;co++){const yo=co*P,wo=co*cin;for(let ci=0;ci<cin;ci++){const w=Wt[wo+ci];if(w===0)continue;const xo=ci*HW;for(let q=0;q<P;q++)y[yo+q]+=w*x[xo+q];}}}
    else{const dw=g===cin&&g===cout,cpg=cin/g;
      for(let co=0;co<cout;co++){const yo=co*P;
        for(let cj=0;cj<cpg;cj++){const ci=dw?co:cj,xo=ci*HW,wb=(co*cpg+cj)*k*k;
          for(let ky=0;ky<k;ky++)for(let kx=0;kx<k;kx++){const w=Wt[wb+ky*k+kx];if(w===0)continue;
            for(let oy=0;oy<Ho;oy++){const iy=oy*s-p+ky;if(iy<0||iy>=H)continue;const xr=xo+iy*W,yr=yo+oy*Wo;
              for(let ox=0;ox<Wo;ox++){const ix=ox*s-p+kx;if(ix>=0&&ix<W)y[yr+ox]+=w*x[xr+ix];}}}}}}
    act(y,o.act);return{x:y,H:Ho,W:Wo};}
  function fc(f,v){const y=new Float32Array(f.cout);for(let o=0;o<f.cout;o++){let s=f.B[o];const b=o*f.cin;for(let i=0;i<f.cin;i++)s+=f.W[b+i]*v[i];y[o]=s;}act(y,f.act);return y;}
  function se(o,x,H,W){const C=o.fc1.cin,P=H*W,m=new Float32Array(C);for(let c=0;c<C;c++){let s=0;for(let q=c*P,e=q+P;q<e;q++)s+=x[q];m[c]=s/P;}
    const sc=fc(o.fc2,fc(o.fc1,m));for(let c=0;c<C;c++){const f=sc[c];for(let q=c*P,e=q+P;q<e;q++)x[q]*=f;}}
  // input: Float32Array 3*size*size (CHW, normalized). Returns probabilities. Yields to the UI between layers.
  async function run(net,input,yieldFn){let x=input,H=net.size,W=net.size,v=null;
    for(const o of net.ops){
      if(o.t==="conv")({x,H,W}=conv(o,x,H,W));
      else if(o.t==="block"){const inp=x,h0=H;for(const s of o.ops){if(s.t==="conv")({x,H,W}=conv(s,x,H,W));else se(s,x,H,W);}
        if(o.res&&h0===H)for(let i=0;i<x.length;i++)x[i]+=inp[i];}
      else if(o.t==="gap"){const P=H*W,C=x.length/P;v=new Float32Array(C);for(let c=0;c<C;c++){let s=0;for(let q=c*P,e=q+P;q<e;q++)s+=x[q];v[c]=s/P;}}
      else if(o.t==="fc")v=fc(o,v);
      if(yieldFn)await yieldFn();}
    const mx=Math.max(...v),e=Array.from(v,z=>Math.exp(z-mx)),S=e.reduce((a,b)=>a+b,0);return{logits:v,probs:e.map(z=>z/S)};}
  // RGBA pixels (size*size) -> normalized CHW
  function fromRGBA(net,px){const n=net.size*net.size,x=new Float32Array(3*n);
    for(let c=0;c<3;c++){const m=net.mean[c],s=net.std[c];for(let i=0;i<n;i++)x[c*n+i]=(px[i*4+c]/255-m)/s;}return x;}
  return{load,run,fromRGBA};
})();
export default FoodNet;
