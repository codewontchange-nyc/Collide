if('serviceWorker' in navigator){window.addEventListener('load',function(){
 navigator.serviceWorker.register('/Collide/sw.js',{scope:'/Collide/'}).then(function(r){
  setInterval(function(){try{r.update()}catch(e){}},15*60*1000);
 });
 var had=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',function(){
  if(!had){had=true;return}
  if(window.__edFreshLock)return;window.__edFreshLock=1;
  if(document.visibilityState==='hidden'){location.reload();return}
  if(window.__edFreshEdition)window.__edFreshEdition();else location.reload();
 });
});}
