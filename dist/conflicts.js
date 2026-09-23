import {planActivity,planParallel,timeLabel} from './model.js';
export function confirmParallel(primary,secondary,categories,id,start,duration,source=null,lane=0){
  const plan=planParallel(primary,secondary,id,start,duration,source,lane);
  if(plan.changes.length&&!window.confirm(`同時に入れられる予定は2つまでです。以下の予定を後倒しにしますか？\n\n${plan.changes.map(c=>`${categories.find(x=>x.id===c.categoryId)?.name||'予定'}：${timeLabel(c.from)} → ${timeLabel(c.to)}`).join('\n')}\n\nOKで確定します。`))return null;
  return plan;
}
export function confirmActivity(day,categories,id,start,duration,source=null){
  const plan=planActivity(day,id,start,duration,source);
  if(plan.changes.length){
    const lines=plan.changes.map(change=>`${categories.find(c=>c.id===change.categoryId)?.name||'予定'}：${timeLabel(change.from)} → ${timeLabel(change.to)}（終了 ${timeLabel(change.to+change.duration)}）`);
    if(!window.confirm(`予定が重なっています。以下の予定を後倒しにしますか？\n\n${lines.join('\n')}\n\nOKでまとめて確定します。キャンセルすると変更しません。`))return null;
  }
  return plan.day;
}
