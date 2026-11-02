let P=null;
const T={
 en:{tagline:"Emergency profile",owner:"Owner? Edit this profile",alerts:"Medical alerts",allergic:"Allergic to",has:"Has",
  call:"Call",call911:"Call 911",sendLoc:"Text my location to contact",hospital:"Nearest hospital",speak:"Read aloud",
  guideH:"What to do",q1:"Is the person awake and breathing?",q2:"Are they wheezing or struggling to breathe?",
  yes:"Yes",no:"No",again:"Start over",
  r911:"Call 911 now and follow the dispatcher's instructions.",
  rInh:"Help them sit upright and stay calm. Find the rescue inhaler in their bag and help them use it. If there is no relief in a few minutes, call 911.",
  rStay:"Stay with them. Show this screen to medical staff when help arrives.",
  sample:"Sample steps. A doctor or the Red Cross must verify them before real use.",
  age:"years old",blood:"Blood type",meds:"Medications",updated:"Last updated",
  more:"More hotlines",h911:"Emergency: police, fire, medical",demo:"Demo profile with fictional data.",
  alertMsg:"Aidly alert: the bracelet was scanned and this person may need help."},
 fil:{tagline:"Impormasyong pang-emerhensiya",owner:"May-ari? I-edit ang profile",alerts:"Mga babala sa kalusugan",allergic:"May allergy sa",has:"May",
  call:"Tawagan si",call911:"Tawagan ang 911",sendLoc:"I-text ang lokasyon ko sa contact",hospital:"Pinakamalapit na ospital",speak:"Basahin nang malakas",
  guideH:"Ano ang gagawin",q1:"Gising ba at humihinga ang tao?",q2:"Humihingal ba o nahihirapang huminga?",
  yes:"Oo",no:"Hindi",again:"Ulitin",
  r911:"Tumawag agad sa 911 at sundin ang mga tagubilin ng dispatcher.",
  rInh:"Paupuin nang tuwid at pakalmahin. Hanapin ang inhaler sa bag at tulungan silang gamitin ito. Kung walang ginhawa sa loob ng ilang minuto, tumawag sa 911.",
  rStay:"Samahan sila. Ipakita ang screen na ito sa medical staff kapag dumating ang tulong.",
  sample:"Sample na hakbang. Dapat i-verify ng doktor o ng Red Cross bago gamitin.",
  age:"taong gulang",blood:"Uri ng dugo",meds:"Mga gamot",updated:"Huling na-update",
  more:"Iba pang hotline",h911:"Emerhensiya: pulis, bumbero, medikal",demo:"Demo na profile. Kathang-isip ang datos.",
  alertMsg:"Aidly alert: na-scan ang bracelet at maaaring kailangan ng tulong ng taong ito."}
};
const G={q1:{q:"q1",yes:"q2",no:"r911"},q2:{q:"q2",yes:"rInh",no:"rStay"}};
let lang="en",step="q1",spoken="";
const $=s=>document.querySelector(s), t=k=>T[lang][k];

const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const L=o=>(o&&(o[lang]||o.en))||"";
const telOf=p=>String(p).replace(/[^\d+]/g,"");

