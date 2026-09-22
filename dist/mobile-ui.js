import {COLORS,timeLabel,durationLabel,editActivity,eventAt} from './model.js';

export function setupMobileUI({getState,getDate,commit,remove,render}) {
  const $=selector=>document.querySelector(selector);
  const media=matchMedia('(max-width: 800px), (pointer: coarse)');
  const dialog=$('#event-dialog');
  let view='schedule',showEarly=false,source=null,editorDate,baseline,previousStart=0,pageScroll=0,locked=false;
  const mobile=()=>media.matches;
  function openDialog(target){
    if(!locked){pageScroll=window.scrollY;document.body.style.top=`-${pageScroll}px`;document.body.classList.add('dialog-open');locked=true;}
    target.showModal();
  }
  for(const target of document.querySelectorAll('dialog'))target.addEventListener('close',()=>{
    if(!document.querySelector('dialog[open]')&&locked){document.body.classList.remove('dialog-open');document.body.style.top='';locked=false;window.scrollTo(0,pageScroll);}
  });
  function setView(next,{scroll=true}={}){
    view=next;document.body.dataset.mobileView=view;
    for(const name of ['schedule','categories','packing'])$(`#view-${name}`).setAttribute('aria-pressed',String(name===view));
    if(scroll&&mobile())window.scrollTo({top:0,behavior:'instant'});
  }
  for(const name of ['schedule','categories','packing'])$(`#view-${name}`).addEventListener('click',()=>setView(name));
  $('#early-hours').addEventListener('click',()=>{showEarly=!showEarly;$('#early-hours').textContent=showEarly?'6時から表示':'0〜6時も表示';$('#early-hours').setAttribute('aria-pressed',String(showEarly));render();});
  for(const button of document.querySelectorAll('[data-jump]'))button.addEventListener('click',()=>{
    const target=$(`.hour-label[data-hour="${button.dataset.jump}"]`);target?.scrollIntoView({block:'start',behavior:'smooth'});
  });
  media.addEventListener('change',()=>{setView(view,{scroll:false});render();});
  setView('schedule',{scroll:false});

  for(let slot=0;slot<48;slot++)$('#event-start').add(new Option(timeLabel(slot),String(slot)));
  for(let slot=1;slot<=48;slot++)$('#event-end').add(new Option(timeLabel(slot),String(slot)));
  function syncDuration(){
    const start=Number($('#event-start').value),end=Number($('#event-end').value);
    const duration=end-start;
    $('#event-duration').textContent=duration>0?durationLabel(duration):'終了時刻を選択';
    $('#duration-minus').disabled=duration<=1;$('#duration-plus').disabled=end>=48;
    for(const option of $('#event-end').options)option.disabled=Number(option.value)<=start;
    for(const button of document.querySelectorAll('[data-duration]')){
      button.disabled=start+Number(button.dataset.duration)>48;
      button.setAttribute('aria-pressed',String(Number(button.dataset.duration)===duration));
    }
    $('#event-error').textContent='';
  }
  function setDuration(duration){const start=Number($('#event-start').value);$('#event-end').value=String(Math.max(start+1,Math.min(48,start+duration)));syncDuration();}
  $('#duration-minus').addEventListener('click',()=>setDuration(Number($('#event-end').value)-Number($('#event-start').value)-1));
  $('#duration-plus').addEventListener('click',()=>setDuration(Number($('#event-end').value)-Number($('#event-start').value)+1));
  for(const button of document.querySelectorAll('[data-duration]'))button.addEventListener('click',()=>setDuration(Number(button.dataset.duration)));
  $('#event-end').addEventListener('change',syncDuration);
  $('#event-start').addEventListener('change',()=>{const duration=Math.max(1,Number($('#event-end').value)-previousStart);previousStart=Number($('#event-start').value);setDuration(duration);});
  function openEvent(start=null,categoryId=null,existing=null){
    editorDate=getDate();const day=getState().days[editorDate]||{};
    source=existing;baseline=JSON.stringify(day);
    if(start===null){
      start=Array.from({length:48},(_,i)=>(i+14)%48).find(slot=>!eventAt(day,slot));
      if(start===undefined){$('#toast').textContent='空き時間がありません。予定をタップして編集してください。';$('#toast').hidden=false;return;}
    }
    const entry=source===null?null:day[source];if(source!==null&&!entry)return;
    const selected=entry?.categoryId||categoryId||getState().categories[0]?.id;
    $('#event-title').textContent=entry?'予定を編集':'予定を追加';
    $('#event-date').textContent=new Date(`${editorDate}T12:00:00`).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
    $('#event-category-options').replaceChildren(...getState().categories.map(category=>{
      const label=document.createElement('label');label.className='event-category-choice';label.style.setProperty('--tint',COLORS[category.color][0]);
      const input=document.createElement('input');input.type='radio';input.name='event-category';input.value=category.id;input.checked=category.id===selected;input.required=true;
      const text=document.createElement('span');text.textContent=`${category.icon} ${category.name}`;label.append(input,text);return label;
    }));
    $('#event-start').value=String(start);previousStart=start;$('#event-end').value=String(start+(entry?.duration||1));
    $('#event-delete').hidden=!entry;syncDuration();openDialog(dialog);
    $('#event-cancel').focus({preventScroll:true});
  }
  $('#add-event').addEventListener('click',()=>openEvent());
  $('#event-cancel').addEventListener('click',()=>dialog.close());
  function currentDay(){
    const current=getState().days[editorDate]||{};
    if(JSON.stringify(current)!==baseline)throw new Error('予定が別の画面で変更されました。閉じてからもう一度編集してください。');
    return current;
  }
  $('#event-form').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const categoryId=$('input[name="event-category"]:checked')?.value;
      if(!getState().categories.some(category=>category.id===categoryId))throw new Error('カテゴリを選んでください。');
      const start=Number($('#event-start').value),duration=Number($('#event-end').value)-start;
      const next=editActivity(currentDay(),categoryId,start,duration,source);
      if(mobile()&&start<12){showEarly=true;$('#early-hours').textContent='6時から表示';$('#early-hours').setAttribute('aria-pressed','true');}
      dialog.close();setView('schedule',{scroll:false});commit(editorDate,next);
      if(mobile())requestAnimationFrame(()=>$(`.slot[data-hour="${start}"]`)?.scrollIntoView({block:'center',behavior:'smooth'}));
    }catch(error){$('#event-error').textContent=error.message;}
  });
  $('#event-delete').addEventListener('click',()=>{
    try{currentDay();dialog.close();setView('schedule',{scroll:false});remove(editorDate,source);}catch(error){$('#event-error').textContent=error.message;}
  });
  return {mobile,openEvent,openDialog,setView,showTime(slot){setView('schedule',{scroll:false});if(slot<12){showEarly=true;$('#early-hours').textContent='6時から表示';$('#early-hours').setAttribute('aria-pressed','true');}},visibleStart:()=>mobile()&&!showEarly?12:0};
}
