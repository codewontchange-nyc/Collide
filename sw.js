if(!self.define){let e,i={};const n=(n,s)=>(n=new URL(n+".js",s).href,i[n]||new Promise(i=>{if("document"in self){const e=document.createElement("script");e.src=n,e.onload=i,document.head.appendChild(e)}else e=n,importScripts(n),i()}).then(()=>{let e=i[n];if(!e)throw new Error(`Module ${n} didn’t register its module`);return e}));self.define=(s,c)=>{const o=e||("document"in self?document.currentScript.src:"")||location.href;if(i[o])return;let r={};const a=e=>n(e,o),b={module:{uri:o},exports:r,require:a};i[o]=Promise.all(s.map(e=>b[e]||a(e))).then(e=>(c(...e),r))}}define(["./workbox-dcde9eb3"],function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"registerSW.js",revision:"p70livecore00000000000000000001"},{url:"index.html",revision:"p98-citydrop-adv-1"},{url:"assets/index-PjvP98.css",revision:null},{url:"assets/index-Dmb37nVp98.js",revision:null},{url:"apple-touch-icon.png",revision:"9dbe925a5737b3f016a10c8334fa6ef9"},{url:"logo.svg",revision:"171b08ea631f7c8768b3daa5d13011b8"},{url:"icons/icon-192.png",revision:"45feb314863ffb5e5d290be07abdf8bf"},{url:"icons/icon-512.png",revision:"1239abc56353ab61b1754d7c832c63ce"},{url:"icons/maskable-512.png",revision:"ae8d219a00a1e1f60fcc15dd0b2fb2a4"},{url:"manifest.webmanifest",revision:"c4e6368611ee8d716e9111fcd4851dea"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/index.html"))),e.registerRoute(/supabase\.co\/storage\/v1\/object\/public\/map\//,new e.CacheFirst({cacheName:"map-bg",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:2592e3})]}),"GET")});

self.addEventListener("activate",function(ev){ev.waitUntil(caches.delete("ed-media-v1"))});
self.addEventListener("fetch",function(ev){
 var u=ev.request.url;
 if(ev.request.method!=="GET"||u.indexOf("/storage/v1/object/public/")<0)return;
 ev.respondWith((async function(){
  try{
   var c=await caches.open("ed-media-v2");
   var hit=await c.match(u);
   var net=fetch(u,{mode:"cors"}).then(function(res){
    if(res&&res.ok){
     c.put(u,res.clone());
     c.keys().then(function(ks){if(ks.length>160)for(var i=0;i<ks.length-150;i++)c.delete(ks[i])})}
    return res}).catch(function(){return hit});
   return hit||net}
  catch(e){return fetch(ev.request)}
 })());
})

self.addEventListener("push",function(ev){
 var d={};try{d=ev.data?ev.data.json():{}}catch(e){}
 ev.waitUntil(self.registration.showNotification(d.title||"Collide",{
  body:d.body||"",tag:d.tag||"collide",renotify:true,
  icon:"/Collide/icons/icon-192.png",badge:"/Collide/icons/icon-192.png",
  data:{url:d.url||"/Collide/"}}));
});
self.addEventListener("notificationclick",function(ev){
 ev.notification.close();
 var u=(ev.notification.data&&ev.notification.data.url)||"/Collide/";
 ev.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(cs){
  for(var i=0;i<cs.length;i++){if(cs[i].url.indexOf("/Collide/")>=0){cs[i].focus();try{cs[i].navigate(u)}catch(e){}return}}
  return self.clients.openWindow(u)}));
});
