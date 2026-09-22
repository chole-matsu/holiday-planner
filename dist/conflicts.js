import {planActivity,timeLabel} from './model.js';
export function confirmActivity(day,categories,id,start,duration,source=null){
  const plan=planActivity(day,id,start,duration,source);
  if(plan.changes.length){
    const lines=plan.changes.map(change=>`${categories.find(c=>c.id===change.categoryId)?.name||'予定'}：${timeLabel(change.from)} → ${timeLabel(change.to)}（終了 ${timeLabel(change.to+change.duration)}）`);
    if(!window.confirm(`予定が重なっています。以下の予定を後倒しにしますか？\n\n${lines.join('\n')}\n\nOKでまとめて確定します。キャンセルすると変更しません。`))return null;
  }
  return plan.day;
}
