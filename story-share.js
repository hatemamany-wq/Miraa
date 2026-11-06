// Share cards are generated locally; no database writes or additional storage.
export function storyLink(id, base=location.href){const url=new URL(base);url.hash='story='+encodeURIComponent(id);return url.href}
export function linkedStory(hash=location.hash){try{return new URLSearchParams(hash.replace(/^#/, '')).get('story')}catch{return null}}
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function image(src){return new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';const timer=setTimeout(()=>reject(Error('تعذر تحميل الصورة. تحقق من اتصالك وحاول مجددًا.')),15000);im.onload=()=>{clearTimeout(timer);resolve(im)};im.onerror=()=>{clearTimeout(timer);reject(Error('تعذر تحميل الغلاف أو شعار مرآة. يمكنك مشاركة الرابط الآن.'))};im.src=src})}
function contain(ctx,im,x,y,w,h){const scale=Math.min(w/im.width,h/im.height);const dw=im.width*scale,dh=im.height*scale;ctx.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
function lines(ctx,text,x,y,width,lineHeight,maxLines){const words=String(text||'').trim().split(/\s+/);let line='',row=0;for(let i=0;i<words.length;i++){const next=line?line+' '+words[i]:words[i];if(ctx.measureText(next).width>width&&line){if(row===maxLines-1){let end=line+'…';while(ctx.measureText(end).width>width&&line){line=line.slice(0,-1);end=line+'…'}ctx.fillText(end,x,y+row*lineHeight);return}ctx.fillText(line,x,y+row*lineHeight);row++;line=words[i]}else line=next}ctx.fillText(line,x,y+row*lineHeight)}
export async function buildCard(story,excerpt,logo){
 const [cover,brand]=await Promise.all([image(story.cover||logo),image(logo)]);
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#0a1124';ctx.fillRect(0,0,1200,630);ctx.fillStyle='#0f1c35';ctx.fillRect(20,20,1160,590);ctx.fillStyle='#45e1cb';ctx.fillRect(20,20,1160,5);
 contain(ctx,cover,920,85,230,385);contain(ctx,brand,40,185,180,180);
 ctx.direction='rtl';ctx.textAlign='right';ctx.fillStyle='#ffffff';ctx.font='bold 44px system-ui';lines(ctx,story.title,880,115,610,56,2);
 ctx.fillStyle='#a5b8cf';ctx.font='28px system-ui';lines(ctx,'بقلم '+(story.author||'كاتب مرآة'),880,240,610,38,2);
 ctx.fillStyle='#ffffff';ctx.font='32px system-ui';lines(ctx,excerpt,880,340,610,47,3);
 ctx.fillStyle='#45e1cb';ctx.font='bold 28px system-ui';ctx.fillText('اقرأ القصة كاملة على مرآة',880,550);
 ctx.direction='ltr';ctx.textAlign='center';ctx.font='20px system-ui';ctx.fillStyle='#a5b8cf';ctx.fillText(new URL(storyLink(story.id)).host,600,593);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('تعذر تجهيز صورة المشاركة');return blob;
}
export function openStoryShare(story,{logo,canEdit=false}){
 document.querySelector('#miraa-share-dialog')?.close();document.querySelector('#miraa-share-dialog')?.remove();
 const previous=document.activeElement;const dialog=document.createElement('dialog');dialog.id='miraa-share-dialog';dialog.dir='rtl';dialog.style.cssText='width:min(680px,94vw);max-height:90dvh;overflow:auto;background:#0f1c35;color:white;border:1px solid #36516e;border-radius:18px;padding:20px';
 let saved='';try{saved=localStorage.getItem('miraa.shareExcerpt.'+story.id)||''}catch{}
 const excerpt=saved||story.shareExcerpt||String(story.body||'').slice(0,180);
 dialog.innerHTML=`<h2>مشاركة القصة</h2><p>${escapeHTML(story.title)} — ${escapeHTML(story.author||'كاتب مرآة')}</p><label for="share-excerpt">${canEdit?'اكتب مقطعًا يشوّق القارئ':'مقتطف القصة'}</label><textarea class="field" id="share-excerpt" maxlength="240" ${canEdit?'':'readonly'}>${escapeHTML(excerpt)}</textarea>${canEdit?'<p class="muted">المقطع يُحفظ على جهازك لهذه البطاقة، ولا يغيّر نص القصة.</p>':''}<img id="share-preview" alt="معاينة بطاقة مشاركة القصة" style="width:100%;border-radius:12px" hidden><p id="share-status" role="status" aria-live="polite"></p><div class="actions"><button class="btn" id="share-image" disabled>مشاركة الصورة والرابط</button><button class="btn alt" id="save-image" disabled>حفظ الصورة</button><button class="btn alt" id="share-link">مشاركة الرابط</button><button class="btn alt" id="close-share">إغلاق</button></div><label for="share-url" class="muted">رابط القصة — يمكنك نسخه أيضًا</label><input id="share-url" class="field" readonly value="${escapeHTML(storyLink(story.id))}">`;
 document.body.append(dialog);dialog.showModal();
 const input=dialog.querySelector('#share-excerpt'),status=dialog.querySelector('#share-status'),preview=dialog.querySelector('#share-preview'),share=dialog.querySelector('#share-image'),save=dialog.querySelector('#save-image');let file=null,url=null,revision=0,timer;
 const cleanup=()=>{clearTimeout(timer);revision++;if(url)URL.revokeObjectURL(url);dialog.remove();previous?.focus()};dialog.addEventListener('close',cleanup,{once:true});dialog.querySelector('#close-share').onclick=()=>dialog.close();
 async function prepare(){const version=++revision;file=null;share.disabled=save.disabled=true;preview.hidden=true;status.textContent='جارٍ تجهيز البطاقة…';try{const blob=await buildCard(story,input.value.trim(),logo);if(version!==revision||!dialog.open)return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(blob);file=new File([blob],'miraa-story.png',{type:'image/png'});preview.src=url;preview.hidden=false;share.disabled=save.disabled=false;status.textContent='البطاقة جاهزة. اختَر المشاركة أو حفظ الصورة.'}catch(error){if(version===revision)status.textContent=error.message}}
 input.oninput=()=>{revision++;file=null;share.disabled=save.disabled=true;clearTimeout(timer);if(canEdit)try{localStorage.setItem('miraa.shareExcerpt.'+story.id,input.value)}catch{}timer=setTimeout(prepare,300)};
 const download=()=>{if(!url)return;const a=document.createElement('a');a.href=url;a.download='miraa-story.png';a.click();status.textContent='تم طلب حفظ الصورة. شارك معها رابط القصة الموجود بالأسفل.'};save.onclick=download;
 share.onclick=async()=>{if(!file)return;try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:story.title,text:`${story.title}\nبقلم ${story.author||'كاتب مرآة'}\n${input.value.trim()}\n${storyLink(story.id)}`})}else{download();status.textContent='المتصفح لا يدعم مشاركة الصور مباشرة؛ احفظ الصورة وانسخ رابط القصة.'}}catch(error){if(error.name!=='AbortError')status.textContent='تعذرت المشاركة. جرّب حفظ الصورة ونسخ الرابط.'}};
 dialog.querySelector('#share-link').onclick=async()=>{try{if(navigator.share)await navigator.share({title:story.title,text:story.title+' — '+(story.author||'كاتب مرآة'),url:storyLink(story.id)});else if(navigator.clipboard){await navigator.clipboard.writeText(storyLink(story.id));status.textContent='تم نسخ رابط القصة'}else{dialog.querySelector('#share-url').select();status.textContent='انسخ الرابط المحدد وشاركه'}}catch(error){if(error.name!=='AbortError')status.textContent='يمكنك نسخ الرابط من الحقل بالأسفل.'}};
 prepare();
}
