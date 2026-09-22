import {COLORS,localDate,validDate,putActivity,parseState,parseItems,checklistForDay,timeLabel,durationLabel,eventAt,resizeActivity,maxDuration} from './model.js';
import {setupMobileUI} from './mobile-ui.js';
const $=selector=>document.querySelector(selector);
const STORAGE='holiday-planner-v1';
let state,storageBlocked=false,legacyBackup=null;
try{const raw=localStorage.getItem(STORAGE);state=parseState(raw);if(raw&&JSON.parse(raw).version===1)legacyBackup=raw;}catch{state=parseState(null);storageBlocked=true;}
let date=localDate(),selection=null,undo=null,drag=null,suppressClick=false,toastTimer;
let notificationsEnabled=false;
try{notificationsEnabled=localStorage.getItem(`${STORAGE}-notifications`)==='true';}catch{}
const delivered=new Set();
const dateInput=$('#date');dateInput.value=date;
const timeline=$('#timeline');
const categoryById=id=>state.categories.find(c=>c.id===id);
const day=()=>state.days[date]||{};
function say(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
function save(){
  if(storageBlocked){$('#save-status').textContent='保存できません・この画面のみの変更';return;}
  try{if(legacyBackup){if(!localStorage.getItem(`${STORAGE}-before-half-hour`))localStorage.setItem(`${STORAGE}-before-half-hour`,legacyBackup);legacyBackup=null;}localStorage.setItem(STORAGE,JSON.stringify(state));$('#save-status').textContent='✓ この端末に保存済み';}
  catch{$('#save-status').textContent='保存できません・空き容量を確認してください';say('予定を保存できませんでした。この画面を閉じると変更が失われます。');}
}
function snapshot(){undo={date,day:structuredClone(day())};}
function activityCard(category,sourceHour=null){
  const button=document.createElement('button');button.className='activity';button.type='button';button.dataset.category=category.id;
  if(sourceHour!==null)button.dataset.source=String(sourceHour);
  button.style.setProperty('--tint',COLORS[category.color][0]);button.style.setProperty('--accent',COLORS[category.color][1]);
  const length=sourceHour===null?1:day()[sourceHour].duration;
  button.setAttribute('aria-label',`${sourceHour===null?'':timeLabel(sourceHour)+'の'}${category.name}、${durationLabel(length)}。選択して時間枠に配置`);
  button.setAttribute('aria-pressed',String(selection?.id===category.id&&selection?.source===sourceHour));
  if(mobileUI.mobile()) {button.removeAttribute('aria-pressed');button.setAttribute('aria-label',sourceHour===null?`${category.name}の予定を追加`:`${timeLabel(sourceHour)}の${category.name}を編集`);}
  const icon=document.createElement('span');icon.className='activity-icon';icon.textContent=category.icon;icon.setAttribute('aria-hidden','true');
  const body=document.createElement('span');const label=document.createElement('span');label.className='activity-label';label.textContent=category.name;
  const duration=document.createElement('span');duration.className='activity-duration';duration.textContent=sourceHour===null?'30分':`${timeLabel(sourceHour)}–${timeLabel(sourceHour+length)} · ${durationLabel(length)}`;body.append(label,duration);
  const grip=document.createElement('span');grip.className='grip';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');button.append(icon,body,grip);
  return button;
}
function render(){
  const scroll=timeline.scrollTop;
  $('#resize-status').textContent='';
  $('#categories').replaceChildren(...state.categories.map(category=>{
    const wrapper=document.createElement('div');wrapper.className='category-with-items';wrapper.append(activityCard(category));
    const edit=document.createElement('button');edit.type='button';edit.className='items-edit';edit.dataset.editItems=category.id;
    edit.textContent=`持ち物メモ${category.items?.length?' · '+category.items.length:''}`;edit.setAttribute('aria-label',`${category.name}の持ち物メモを編集`);wrapper.append(edit);return wrapper;
  }));
  const formatted=new Date(`${date}T12:00:00`).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
  $('#schedule-title').textContent=formatted;
  const count=Object.values(day()).reduce((sum,event)=>sum+event.duration,0);$('#planned-count').textContent=`${durationLabel(count)}の予定`;$('#free-count').textContent=`自由な時間 ${durationLabel(48-count)}`;
  $('#undo').disabled=!undo;$('#cancel-selection').hidden=!selection;
  $('#selection').textContent=selection?`${categoryById(selection.id).name}を選択中。置きたい時間枠を選んでください。`:'カードを選んで、一日を組み立てよう。';
  timeline.replaceChildren();$('#day-strip').replaceChildren();
  const viewStart=mobileUI.visibleStart();timeline.style.gridTemplateRows=`repeat(${48-viewStart},68px)`;
  for(let start=0;start<48;start++){
    const occupying=eventAt(day(),start);
    const strip=document.createElement('span');if(occupying)strip.style.background=COLORS[categoryById(occupying[1].categoryId).color][1];$('#day-strip').append(strip);
    if(start<viewStart)continue;
    const actualStart=start===viewStart&&occupying?Number(occupying[0]):start;
    const entry=day()[actualStart];const category=categoryById(entry?.categoryId);
    const label=document.createElement('div');label.className='hour-label';label.dataset.hour=String(start);label.textContent=timeLabel(start);label.style.gridRow=String(start-viewStart+1);label.style.gridColumn='1';
    if(start%2)label.classList.add('half-hour');
    const now=new Date();if(date===localDate(now)&&start===now.getHours()*2+Math.floor(now.getMinutes()/30))label.classList.add('current');timeline.append(label);
    if(entry||!occupying){
      const slot=document.createElement('div');slot.className='slot';slot.dataset.hour=String(actualStart);slot.style.gridColumn='2';slot.style.gridRow=`${start-viewStart+1} / span ${entry?entry.duration-(start-actualStart):1}`;
      if(category){
        slot.classList.add('event-slot');slot.append(activityCard(category,actualStart));
        const move=document.createElement('button');move.type='button';move.className='move-handle';move.dataset.move=String(actualStart);move.textContent='⠿';move.setAttribute('aria-label',`${timeLabel(actualStart)}の${category.name}をドラッグして移動`);slot.append(move);
        const remove=document.createElement('button');remove.className='remove';remove.dataset.remove=String(actualStart);remove.textContent='×';remove.setAttribute('aria-label',`${timeLabel(actualStart)}の${category.name}を削除`);slot.append(remove);
        const resize=document.createElement('button');resize.type='button';resize.className='resize-handle';resize.dataset.resize=String(start);resize.textContent='↕';resize.setAttribute('aria-label',`${timeLabel(start)}の${category.name}の長さを変更`);resize.title='下端をドラッグして長さを変更（上下キーで30分ずつ）';resize.setAttribute('aria-describedby','resize-help');slot.append(resize);
      }else{const empty=document.createElement('button');empty.className='empty-slot';empty.dataset.target=String(start);empty.setAttribute('aria-label',`${timeLabel(start)}から${timeLabel(start+1)}に予定を置く`);const plus=document.createElement('span');plus.textContent='＋';empty.append(plus,document.createTextNode('ここに予定を置く'));slot.append(empty);}
      timeline.append(slot);
    }
  }
  timeline.scrollTop=scroll;
  renderChecklist();
}
function renderChecklist(){
  const items=checklistForDay(state.categories,day(),state.checkedByDate[date]||[]);
  $('#packing-count').textContent=`${items.filter(item=>item.checked).length} / ${items.length} 準備済み`;
  $('#packing-list').replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.className='packing-empty';empty.textContent=Object.keys(day()).length?'必要なものはまだありません。予定に使っているカテゴリの「持ち物メモ」に登録してください。':'予定を入れると、その日に必要なものがここに表示されます。';$('#packing-list').append(empty);return;}
  for(const item of items){
    const row=document.createElement('label');row.className='packing-item';row.classList.toggle('packed',item.checked);
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.checked;checkbox.dataset.itemName=item.name;checkbox.setAttribute('aria-label',`${item.name}を準備済みにする`);
    const body=document.createElement('span');const name=document.createElement('span');name.className='packing-name';name.textContent=item.name;
    const sources=document.createElement('span');sources.className='packing-sources';sources.textContent=item.categories.join('・');body.append(name,sources);row.append(checkbox,body);$('#packing-list').append(row);
  }
}
$('#packing-list').addEventListener('change',event=>{
  const checkbox=event.target.closest('[data-item-name]');if(!checkbox)return;
  const checked=new Set(state.checkedByDate[date]||[]);
  if(checkbox.checked)checked.add(checkbox.dataset.itemName);else checked.delete(checkbox.dataset.itemName);
  state.checkedByDate[date]=[...checked];save();checkbox.closest('.packing-item').classList.toggle('packed',checkbox.checked);
  const items=checklistForDay(state.categories,day(),state.checkedByDate[date]);$('#packing-count').textContent=`${items.filter(item=>item.checked).length} / ${items.length} 準備済み`;
});
const itemsDialog=$('#items-dialog');let editingCategory=null;
$('#items-cancel').addEventListener('click',()=>itemsDialog.close());
$('#items-form').addEventListener('submit',event=>{
  event.preventDefault();const category=categoryById(editingCategory);if(!category){itemsDialog.close();return;}
  category.items=parseItems($('#items-text').value);save();itemsDialog.close();render();
  document.querySelector(`[data-edit-items="${editingCategory}"]`)?.focus({preventScroll:true});say(`${category.name}の持ち物を保存しました`);
});
function place(id,start,source=null,duration=1){
  if(source===start)return true;
  let next;try{next=putActivity(day(),id,start,source,duration);}catch(error){say(error.message);return false;}
  const occupied=Boolean(day()[start]);snapshot();state.days[date]=next;selection=null;save();render();
  say(`${categoryById(id).name}を${timeLabel(start)}に${source===null?'配置':'移動'}しました${occupied?(source===null?'（元の予定を置き換え）':'（予定を入れ替え）'):''}`);return true;
}
function resize(start,duration){
  if(day()[start]?.duration===duration)return;
  let next;try{next=resizeActivity(day(),start,duration);}catch(error){say(error.message);return;}
  snapshot();state.days[date]=next;selection=null;save();render();timeline.querySelector(`[data-resize="${start}"]`)?.focus({preventScroll:true});say(`${timeLabel(start)}〜${timeLabel(start+duration)}（${durationLabel(duration)}）に変更しました`);
}
function select(id,source){selection=selection?.id===id&&selection?.source===source?null:{id,source};render();const cards=[...document.querySelectorAll('.activity')];cards.find(c=>c.dataset.category===id&&(source===null?!c.hasAttribute('data-source'):c.dataset.source===String(source)))?.focus({preventScroll:true});}
document.addEventListener('click',event=>{
  if(suppressClick){event.preventDefault();return;}
  if(event.target.closest('[data-move]')){say('移動ボタンを押したまま、移動先の時間へドラッグしてください');return;}
  const editItems=event.target.closest('[data-edit-items]');if(editItems){editingCategory=editItems.dataset.editItems;const category=categoryById(editingCategory);$('#items-title').textContent=`${category.name}の持ち物メモ`;$('#items-text').value=(category.items||[]).join('\n');mobileUI.openDialog(itemsDialog);if(!mobileUI.mobile())$('#items-text').focus();return;}
  const remove=event.target.closest('[data-remove]');if(remove){const hour=Number(remove.dataset.remove);snapshot();delete state.days[date][hour];selection=null;save();render();timeline.querySelector(`[data-target="${hour}"]`)?.focus({preventScroll:true});say('予定を削除しました');return;}
  const card=event.target.closest('.activity');if(card){const source=card.hasAttribute('data-source')?Number(card.dataset.source):null;if(mobileUI.mobile()||event.pointerType==='touch'){mobileUI.openEvent(source,card.dataset.category,source);return;}if(source!==null&&selection&&(selection.source!==source||selection.id!==card.dataset.category)){place(selection.id,source,selection.source);}else select(card.dataset.category,source);return;}
  const target=event.target.closest('[data-target]');if(target){if(mobileUI.mobile()||event.pointerType==='touch'||!selection)mobileUI.openEvent(Number(target.dataset.target));else place(selection.id,Number(target.dataset.target),selection.source);}
});
function endDrag(cancelled=false){
  if(!drag)return;const active=drag;drag=null;cancelAnimationFrame(active.frame);
  active.ghost?.remove();document.body.classList.remove('dragging','resizing');document.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));
  if(active.moved){suppressClick=true;setTimeout(()=>suppressClick=false,0);}
  if(active.mode==='resize'){
    if(!cancelled&&active.moved&&active.duration!==active.originalDuration)resize(active.source,active.duration);
    else render();
    timeline.querySelector(`[data-resize="${active.source}"]`)?.focus({preventScroll:true});return;
  }
  if(active.moved&&!cancelled&&active.target!==null)place(active.id,active.target,active.source);
}
function rowHeight(){return timeline.querySelector('.hour-label').getBoundingClientRect().height;}
function rowAtPoint(x,y){
  const rect=timeline.getBoundingClientRect();const first=timeline.querySelector('.hour-label').getBoundingClientRect();
  if(x<first.right||x>rect.right||y<rect.top||y>rect.bottom)return null;
  const slot=Number(timeline.querySelector('.hour-label').dataset.hour)+Math.floor((y-first.top)/rowHeight());return slot>=0&&slot<48?slot:null;
}
function updateDragTarget(){
  if(drag.mode==='resize'){
    const origin=timeline.querySelector('.hour-label').getBoundingClientRect().top;
    const delta=Math.round((drag.y-drag.startY-(origin-drag.originTop))/rowHeight());
    const requested=drag.originalDuration+delta;
    drag.duration=Math.max(1,Math.min(drag.limit,requested));
    drag.container.style.gridRowEnd=`span ${drag.duration}`;drag.container.classList.add('resize-preview');
    drag.container.querySelector('.activity-duration').textContent=`${timeLabel(drag.source)}–${timeLabel(drag.source+drag.duration)} · ${durationLabel(drag.duration)}`;
    $('#resize-status').textContent=`${timeLabel(drag.source)}〜${timeLabel(drag.source+drag.duration)}（${durationLabel(drag.duration)}）${requested>drag.limit?' · 次の予定または24:00まで':''}`;
    return;
  }
  const row=rowAtPoint(drag.x,drag.y);drag.target=row===null?null:row-drag.grabOffset;
  if(drag.target!==null&&(drag.target<0||drag.target>=48))drag.target=null;
  if(drag.ghost&&drag.target!==null){const duration=drag.source===null?1:day()[drag.source].duration;drag.ghost.querySelector('.activity-duration').textContent=`${timeLabel(drag.target)}–${timeLabel(drag.target+duration)} · ${durationLabel(duration)}`;}
  const slot=drag.target===null?null:timeline.querySelector(`.slot[data-hour="${eventAt(day(),drag.target)?.[0]??drag.target}"]`);
  document.querySelectorAll('.drop-target').forEach(el=>{if(el!==slot)el.classList.remove('drop-target');});slot?.classList.add('drop-target');
}
function trackDrag(){
  if(!drag?.moved)return;
  const rect=timeline.getBoundingClientRect();
  if(drag.x>=rect.left&&drag.x<=rect.right&&drag.y>rect.top-30&&drag.y<rect.bottom+30){if(drag.y<rect.top+60)timeline.scrollTop-=10;else if(drag.y>rect.bottom-60)timeline.scrollTop+=10;}
  const bottom=mobileUI.mobile()?document.querySelector('.mobile-nav').getBoundingClientRect().top:innerHeight;
  if(drag.y>bottom-60)window.scrollBy(0,10);else if(drag.y<(mobileUI.mobile()?150:60))window.scrollBy(0,-10);
  updateDragTarget();
  if(drag.ghost){drag.ghost.style.left=`${Math.min(drag.x+12,innerWidth-180)}px`;drag.ghost.style.top=`${drag.y-28}px`;}
  drag.frame=requestAnimationFrame(trackDrag);
}
document.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary)return;
  const moveHandle=event.target.closest('[data-move]');
  if(moveHandle){
    const source=Number(moveHandle.dataset.move),card=moveHandle.closest('.slot').querySelector('.activity');event.preventDefault();
    drag={mode:'move',id:card.dataset.category,source,grabOffset:Math.max(0,(rowAtPoint(event.clientX,event.clientY)??source)-source),startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,pointer:event.pointerId,card,moved:false,target:null};
    moveHandle.setPointerCapture(event.pointerId);return;
  }
  if(mobileUI.mobile()||event.pointerType==='touch')return;
  const handle=event.target.closest('[data-resize]');
  if(handle){
    const start=Number(handle.dataset.resize);event.preventDefault();handle.focus({preventScroll:true});
    drag={mode:'resize',source:start,originalDuration:day()[start].duration,duration:day()[start].duration,limit:maxDuration(day(),start),container:handle.closest('.slot'),originTop:timeline.querySelector('.hour-label').getBoundingClientRect().top,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,pointer:event.pointerId,moved:false};
    handle.setPointerCapture(event.pointerId);return;
  }
  const card=event.target.closest('.activity');if(!card||event.button!==0||!event.isPrimary)return;
  const source=card.hasAttribute('data-source')?Number(card.dataset.source):null;
  drag={mode:'move',id:card.dataset.category,source,grabOffset:source===null?0:Math.max(0,Math.floor((event.clientY-card.getBoundingClientRect().top)/rowHeight())),startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,pointer:event.pointerId,card,moved:false,target:null};
  card.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;drag.x=event.clientX;drag.y=event.clientY;
  if(!drag.moved&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>7){drag.moved=true;
    if(drag.mode==='resize')document.body.classList.add('resizing');
    else{drag.ghost=drag.card.cloneNode(true);drag.ghost.classList.add('drag-ghost');drag.ghost.removeAttribute('data-category');drag.ghost.setAttribute('aria-hidden','true');document.body.append(drag.ghost);document.body.classList.add('dragging');}
    trackDrag();
  }
});
document.addEventListener('pointerup',event=>{if(drag?.pointer===event.pointerId){if(drag.moved){drag.x=event.clientX;drag.y=event.clientY;updateDragTarget();}endDrag();}});
document.addEventListener('pointercancel',()=>endDrag(true));
document.addEventListener('lostpointercapture',event=>{if(drag?.pointer===event.pointerId)endDrag(true);});
window.addEventListener('blur',()=>endDrag(true));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){endDrag(true);if(!document.querySelector('dialog[open]')){selection=null;render();}return;}
  const handle=event.target.closest('[data-resize]');if(handle&&['ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();const start=Number(handle.dataset.resize);resize(start,day()[start].duration+(event.key==='ArrowDown'?1:-1));
  }
});
function changeDate(next){if(!validDate(next)){dateInput.value=date;return;}endDrag(true);date=next;dateInput.value=next;selection=null;render();}
dateInput.addEventListener('change',()=>changeDate(dateInput.value));
for(const [id,offset] of [['prev-day',-1],['next-day',1]])$("#"+id).addEventListener('click',()=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+offset);changeDate(localDate(value));});
$('#today').addEventListener('click',()=>changeDate(localDate()));
$('#cancel-selection').addEventListener('click',()=>{selection=null;render();});
$('#undo').addEventListener('click',()=>{if(!undo)return;const last=undo;state.days[last.date]=last.day;undo=null;changeDate(last.date);save();say('ひとつ前の状態に戻しました');});
$('#category-form').addEventListener('submit',event=>{
  event.preventDefault();const name=$('#category-name').value.trim();if(!name)return;
  if(state.categories.some(c=>c.name===name)){say('同じ名前のカテゴリがあります');return;}
  state.categories.push({id:`custom-${crypto.randomUUID()}`,name,icon:'✨',color:Object.keys(COLORS)[state.categories.length%8]});save();render();$('#category-form').reset();say(`${name}を追加しました`);
});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE)return;try{const updated=parseState(event.newValue);endDrag(true);state=updated;selection=null;undo=null;storageBlocked=false;render();say('別のタブの変更を反映しました');}catch{say('別のタブの保存データを読み込めませんでした');}
});
function updateNotificationUI(){
  const supported='Notification' in window&&isSecureContext;
  $('#notifications').disabled=!supported;
  if(!supported){$('#notifications').textContent='この環境は通知に未対応';return;}
  const enabled=notificationsEnabled&&Notification.permission==='granted';
  $('#notifications').textContent=enabled?'通知をオフにする':'通知をオンにする';
  $('#notification-status').textContent=Notification.permission==='denied'?'通知がブロックされています。ブラウザのサイト設定で許可してください。':enabled?'通知はオンです。画面を閉じた状態・スリープ中は通知できません。':'画面を閉じた状態・端末のスリープ中は通知できません。';
}
const serviceWorker='serviceWorker' in navigator?navigator.serviceWorker.register('./sw.js').catch(()=>null):Promise.resolve(null);
async function showNotification(title,body,tag){
  const registration=await serviceWorker;
  if(registration?.active)await registration.showNotification(title,{body,tag,icon:'./favicon.svg'});
  else new Notification(title,{body,tag});
}
$('#notifications').addEventListener('click',async()=>{
  if(notificationsEnabled&&Notification.permission==='granted')notificationsEnabled=false;
  else{try{notificationsEnabled=(await Notification.requestPermission())==='granted';if(notificationsEnabled)await showNotification('休日手帖の通知をオンにしました','予定の開始時刻をお知らせします。画面を開いてお使いください。','holiday-test');}catch{notificationsEnabled=false;say('このブラウザでは通知を開始できませんでした');}}
  try{localStorage.setItem(`${STORAGE}-notifications`,String(notificationsEnabled));}catch{}
  updateNotificationUI();
});
async function checkReminder(){
  const now=new Date();const start=now.getHours()*2+Math.floor(now.getMinutes()/30);
  document.querySelectorAll('.hour-label').forEach(row=>row.classList.toggle('current',date===localDate(now)&&Number(row.dataset.hour)===start));
  if(!notificationsEnabled||!('Notification' in window)||Notification.permission!=='granted'||now.getMinutes()%30!==0)return;
  const keyDate=localDate(now);const entry=state.days[keyDate]?.[start];if(!entry)return;
  const key=`${keyDate}-${start}`;if(delivered.has(key))return;delivered.add(key);
  const category=categoryById(entry.categoryId);
  try{await showNotification(`${category.icon} ${category.name}の時間です`,`${timeLabel(start)}〜${timeLabel(start+entry.duration)} の予定`,'holiday-'+key);}catch{say(`${category.name}の時間です（システム通知を表示できませんでした）`);}
}
const mobileUI=setupMobileUI({getState:()=>state,getDate:()=>date,render,
  commit:(editDate,next)=>{undo={date:editDate,day:structuredClone(state.days[editDate]||{})};state.days[editDate]=next;selection=null;date=editDate;dateInput.value=date;save();render();say('予定を保存しました');},
  remove:(editDate,start)=>{undo={date:editDate,day:structuredClone(state.days[editDate]||{})};delete state.days[editDate][start];selection=null;save();render();say('予定を削除しました。「元に戻す」で取り消せます');}
});
document.addEventListener('contextmenu',event=>{if(event.target.closest('.activity,.slot,.hour-label,.mobile-nav'))event.preventDefault();});
render();updateNotificationUI();
if(storageBlocked){$('#save-status').textContent='保存データを読み込めません・自動保存停止';say('保存領域を読み込めないため自動保存を停止しています。元データは上書きしません。');}
requestAnimationFrame(()=>{if(!mobileUI.mobile())timeline.scrollTop=14*rowHeight();});
setInterval(checkReminder,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminder();});

