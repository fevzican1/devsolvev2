"use strict";exports.id=375,exports.ids=[375],exports.modules={3251:(e,s,i)=>{i.d(s,{Z:()=>a});/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,i(6557).Z)("AlertCircle",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]])},2933:(e,s,i)=>{i.d(s,{Z:()=>a});/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,i(6557).Z)("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]])},3810:(e,s,i)=>{i.d(s,{Z:()=>a});/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let a=(0,i(6557).Z)("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]])},2015:(e,s,i)=>{i.d(s,{g:()=>r});var a=i(326),t=i(7577),l=i(1223);let r=t.forwardRef(({className:e,...s},i)=>a.jsx("textarea",{className:(0,l.cn)("flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono",e),ref:i,...s}));r.displayName="Textarea"},4375:(e,s,i)=>{i.r(s),i.d(s,{CssMinifier:()=>u});var a=i(326),t=i(7577),l=i(1664),r=i(2015),n=i(9752),o=i(8443),d=i(3251),c=i(2933),x=i(3810),m=i(1223);function u(){let[e,s]=(0,t.useState)(""),[i,u]=(0,t.useState)(""),[p,f]=(0,t.useState)(!1),[g,h]=(0,t.useState)(null),y=(0,t.useCallback)(()=>{if(!e.trim()){u(""),h(null);return}try{let s=e.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\s+/g," ").replace(/\s*{\s*/g,"{").replace(/\s*}\s*/g,"}").replace(/\s*;\s*/g,";").replace(/\s*:\s*/g,":").replace(/\s*,\s*/g,",").replace(/;}/g,"}").trim();u(s);let i=new Blob([e]).size,a=new Blob([s]).size,t=((i-a)/i*100).toFixed(1);h({original:i,minified:a,savings:parseFloat(t)})}catch(e){u(""),h(null)}},[e]),b=async()=>{i&&await (0,m.vQ)(i)&&(f(!0),setTimeout(()=>f(!1),2e3))};return(0,a.jsxs)("div",{className:"space-y-6",children:[a.jsx("div",{className:"rounded-lg border border-muted bg-muted/50 p-4",children:(0,a.jsxs)("div",{className:"flex items-start gap-3",children:[a.jsx(d.Z,{className:"h-5 w-5 text-muted-foreground mt-0.5"}),(0,a.jsxs)("div",{children:[a.jsx("p",{className:"font-medium",children:"Basic Minification"}),a.jsx("p",{className:"text-sm text-muted-foreground mt-1",children:"This tool performs basic CSS minification (removing whitespace and comments). It does not optimize selectors, merge rules, or handle all CSS3 features."})]})]})}),(0,a.jsxs)("div",{className:"grid gap-6 lg:grid-cols-2",children:[(0,a.jsxs)(n.Zb,{children:[(0,a.jsxs)(n.Ol,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[a.jsx(n.ll,{className:"text-base font-medium",children:"CSS Input"}),a.jsx(l.Button,{variant:"ghost",size:"sm",onClick:()=>{s(`.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  margin: 0 auto;
  max-width: 1200px;
}

/* Header styles */
.header {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  padding: 16px 24px;
}

.header .logo {
  font-size: 24px;
  font-weight: bold;
  color: #333333;
}

/* Button styles */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.button:hover {
  opacity: 0.9;
}`)},children:"Load Sample"})]}),(0,a.jsxs)(n.aY,{children:[a.jsx(r.g,{placeholder:"Paste your CSS here...",value:e,onChange:e=>s(e.target.value),className:"min-h-[300px] font-mono text-sm","aria-label":"CSS input"}),a.jsx(l.Button,{onClick:y,className:"mt-4",children:"Minify CSS"})]})]}),(0,a.jsxs)(n.Zb,{children:[(0,a.jsxs)(n.Ol,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[a.jsx(n.ll,{className:"text-base font-medium",children:"Minified Output"}),a.jsx(l.Button,{variant:"ghost",size:"sm",onClick:b,disabled:!i,children:p?a.jsx(c.Z,{className:"h-4 w-4"}):a.jsx(x.Z,{className:"h-4 w-4"})})]}),(0,a.jsxs)(n.aY,{children:[a.jsx(r.g,{value:i,readOnly:!0,className:"min-h-[300px] font-mono text-sm",placeholder:"Minified CSS will appear here...","aria-label":"Minified CSS output"}),g&&(0,a.jsxs)("div",{className:"flex flex-wrap gap-2 mt-4",children:[(0,a.jsxs)(o.C,{variant:"secondary",children:["Original: ",g.original," bytes"]}),(0,a.jsxs)(o.C,{variant:"secondary",children:["Minified: ",g.minified," bytes"]}),(0,a.jsxs)(o.C,{variant:"success",children:["Saved: ",g.savings,"%"]})]})]})]})]})]})}}};