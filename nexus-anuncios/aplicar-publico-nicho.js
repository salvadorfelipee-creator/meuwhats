// 18/11/2026: troca o público Advantage+ por público definido (cargo/formação/saúde E interesse luxo/spa/viagens/estética) nos conjuntos Odontologia e Harmonização.
// Uso: node --env-file=.env nexus-anuncios/aplicar-publico-nicho.js [--aplicar]  (sem a flag só estima o tamanho)
const T=process.env.NEXUS_ADS_TOKEN,B="https://graph.facebook.com/v21.0/",ACT="act_945463391448600";
const APPLY=process.argv.includes("--aplicar");
const geo={geo_locations:{regions:[{key:"459"}]},excluded_geo_locations:{cities:[{key:"243550"},{key:"245903"}]},publisher_platforms:["facebook","instagram"],targeting_automation:{advantage_audience:0}};
const ids=a=>a.map(id=>({id}));
const SAUDE=ids(["6012903159383"]);
const PROF_ODONTO={work_positions:ids(["108768179146852","108158462546495","168991743113816","117785311602404","200504049960954"]),education_majors:ids(["1598512447053454","108158462546495","102052789875593"]),industries:SAUDE};
const PROF_HARM={work_positions:ids(["176835319023033","849932375045036","613039548827558","143806268976956","108768179146852","168991743113816"]),education_majors:ids(["106103479421761","255204301335523","1598512447053454"]),industries:SAUDE};
const LUXO=["6007828099136","6003011087019","6003254590688","6003227641778","6003225930699"];
const ESTETICA=["6003062618007","6003088846792"]; // cosmetologia, salões de beleza
const ODONTO={...geo,age_min:28,age_max:60,flexible_spec:[PROF_ODONTO,{interests:ids(LUXO)}]};
const HARM={...geo,age_min:25,age_max:50,genders:[2],flexible_spec:[PROF_HARM,{interests:ids([...LUXO,...ESTETICA])}]};
async function est(nome,t){const u=B+ACT+"/delivery_estimate?optimization_goal=CONVERSATIONS&targeting_spec="+encodeURIComponent(JSON.stringify(t))+"&access_token="+T;const r=await (await fetch(u)).json();const d=r.data?.[0];console.log(nome,r.error?r.error.message:[d?.estimate_mau_lower_bound,d?.estimate_mau_upper_bound]);}
async function upd(id,t){const r=await (await fetch(B+id,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({targeting:JSON.stringify(t),access_token:T})})).json();console.log(id,JSON.stringify(r));}
(async()=>{
await est("odonto",ODONTO);await est("harm",HARM);
if(APPLY){await upd("120251081788760006",ODONTO);await upd("120251081792350006",HARM);}
})();