if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const tool={name:'place_holiday_activity',title:'休日の予定を配置',description:'指定日に30分単位の予定を配置します。同じ開始時刻・長さの予定は置き換えます。それ以外の重複は拒否します。指定日を表示して保存します。',inputSchema:{type:'object',properties:{date:{type:'string',description:'YYYY-MM-DD'},hour:{type:'number',minimum:0,maximum:23.5,multipleOf:0.5,description:'9.5は09:30'},durationMinutes:{type:'integer',minimum:30,maximum:1440,multipleOf:30,description:'省略時30分'},categoryId:{type:'string',description:'reading, walk, workout, manga, meal, game, rest, sleep またはカスタムカテゴリID'}},required:['date','hour','categoryId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const minutes=input?.durationMinutes??30;if(!input||!validDate(input.date)||typeof input.hour!=='number'||!Number.isInteger(input.hour*2)||input.hour<0||input.hour>23.5||!Number.isInteger(minutes/30)||minutes<30||input.hour*2+minutes/30>48||!categoryById(input.categoryId))throw new Error('日付、時刻、長さ、カテゴリを確認してください');putActivity(state.days[input.date]||{},input.categoryId,input.hour*2,null,minutes/30);changeDate(input.date);if(!place(input.categoryId,input.hour*2,null,minutes/30))throw new Error('予定を配置できませんでした');return {date,start:timeLabel(input.hour*2),durationMinutes:minutes,category:categoryById(input.categoryId).name,saveStatus:$('#save-status').textContent};}};
  try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
