"use strict";exports.id=892,exports.ids=[892],exports.modules={2933:(e,r,t)=>{t.d(r,{Z:()=>s});/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,t(6557).Z)("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]])},3810:(e,r,t)=>{t.d(r,{Z:()=>s});/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=(0,t(6557).Z)("Copy",[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]])},2015:(e,r,t)=>{t.d(r,{g:()=>i});var s=t(326),a=t(7577),n=t(1223);let i=a.forwardRef(({className:e,...r},t)=>s.jsx("textarea",{className:(0,n.cn)("flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono",e),ref:t,...r}));i.displayName="Textarea"},9826:(e,r,t)=>{t.d(r,{a:()=>n});var s=t(6053);t(1092);let a=["https:","mailto:"];function n(e){if(!e)return"";try{return s.TU.parse(e,{async:!1}).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"").replace(/on\w+="[^"]*"/gi,"").replace(/on\w+='[^']*'/gi,"")}catch(e){return console.error("Markdown render error:",e),"<p>Error rendering content</p>"}}s.TU.use({renderer:{link(e,r,t){if(!function(e){if(e.startsWith("/")||e.startsWith("#"))return!0;try{let r=new URL(e);return a.includes(r.protocol)}catch{return!1}}(e))return t;let s=r?` title="${r}"`:"",n=e.startsWith("/")||e.startsWith("#")?"":' rel="nofollow noopener noreferrer" target="_blank"';return`<a href="${e}"${s}${n}>${t}</a>`}},gfm:!0,breaks:!1})},9892:(e,r,t)=>{t.r(r),t.d(r,{MarkdownPreview:()=>p});var s=t(326),a=t(7577),n=t(1664),i=t(2015),l=t(9752),o=t(2933),c=t(3810),d=t(1223),u=t(9826);function p(){let[e,r]=(0,a.useState)(""),[t,p]=(0,a.useState)(!1),m=(0,a.useMemo)(()=>e?(0,u.a)(e):"",[e]),h=async()=>{m&&await (0,d.vQ)(m)&&(p(!0),setTimeout(()=>p(!1),2e3))};return s.jsx("div",{className:"space-y-6",children:(0,s.jsxs)("div",{className:"grid gap-6 lg:grid-cols-2",children:[(0,s.jsxs)(l.Zb,{children:[(0,s.jsxs)(l.Ol,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[s.jsx(l.ll,{className:"text-base font-medium",children:"Markdown Input"}),s.jsx(n.Button,{variant:"ghost",size:"sm",onClick:()=>{r(`# Heading 1

## Heading 2

This is a paragraph with **bold** and *italic* text.

### Lists

- Item 1
- Item 2
  - Nested item
- Item 3

### Code

Inline \`code\` and code block:

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### Links and Images

[Visit DevSolve](/)

### Blockquote

> This is a blockquote.
> It can span multiple lines.

### Table

| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |
`)},children:"Load Sample"})]}),s.jsx(l.aY,{children:s.jsx(i.g,{placeholder:"Enter Markdown here...",value:e,onChange:e=>r(e.target.value),className:"min-h-[400px] font-mono text-sm","aria-label":"Markdown input"})})]}),(0,s.jsxs)(l.Zb,{children:[(0,s.jsxs)(l.Ol,{className:"flex flex-row items-center justify-between space-y-0 pb-2",children:[s.jsx(l.ll,{className:"text-base font-medium",children:"Preview"}),s.jsx(n.Button,{variant:"ghost",size:"sm",onClick:h,disabled:!m,children:t?s.jsx(o.Z,{className:"h-4 w-4"}):s.jsx(c.Z,{className:"h-4 w-4"})})]}),s.jsx(l.aY,{children:s.jsx("div",{className:"prose prose-sm dark:prose-invert max-w-none min-h-[400px] p-4 rounded-md border bg-background overflow-auto",dangerouslySetInnerHTML:{__html:m||'<p class="text-muted-foreground">Preview will appear here...</p>'}})})]})]})})}}};