function render(){
  document.documentElement.lang=lang;
  document.querySelectorAll("[data-i18n]").forEach(e=>e.textContent=t(e.dataset.i18n));
  document.querySelectorAll("[data-lang]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.lang===lang));

  $("#name").textContent=P.name;
  $("#meta").textContent=[P.age?`${P.age} ${t("age")}`:"",P.blood&&P.blood!=="Unknown"?`${t("blood")} ${P.blood}`:""].filter(Boolean).join(". ");
  const cond=P.conditions.map(c=>L(c)).join(", "), alg=P.allergies.map(a=>L(a)).join(", ");
  const summary=[cond,alg?`${t("allergic")} ${alg}`:""].filter(Boolean).join(". ");
  $("#summary").textContent=summary;

  const items=[...P.allergies.map(a=>({h:`${t("allergic")} ${L(a)}`,n:L(a.note)})),
               ...P.conditions.map(c=>({h:`${t("has")} ${L(c)}`,n:L(c.note)}))];
  $("#alertList").innerHTML=items.map(i=>`<div class="alert"><strong>${esc(i.h)}</strong>${esc(i.n)}</div>`).join("");
  $(".alerts").hidden=!items.length;

  const c=P.contact, rel=L(c.rel);
  const b=$("#callContact");
  b.href="tel:"+telOf(c.phone);
  b.innerHTML=`${esc(t("call"))} ${esc(c.name)}${rel?` (${esc(rel)})`:""}<span>${esc(c.phone)}</span>`;

  $("#details").innerHTML=(P.meds.length?`<dt>${esc(t("meds"))}</dt><dd>${esc(P.meds.map(m=>L(m)).join(", "))}</dd>`:"")
    +`<dt>${esc(t("updated"))}</dt><dd>${esc(P.updated)}</dd>`;

  // The "What to do" steps are only written for asthma so far.
  const hasAsthma=P.conditions.some(c=>/asthma|hika/i.test(c.en+" "+(c.fil||"")));
  $("#guideBlock").hidden=!hasAsthma;

  spoken=`${P.name}. ${summary}. ${items.map(i=>i.h+". "+i.n).join(" ")}`;
  guide();
}

function guide(){
  const n=G[step], el=$("#guide");
  el.innerHTML=n
    ? `<p class="q">${t(n.q)}</p><div class="row"><button class="btn" data-go="${n.yes}">${t("yes")}</button><button class="btn" data-go="${n.no}">${t("no")}</button></div>`
    : `<p class="res${step==="r911"?" urgent":""}">${t(step)}</p>`
      +(step==="r911"?`<a class="btn sos" href="tel:911" style="margin-bottom:.75rem">${t("call911")}</a>`:"")
      +`<button class="btn quiet" data-go="q1">${t("again")}</button>`;
}

document.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]"); if(g){step=g.dataset.go;guide();return;}
  const l=e.target.closest("[data-lang]"); if(l){lang=l.dataset.lang;render();}
});

$("#speak").addEventListener("click",()=>{
  if(!("speechSynthesis" in window))return;
  if(speechSynthesis.speaking){speechSynthesis.cancel();return;}
  const u=new SpeechSynthesisUtterance(spoken);
  u.lang=lang==="fil"?"fil-PH":"en-PH";
  speechSynthesis.speak(u);
});

$("#loc").addEventListener("click",()=>{
  const send=link=>{
    const body=encodeURIComponent(`${t("alertMsg")} (${P.name})`+(link?` Location: ${link}`:""));
    location.href=`sms:${telOf(P.contact.phone)}?&body=${body}`;
  };
  if(!navigator.geolocation)return send("");
  navigator.geolocation.getCurrentPosition(
    p=>send(`https://maps.google.com/?q=${p.coords.latitude},${p.coords.longitude}`),
    ()=>send(""),{timeout:6000});
});

async function init(){
  const id=new URLSearchParams(location.search).get("id");
  $("#ownerA").href="edit.html"+(id?"?id="+encodeURIComponent(id):"");
  $("#ownerA").textContent=t("owner");
  $("#name").textContent="Loading…";
  try{
    const p=await backend.publicProfile(id);
    if(!validProfile(p)) return missing("This bracelet isn't set up yet","If it's yours, set it up with the code that came with it.",true);
    P=p; render();
    $("footer").hidden=!!id&&!backend.demo;          // the demo notice only shows on the sample profile
    $("#ownerLine").hidden=!(id||backend.demo);
  }catch(e){ missing("Could not load this profile","Check your internet connection and try again.",false); }
}
function missing(h,m,owner){
  $("#name").textContent=h; $("#meta").textContent=m;
  $("#summary").innerHTML='<a class="btn sos" href="tel:911">Call 911</a>';
  document.querySelectorAll(".alerts,.actions,section.block,footer").forEach(e=>e.hidden=true);
  $("#ownerLine").hidden=!owner;
}

init();
