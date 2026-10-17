const BOOKMARKLET_TITLE = "Save to OvenLovin";

/**
 * Bookmarklet that sends the current page's JSON-LD Recipe, or the page HTML,
 * to a same-origin OvenLovin capture page. That GET keeps SameSite=Lax session
 * cookies, and the capture page POSTs to the authenticated import endpoint.
 */
export function buildImportBookmarklet(origin: string): string {
  const host = origin.replace(/\/$/, "");
  const source = `(function(){
var o=${JSON.stringify(host)};
function walk(n){
  if(!n||typeof n!=="object")return null;
  if(Array.isArray(n)){for(var i=0;i<n.length;i++){var f=walk(n[i]);if(f)return f;}return null;}
  var t=n["@type"];
  if(t==="Recipe"||(Array.isArray(t)&&t.indexOf("Recipe")>=0))return n;
  if(n["@graph"])return walk(n["@graph"]);
  return null;
}
var payload={url:location.href};
var scripts=document.querySelectorAll('script[type="application/ld+json"]');
for(var s=0;s<scripts.length;s++){
  try{var found=walk(JSON.parse(scripts[s].textContent||""));if(found){payload.jsonLd=found;break;}}catch(e){}
}
if(!payload.jsonLd)payload.html=document.documentElement.outerHTML;
location.href=o+"/recipes/import/capture#"+encodeURIComponent(JSON.stringify(payload));
})();`;
  return `javascript:${encodeURIComponent(source)}`;
}

export function importBookmarkletTitle(): string {
  return BOOKMARKLET_TITLE;
}
