const paths={
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  bag:'<rect x="4" y="7" width="16" height="14" rx="3"/><path d="M8 7V5a4 4 0 0 1 8 0v2m-8 7 3 3 5-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  move:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  resize:'<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3zm5 3h4"/>'
};
export function icon(name){const element=document.createElementNS('http://www.w3.org/2000/svg','svg');element.setAttribute('viewBox','0 0 24 24');element.setAttribute('class','ui-icon');element.setAttribute('aria-hidden','true');element.setAttribute('fill','none');element.setAttribute('stroke','currentColor');element.setAttribute('stroke-width','1.8');element.setAttribute('stroke-linecap','round');element.setAttribute('stroke-linejoin','round');element.innerHTML=paths[name]||paths.calendar;return element;}
export function decorateControls(){for(const [id,name,label] of [['today','clock','今'],['view-schedule','calendar','予定'],['view-categories','grid','カテゴリ'],['view-packing','bag','持ち物'],['add-event','plus','予定追加'],['undo','undo','一つ前に戻す']]){const button=document.getElementById(id);button.replaceChildren(icon(name),document.createTextNode(label));}document.getElementById('today').setAttribute('aria-label','現在の日時にジャンプ');document.querySelector('.heading').after(document.getElementById('undo'));}
