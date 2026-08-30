import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = path.join(repoRoot, "apps/web/public/data");
const artifactPath = path.join(dataDir, "workspace-signals.json");
const configPath = path.join(repoRoot, "apps/worker/config/runtime-workspaces.json");
const userAgent = "TrendPulse/0.4E-finalize (https://github.com/kavie-cmyk/trend-pulse; personal private non-commercial prototype)";
const stopWords = new Set(["the","and","for","with","from","this","that","into","about","your","are","was","were","will","new","more","most","trend","trending","market","content","growth","opportunity","opportunities","discovery","va","và","cua","của","cho","voi","với","trong","tren","trên","mot","một","khong","không","la","là","co","có","duoc","được","tu","từ","den","đến","moi","mới"]);
const genericTopicTokens = new Set(["game","games","gaming","mobile","app","apps","vietnam","viet","nam","english","vietnamese"]);

function stableId(value) { return createHash("sha1").update(String(value)).digest("hex").slice(0,18); }
function clean(value) { return String(value ?? "").replace(/<[^>]*>/g," ").replace(/&[a-zA-Z0-9#]+;/g," ").replace(/\s+/g," ").trim(); }
function norm(value) { return clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}+#.-]+/gu," ").replace(/\s+/g," ").trim(); }
function tokens(value) { return new Set(norm(value).split(" ").map((token)=>token.replace(/^[#.+-]+|[#.+-]+$/g,"")).filter((token)=>token && !stopWords.has(token) && (token.length>=3 || ["ai","vr","xr","ar","3d"].includes(token)))); }
function within(value, days, now) { if (!value) return false; const date=new Date(value); if(Number.isNaN(date.getTime())) return false; const age=now.getTime()-date.getTime(); return age>=-86400000 && age<=days*86400000; }
function jaccard(a,b){ const at=tokens(a),bt=tokens(b); const shared=[...at].filter((x)=>bt.has(x)); const union=new Set([...at,...bt]); return union.size?shared.length/union.size:0; }

async function requestJson(endpoint){
  try{
    const response=await fetch(endpoint,{headers:{accept:"application/json","user-agent":userAgent},signal:AbortSignal.timeout(20000)});
    const text=await response.text();
    if(!response.ok){ const error=new Error(`HTTP ${response.status}: ${text.slice(0,160)}`); error.status=response.status; throw error; }
    return JSON.parse(text);
  }catch(error){
    if(error instanceof Error && Number(error.status)>=400 && Number(error.status)<500) throw error;
    const {stdout}=await execFileAsync("curl",["--fail-with-body","--location","--silent","--show-error","--retry","2","--connect-timeout","15","--max-time","45","--user-agent",userAgent,"--header","accept: application/json",endpoint],{maxBuffer:20*1024*1024});
    return JSON.parse(stdout);
  }
}

function topicalTerms(workspace){ return [...(workspace.queryTerms??[]),...(workspace.scope?.industries??[]),...(workspace.scope?.categories??[]),...(workspace.scope?.products??[])].map(clean).filter(Boolean); }
function conceptMatches(workspace,text){ const value=norm(text); return (workspace.concepts??[]).filter((concept)=>(concept.aliases??[]).some((alias)=>value.includes(norm(alias)))); }
function relevance(workspace,signal){
  const text=[signal.topic,...(signal.hashtags??[]),...(signal.entities??[]),signal.creator,signal.community].filter(Boolean).join(" ");
  const value=norm(text); const terms=topicalTerms(workspace);
  const phraseMatches=terms.filter((term)=>{const t=norm(term); return t.includes(" ") && t.length>=5 && value.includes(t);});
  const concepts=conceptMatches(workspace,text); const wt=tokens(terms.join(" ")); const st=tokens(text); const shared=[...st].filter((token)=>wt.has(token)); const distinctive=shared.filter((token)=>!genericTopicTokens.has(token));
  const specialist=["pocketgamer-rss","gamek-mobile-rss"].includes(signal.source?.sourceId) && (value.includes("game")||value.includes("mobile")||value.includes("di dong"));
  const strong=phraseMatches.length>0 || concepts.length>0 || (shared.length>=2 && distinctive.length>=1) || specialist;
  let score=phraseMatches.length*5+concepts.length*4+distinctive.length*1.8+Math.min(shared.length,4)*0.6+(specialist?2:0);
  return {strong,score:Math.round(score*10)/10,matchedPhrases:phraseMatches.slice(0,8),sharedTokens:shared.slice(0,12),distinctiveTokens:distinctive.slice(0,8),concepts:concepts.map((concept)=>concept.id)};
}
function annotate(workspace,signal,match,scope,query){ return {...signal,workspaceId:workspace.id,collectionScopeId:scope,workspaceRelevance:match,confidence:{...signal.confidence,basis:[...(signal.confidence?.basis??[]),`04E final relevance uses returned content only: ${match.matchedPhrases.length} phrase match(es), ${match.distinctiveTokens.length} distinctive token(s), ${match.concepts.length} concept match(es).`,...(query?[`Collection query provenance: ${query}; query text is not relevance evidence.`]:[])]}}; }

async function recoverLemmyV3(workspace,config,collectedAt){
  const base=String(config.instance??"https://lemmy.world").replace(/\/$/,""); const lookback=Number(config.lookbackDays)||30; const now=new Date(collectedAt); const signals=[]; const failures=[];
  for(const query of (workspace.queryTerms??[]).slice(0,6)){
    try{
      const endpoint=`${base}/api/v3/search?q=${encodeURIComponent(query)}&type_=Posts&sort=New&listing_type=All&limit=${Math.min(config.maxRecordsPerQuery??12,20)}`;
      const payload=await requestJson(endpoint); const posts=Array.isArray(payload?.posts)?payload.posts:[];
      for(const [index,view] of posts.entries()){
        const post=view?.post??{}; const title=clean(post?.name||post?.title); const publishedAt=post?.published||post?.published_at;
        if(!title || !within(publishedAt,lookback,now)) continue;
        const baseSignal={schemaVersion:"signal.v1",id:`workspace-lemmy-v3-${stableId(`${workspace.id}:${post?.id??title}`)}`,observedAt:collectedAt,publishedAt,collectedAt,normalizedAt:collectedAt,source:{sourceId:"lemmy-search",sourceName:"Lemmy public recent search",sourceType:"community",accessMode:"official-api",freshness:"near-live"},topic:title,entities:[],keywords:[],hashtags:[],creator:clean(view?.creator?.name)||undefined,community:clean(view?.community?.title||view?.community?.name||"Lemmy"),contentType:"workspace-community-post",metrics:{sourceRank:index+1,native:{score:Number(view?.counts?.score)||0,comments:Number(view?.counts?.comments)||0}},dynamics:{},confidence:{score:0.58,basis:["Direct public Lemmy v3 search fallback","Results are post-filtered to the configured recent time window"]},evidence:{sourceUrl:post?.ap_id||post?.url||`${base}/post/${post?.id}`,externalId:String(post?.id??title),reference:`Lemmy v3 recent workspace search · ${query}`}};
        const match=relevance(workspace,baseSignal); if(match.strong) signals.push(annotate(workspace,baseSignal,match,`${workspace.id}-lemmy-search`,query));
      }
    }catch(error){ failures.push({sourceId:"lemmy-search",query,error:error instanceof Error?error.message:String(error)}); }
  }
  return {signals,failures};
}

function dedupe(signals){ const out=[]; let count=0; for(const signal of signals){ const duplicate=out.find((existing)=>existing.source?.sourceId===signal.source?.sourceId && (existing.evidence?.externalId===signal.evidence?.externalId || jaccard(existing.topic,signal.topic)>=0.82)); if(duplicate){count+=1;continue;} out.push(signal);} return {signals:out,duplicates:count}; }
function weak(signals){ return [...signals].sort((a,b)=>(b.workspaceRelevance?.score??0)-(a.workspaceRelevance?.score??0)||new Date(b.publishedAt??0).getTime()-new Date(a.publishedAt??0).getTime()).slice(0,100).map((signal)=>({signalId:signal.id,topic:signal.topic,sourceId:signal.source?.sourceId,sourceName:signal.source?.sourceName,sourceType:signal.source?.sourceType,sourceNativeTrend:["source-native-social-trend","source-native-community-trend"].includes(signal.contentType),relevanceScore:signal.workspaceRelevance?.score??0,matchedPhrases:signal.workspaceRelevance?.matchedPhrases??[],concepts:signal.workspaceRelevance?.concepts??[],publishedAt:signal.publishedAt,evidenceUrl:signal.evidence?.sourceUrl})); }

function recalcPlan(workspace,entry,signals,extraFailures,extraDuplicateCount){
  const sourceIds=[...new Set(signals.map((s)=>s.source?.sourceId).filter(Boolean))]; const families=[...new Set(signals.map((s)=>s.source?.sourceType).filter(Boolean))]; const languages=[...new Set(signals.map((s)=>s.language).filter(Boolean))];
  const targetedGroups=[
    {id:"mastodon",present:sourceIds.includes("mastodon-tag-timeline")},
    {id:"lemmy",present:sourceIds.includes("lemmy-search")},
    {id:"stackexchange",present:sourceIds.some((id)=>String(id).startsWith("stackexchange-search-"))},
    {id:"github",present:sourceIds.includes("github-workspace-search")},
  ];
  const targetedIds=new Set(["mastodon-tag-timeline","lemmy-search","github-workspace-search",...sourceIds.filter((id)=>String(id).startsWith("stackexchange-search-"))]);
  const targetedCount=signals.filter((s)=>targetedIds.has(s.source?.sourceId)).length; const broadCount=signals.length-targetedCount;
  return {...entry.sourcePlan,methodologyVersion:"workspace-collection-04e.v3-finalized",attemptedTargetedSources:targetedGroups.length,successfulTargetedSources:targetedGroups.filter((g)=>g.present).length,activeSourceIds:sourceIds,activeSourceFamilies:families,languageEvidence:languages,broadRelevantCount:broadCount,targetedRelevantCount:targetedCount,preDedupeRelevantCount:signals.length+(entry.sourcePlan?.sameSourceDuplicateCount??0)+extraDuplicateCount,postDedupeRelevantCount:signals.length,sameSourceDuplicateCount:(entry.sourcePlan?.sameSourceDuplicateCount??0)+extraDuplicateCount,sourceDiversity:sourceIds.length,sourceFamilyDiversity:families.length,targetedFailureCount:extraFailures.length,coverage:{workspaceQueryExecuted:true,targetedSourceSuccess:targetedGroups.filter((g)=>g.present).length,hasSocial:families.includes("social"),hasCommunity:families.includes("community"),hasPublisher:families.includes("publisher")||families.includes("news"),hasLocalLanguageEvidence:(workspace.scope?.languages??[]).some((language)=>languages.some((value)=>norm(value).includes(norm(language))||norm(language).includes(norm(value))))},calibrationNotes:[...(entry.sourcePlan?.calibrationNotes??[]),"04E v3 filters stale publisher evidence, applies the configured GitHub quality floor, recovers Lemmy with a v3 fallback when v4 is unavailable, and recomputes diversity from the final signal set."]};
}

async function main(){
  const artifact=JSON.parse(await readFile(artifactPath,"utf8")); const registry=JSON.parse(await readFile(configPath,"utf8")); const now=new Date(); const collectedAt=now.toISOString(); const configById=new Map((registry.workspaces??[]).map((w)=>[w.id,w])); const workspaces=[];
  for(const entry of artifact.workspaces??[]){
    const workspace=configById.get(entry.workspace?.id); if(!workspace) continue; const githubMinStars=Number(workspace.collection?.targeted?.githubSearch?.minStars)||0;
    let signals=(entry.signals??[]).filter((signal)=>{
      if(signal.source?.sourceType==="publisher" && signal.publishedAt && !within(signal.publishedAt,30,now)) return false;
      if(signal.source?.sourceId==="github-workspace-search" && Number(signal.metrics?.native?.stars||0)<githubMinStars) return false;
      return true;
    });
    let failures=(entry.failures??[]).filter((failure)=>failure.sourceId!=="lemmy-search");
    const lemmyConfig=workspace.collection?.targeted?.lemmySearch;
    if(lemmyConfig?.enabled){ const recovered=await recoverLemmyV3(workspace,lemmyConfig,collectedAt); signals.push(...recovered.signals); failures.push(...recovered.failures); }
    const result=dedupe(signals); signals=result.signals; const sourcePlan=recalcPlan(workspace,entry,signals,failures,result.duplicates);
    workspaces.push({...entry,sourcePlan,weakSignals:weak(signals),signals,failures,finalization:{methodologyVersion:"workspace-collection-04e.v3-finalized",finalizedAt:collectedAt,notes:["Publisher evidence older than 30 days is excluded from the current trend snapshot.",`GitHub targeted repositories must satisfy stars >= ${githubMinStars}.`,"Lemmy v4 404 is recovered through a public v3 New-search fallback with local recency filtering.","Source and source-family diversity are recomputed from the final actual signal set."]}});
  }
  if(!workspaces.length) throw new Error("04E finalization found no runtime workspace.");
  const next={...artifact,collectedAt,workspaceCollectionMethodologyVersion:"workspace-collection-04e.v3-finalized",workspaces,notes:[...(artifact.notes??[]),"04E v3 finalization removes stale/low-quality evidence, recovers compatible Lemmy reads and recalculates coverage from the actual final signal set."]};
  await writeFile(artifactPath,`${JSON.stringify(next,null,2)}\n`,"utf8");
  console.log("04E final workspace signal quality gate complete.");
  for(const entry of workspaces) console.log(`- ${entry.workspace.name}: ${entry.signals.length} final relevant · ${entry.weakSignals.length} weak · ${entry.sourcePlan.sourceDiversity} actual sources · ${entry.sourcePlan.sourceFamilyDiversity} families · ${entry.sourcePlan.successfulTargetedSources}/${entry.sourcePlan.attemptedTargetedSources} targeted source classes with evidence · ${entry.failures.length} request failures`);
}

main().catch((error)=>{ console.error(error instanceof Error?error.stack:error); process.exit(1); });
