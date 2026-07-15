const $=id=>document.getElementById(id);
let chars=JSON.parse(localStorage.getItem('meimane')||'[]');let edit=-1;
function persist(){localStorage.setItem('meimane',JSON.stringify(chars))}
function render(){
 const q=$('search').value.toLowerCase();
 $('stats').innerHTML=`<b>キャラ数:</b> ${chars.length}`;
 $('list').innerHTML='';
 chars.filter(c=>c.name.toLowerCase().includes(q)).forEach((c,i)=>{
  const d=document.createElement('div');
  d.className='card';
  const p=Math.max(0,Math.min(100,Number(c.exp)||0));
  d.innerHTML=`<b>${c.name}</b><div class='meta'>Lv.${c.level}</div><div>前日EXP ${c.exp===''?'未登録':c.exp+'%'}</div><div class='bar'><div class='fill' style='width:${p}%'></div></div>`;
  d.onclick=()=>openEdit(i);
  $('list').appendChild(d);
 });
 persist();
}
function openEdit(i){
 edit=i;
 $('delete').style.display=i===-1?'none':'block';
 $('mode').textContent=i===-1?'キャラクター追加':'キャラクター編集';
 if(i===-1){$('name').value='';$('level').value='';$('exp').value='';}
 else{let c=chars[i];$('name').value=c.name;$('level').value=c.level;$('exp').value=c.exp;}
 $('dlg').showModal();
}
$('fab').onclick=()=>openEdit(-1);
$('search').oninput=render;
$('cancel').onclick=()=>$('dlg').close();
$('save').onclick=()=>{
 if(!$('name').value.trim()){alert('キャラ名を入力してください');return;}
 if(!$('level').value){alert('レベルを入力してください');return;}
 const obj={name:$('name').value.trim(),level:Number($('level').value),exp:$('exp').value.trim()};
 if(edit===-1)chars.push(obj); else chars[edit]=obj;
 $('dlg').close();render();
};
$('delete').onclick=()=>{
 if(edit===-1)return;
 if(confirm('このキャラを削除しますか？')){
   chars.splice(edit,1);$('dlg').close();render();
 }
};
render();