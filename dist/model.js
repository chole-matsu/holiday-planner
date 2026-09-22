export const DEFAULT_CATEGORIES = [
  {id:'reading',name:'読書',icon:'📖',color:'sage'},
  {id:'walk',name:'散歩',icon:'🌿',color:'mint'},
  {id:'workout',name:'筋トレ',icon:'💪',color:'peach'},
  {id:'manga',name:'漫画制作',icon:'✏️',color:'lavender'},
  {id:'meal',name:'食事',icon:'🍽️',color:'sand'},
  {id:'game',name:'ゲーム',icon:'🎮',color:'blue'},
  {id:'rest',name:'休憩',icon:'☕',color:'rose'},
  {id:'sleep',name:'睡眠',icon:'🌙',color:'gray'}
];
export const COLORS = {sage:['#e8eedf','#61763e'],mint:['#dfefe7','#428167'],peach:['#fbe7d9','#b57040'],lavender:['#ede6f5','#8866a0'],sand:['#f5eed9','#9b813f'],blue:['#e1ecf6','#5c82a6'],rose:['#f6e4e4','#aa6a74'],gray:['#e9eaf0','#777d9a']};
export function localDate(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date=new Date(`${value}T12:00:00`);return Number.isFinite(+date)&&localDate(date)===value;}
export const SLOT_MINUTES=30;
export function timeLabel(slot){return `${String(Math.floor(slot/2)).padStart(2,'0')}:${slot%2?'30':'00'}`;}
export function durationLabel(slots){return slots%2?`${slots>1?Math.floor(slots/2)+'時間':''}30分`:`${slots/2}時間`;}
function validateRange(start,duration){if(!Number.isInteger(start)||!Number.isInteger(duration)||start<0||duration<1||start+duration>48)throw new Error('予定は30分以上、24:00までの範囲で指定してください');}
export function eventAt(day,slot){return Object.entries(day).find(([start,event])=>Number(start)<=slot&&slot<Number(start)+event.duration);}
export function freeRange(day,start,duration){return !Object.entries(day).some(([other,event])=>start<Number(other)+event.duration&&Number(other)<start+duration);}
export function putActivity(day,categoryId,target,source=null,duration=1){
  const next=structuredClone(day);
  if(source!==null){
    if(!Number.isInteger(source)||!day[source]||day[source].categoryId!==categoryId)throw new Error('移動元が見つかりません');
    duration=day[source].duration;
    if(source===target)return next;
    delete next[source];
  }
  validateRange(target,duration);
  if(next[target]?.duration===duration){
    const displaced=next[target];delete next[target];
    if(source!==null){
      if(!freeRange(next,source,duration)||target<source+duration&&source<target+duration)throw new Error('予定が重なります。空いている時間へ移動してください');
      next[source]=displaced;
    }
  }
  if(!freeRange(next,target,duration))throw new Error('予定が重なります。空いている時間を選んでください');
  next[target]={categoryId,duration};return next;
}
export function maxDuration(day,start){return Math.min(48,...Object.keys(day).map(Number).filter(slot=>slot>start))-start;}
// Insert at the requested time, cascading only the existing events it overlaps.
export function planActivity(day,categoryId,start,duration,source=null){
  validateRange(start,duration);
  if(source!==null&&(!Number.isInteger(source)||!day[source]))throw new Error('移動元が見つかりません');
  const next={[start]:{categoryId,duration}},changes=[];
  let end=start+duration;
  for(const [key,event] of Object.entries(day).sort((a,b)=>Number(a[0])-Number(b[0]))){
    const old=Number(key);if(old===source)continue;
    let target=old;
    if(old+event.duration>start&&old<end){target=end;changes.push({categoryId:event.categoryId,from:old,to:target,duration:event.duration});}
    if(target+event.duration>48)throw new Error('後倒しすると24:00を超えます。予定の開始時刻か長さを変更してください。');
    next[target]={...event};if(target>=start)end=target+event.duration;
  }
  return {day:next,changes};
}
export function resizeActivity(day,start,duration){
  if(!day[start])throw new Error('予定が見つかりません');validateRange(start,duration);
  if(duration>maxDuration(day,start))throw new Error('次の予定と重なるため延長できません');
  return {...day,[start]:{...day[start],duration}};
}
// Form edits are atomic: conflicting changes never replace another event.
export function editActivity(day,categoryId,start,duration,source=null){
  validateRange(start,duration);
  const next=structuredClone(day);
  if(source!==null){if(!Number.isInteger(source)||!next[source])throw new Error('編集する予定が見つかりません');delete next[source];}
  if(!freeRange(next,start,duration))throw new Error('他の予定と重なっています。開始時刻か長さを変更してください。');
  next[start]={categoryId,duration};return next;
}
export function parseState(raw){
  if(!raw)return {version:2,categories:structuredClone(DEFAULT_CATEGORIES),days:{},checkedByDate:{}};
  const state=JSON.parse(raw);
  if(![1,2].includes(state?.version)||!Array.isArray(state.categories)||!state.days||typeof state.days!=='object'||Array.isArray(state.days))throw new Error('保存データの形式が違います');
  const ids=new Set();
  for(const item of state.categories){if(!item||typeof item.id!=='string'||!/^[-\w]+$/.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>24||typeof item.icon!=='string'||item.icon.length>12||!Object.hasOwn(COLORS,item.color))throw new Error('カテゴリを読み込めません');ids.add(item.id);}
  for(const [date,day] of Object.entries(state.days)){
    if(!validDate(date)||!day||typeof day!=='object'||Array.isArray(day))throw new Error('日付を読み込めません');
    if(state.version===1){
      const migrated={};
      for(const [hour,id] of Object.entries(day)){if(!/^(?:[0-9]|1[0-9]|2[0-3])$/.test(hour)||!ids.has(id))throw new Error('予定を読み込めません');migrated[Number(hour)*2]={categoryId:id,duration:2};}
      state.days[date]=migrated;
    }else{
      const validated={};
      for(const [start,event] of Object.entries(day)){
        if(!/^(?:[0-9]|[1-3][0-9]|4[0-7])$/.test(start)||!event||!ids.has(event.categoryId))throw new Error('予定を読み込めません');
        validateRange(Number(start),event.duration);
        if(!freeRange(validated,Number(start),event.duration))throw new Error('保存された予定が重なっています');
        validated[start]=event;
      }
    }
  }
  for(const category of state.categories){
    if(category.defaultDuration!==undefined&&(!Number.isInteger(category.defaultDuration)||category.defaultDuration<1||category.defaultDuration>48))throw new Error('標準時間を読み込めません');
    if(category.items!==undefined&&(!Array.isArray(category.items)||category.items.some(item=>typeof item!=='string'||!item.trim())))throw new Error('持ち物を読み込めません');
  }
  if(state.checkedByDate===undefined)state.checkedByDate={};
  if(!state.checkedByDate||typeof state.checkedByDate!=='object'||Array.isArray(state.checkedByDate))throw new Error('チェック状態を読み込めません');
  for(const [date,items] of Object.entries(state.checkedByDate)){
    if(!validDate(date)||!Array.isArray(items)||items.some(item=>typeof item!=='string'||!item.trim()))throw new Error('チェック状態を読み込めません');
  }
  state.version=2;return state;
}

export function parseItems(text){return [...new Set(text.split(/\r?\n/).map(item=>item.trim()).filter(Boolean))];}
export function checklistForDay(categories,day,checked=[]){
  const items=new Map();
  for(const id of new Set(Object.entries(day).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,event])=>event.categoryId))){
    const category=categories.find(category=>category.id===id);if(!category)continue;
    for(const name of parseItems((category.items||[]).join('\n'))){
      if(!items.has(name))items.set(name,{name,categories:[],checked:checked.includes(name)});
      items.get(name).categories.push(category.name);
    }
  }
  return [...items.values()];
}
