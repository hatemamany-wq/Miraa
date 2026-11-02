import {mediaType,validateFileSize,validateVideoDuration,readVideoDuration} from './media-utils.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,collection,addDoc,query,orderBy,onSnapshot,doc,updateDoc,serverTimestamp,getDoc,setDoc,where} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {getStorage,ref,uploadBytesResumable,getDownloadURL} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
const config=window.MIRAA_FIREBASE_CONFIG;let auth=null,fire=null,storage=null,user=null;const cloud=!!config?.apiKey;
if(cloud){const app=initializeApp(config);auth=getAuth(app);fire=getFirestore(app);storage=getStorage(app)}
const $=s=>document.querySelector(s),logo='assets/miraa-logo.jpg',safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),date=x=>x?.toDate?.().toLocaleDateString('ar')||'الآن';const tabs=[['home','⌂','الرئيسية'],['stories','📚','القصص'],['audio','🎙','الصوتيات'],['videos','▶','الفيديوهات'],['generate','✦','توليد'],['market','🛒','السوق'],['account','👤','حسابي']];let section='home',page='',arg=null,history=[],storyTab='short',data={stories:[],chapters:[],comments:[],audios:[],videos:[],listings:[]},recording=null,recorded=null,recordChunks=[],unsubs=[];const $app=$('#app');
let pendingAction=false;
const editPages=new Set(['compose','addChapter','uploadAudio','uploadVideo','offer','comments']);
function autoRender(){
  // Keep actual DOM nodes: a file input cannot be restored after innerHTML replacement.
  if(page==='comments'){refreshComments();return;}
  if(pendingAction||recording?.state==='recording'||editPages.has(page))return;
  if(section==='account'&&[...$app.querySelectorAll('input')].some(i=>i.value))return;
  if(section==='stories'&&document.activeElement?.id==='storySearch')return;
  if([...$app.querySelectorAll('audio')].some(a=>!a.paused))return;
  if(section==='videos'&&[...$app.querySelectorAll('video')].some(v=>!v.paused))return;
  render();
}
function savedOrder(){try{return localStorage.getItem('miraa.storyOrder')||'newest'}catch{return 'newest'}}
let storyOrder=savedOrder();
if(!['newest','oldest','az','za'].includes(storyOrder))storyOrder='newest';
let storySearch='';
function sortedStories(){
  const text=storySearch.trim().toLocaleLowerCase('ar');
  const list=data.stories.filter(s=>s.type===storyTab&&String(s.title||'').toLocaleLowerCase('ar').includes(text));
  const stamp=s=>s.createdAt?.toMillis?.()||((s.createdAt?.seconds||0)*1000);
  return list.sort((a,b)=>storyOrder==='az'?String(a.title).localeCompare(String(b.title),'ar'):storyOrder==='za'?String(b.title).localeCompare(String(a.title),'ar'):storyOrder==='oldest'?stamp(a)-stamp(b):stamp(b)-stamp(a));
}
const say=s=>alert(s),need=()=>{if(!cloud){say('يلزم إعداد Firebase أولًا حتى يعمل النشر المشترك.');return false}if(!user){say('سجّل حسابًا أولًا.');go('account');return false}return true};
function go(s,p='',a=null){if(pendingAction)return say('انتظر حتى تكتمل العملية');if(recording?.state==='recording')return say('أوقف التسجيل قبل الخروج');if(p)history.push([section,page,arg]);section=s;page=p;arg=a;render();scrollTo(0,0)}function back(){if(pendingAction)return say('انتظر حتى تكتمل العملية');if(recording?.state==='recording')return say('أوقف التسجيل قبل الخروج');let x=history.pop();if(x)[section,page,arg]=x;else page='';render();scrollTo(0,0)}$('#back').onclick=back;
let sx=0,sy=0;document.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});document.addEventListener('touchend',e=>{if(page||section==='videos')return;let dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<100||Math.abs(dx)<Math.abs(dy)*1.4)return;let i=tabs.findIndex(t=>t[0]===section);go(tabs[Math.max(0,Math.min(tabs.length-1,i+(dx>0?-1:1)))][0])},{passive:true});
const btn=(label,fn,alt=false)=>`<button class="btn ${alt?'alt':''}" data-action="${fn}">${label}</button>`;
const notice=txt=>`<div class="notice">${txt}</div>`,empty=txt=>`<div class="card muted">${txt}</div>`,ad=()=>'<div class="ad">مساحة إعلان — غير مفعلة في الاختبار</div>';
function render(){ $('#back').classList.toggle('hidden',!page);$('#tabs').innerHTML=tabs.map(([id,ic,t])=>`<button class="tab ${id===section?'on':''}" data-go="${id}"><span>${ic}</span>${t}</button>`).join('');$app.innerHTML=page?detail():({home,stories,audio,videos,generate,market,account}[section]||home)(); }
function storyCard(s){return `<div class="card item" style="display:flex;direction:rtl;align-items:center;gap:12px"><img class="cover" src="${safe(s.cover||logo)}"><div class="grow"><b>${safe(s.title)}</b><div class="muted">${safe(s.author||'كاتب مرآة')} · ${date(s.createdAt)}</div><p class="mini">${safe((s.body||'').slice(0,100))}</p>${btn('افتح العمل',`read:${s.id}`,true)}</div><img src="${logo}" alt="مرآة" style="width:40px;height:40px;object-fit:contain"></div>`}
function home(){return `<div class="card hero item"><img src="${logo}" style="width:100px;border-radius:14px"><div><h2>أهلًا بك في مرآة</h2><p>اقرأ واحكي واكسب</p><span class="badge">${cloud?'النسخة المتصلة':'بانتظار إعداد Firebase'}</span></div></div>${notice('التصفح مفتوح للجميع. النشر يحتاج حسابًا. المولد والمكافآت المالية والمدفوعات غير مفعّلة في هذه النسخة.') }<h3>أحدث القصص</h3>${data.stories.slice(0,4).map(storyCard).join('')||empty('لا توجد قصص منشورة بعد.')}${ad()}`}
function stories(){const list=sortedStories();return `<h2>القصص والروايات</h2><div class="split"><button class="${storyTab==='short'?'active':''}" data-action="tab:short">قصص قصيرة</button><button class="${storyTab==='novel'?'active':''}" data-action="tab:novel">روايات طويلة</button></div><div class="row"><h3>${storyTab==='short'?'القصص القصيرة':'الروايات الطويلة'}</h3>${btn(storyTab==='short'?'＋ اكتب قصة':'＋ اكتب رواية','compose')}</div><input class="field" id="storySearch" type="search" value="${safe(storySearch)}" placeholder="ابحث بعنوان القصة أو الرواية"><select class="field" id="storyOrder">${[['newest','الأحدث أولًا'],['oldest','الأقدم أولًا'],['az','العنوان: أ ← ي'],['za','العنوان: ي ← أ']].map(([v,t])=>`<option value="${v}" ${v===storyOrder?'selected':''}>${t}</option>`).join('')}</select><div id="storyResults">${list.map((s,i)=>storyCard(s)+(i%4===3?ad():'' )).join('')||empty(storySearch?'لا توجد نتائج مطابقة.':storyTab==='short'?'لا توجد قصص قصيرة بعد.':'لا توجد روايات بعد.')}</div>`}
function audio(){return `<div class="row"><h2>الصوتيات</h2>${btn('＋ سجّل أو ارفع','uploadAudio')}</div>${data.audios.map(a=>`<div class="card"><b>${safe(a.title)}</b><p class="muted">${safe(a.author)}</p><audio class="audio" controls preload="none" src="${safe(a.url)}"></audio>${btn('التعليقات',`comments:audio:${a.id}`,true)}</div>`).join('')||empty('لا توجد تسجيلات بعد.')}`}
function videos(){return `<div class="row"><h2>الفيديوهات</h2>${btn('＋ انشر فيديو','uploadVideo')}</div>${data.videos.map((v,i)=>`<div class="card"><div class="video"><video controls playsinline preload="metadata" src="${safe(v.url)}"></video><div class="watermark"><img src="${logo}" alt="مرآة" style="width:24px;height:24px;object-fit:cover;border-radius:5px;vertical-align:middle;margin-left:5px">مرآة ◈ ${safe(v.author)}</div></div><p><b>${safe(v.title)}</b></p><p class="muted">${safe(v.author)}</p>${btn('التعليقات',`comments:video:${v.id}`,true)}</div>${(i+1)%5===0?ad():''}`).join('')||empty('لا توجد فيديوهات بعد.')}`}
function generate(){return `<h2>توليد الفيديو بالذكاء الاصطناعي</h2>${notice('القسم موجود ضمن مرآة، لكن المحرك غير مفعّل حاليًا، ولا يتم تحصيل أي رسوم.') }<div class="card"><textarea class="field" disabled placeholder="اكتب المشهد الذي تتخيله..."></textarea><button class="btn" disabled>توليد الفيديو — قريبًا</button><p class="muted">عند التفعيل سيكون بإمكانك معاينة الفيديو ثم اختيار صوتك أو موسيقى مرخّصة أو الصمت قبل النشر.</p></div>`}
function market(){return `<div class="row"><h2>سوق القصص</h2>${btn('＋ أضف عرضًا','offer')}</div>${notice('العروض هنا للتواصل الاستكشافي فقط؛ لا مدفوعات ولا عقود إلكترونية ولا نقل حقوق داخل النسخة التجريبية.')}${data.listings.map(l=>`<div class="card"><b>${safe(l.title)}</b><p>${safe(l.description)}</p><p class="muted">الحق المعروض: ${safe(l.right)} · ${safe(l.author)}</p>${btn('عرض التفاصيل',`listing:${l.id}`,true)}</div>`).join('')||empty('لا توجد عروض بعد.')}`}
function account(){return `<h2>حسابي</h2>${!cloud?notice('لم تُربط إعدادات Firebase بعد؛ التسجيل المشترك غير متاح.'):''}${user?`<div class="card"><img src="${logo}" alt="مرآة" style="width:55px;border-radius:12px"><b>${safe(user.displayName||'عضو مرآة')}</b><p class="muted">${safe(user.email||'')}</p>${btn('تسجيل خروج','logout',true)}</div><div class="card"><h3>تقدّم التأهيل</h3><p class="muted">المكافآت المالية غير مفعلة في الاختبار، ولن نعرض أرباحًا وهمية.</p><div class="progress"><i style="width:0%"></i></div></div>`:`<div class="card"><h3>التسجيل والدخول بالإيميل</h3><p class="muted">استخدم بريدك الإلكتروني وكلمة مرور من 6 أحرف على الأقل. لإنشاء حساب جديد اكتب اسمك المستعار.</p><input class="field" id="email" type="email" autocomplete="email" placeholder="البريد الإلكتروني"><input class="field" id="password" type="password" autocomplete="current-password" placeholder="كلمة المرور"><input class="field" id="displayName" maxlength="50" placeholder="اسمك المستعار (للتسجيل الجديد)"><div class="actions">${btn('إنشاء حساب','registerEmail')}${btn('دخول','loginEmail',true)}</div></div>`}<div class="card"><h3>الخصوصية والسلامة</h3><p>بريدك الإلكتروني لا يظهر للزوار. لا تشارك كلمة المرور مع أي شخص.</p><p class="muted">قبل الإطلاق العام يلزم سياسة خصوصية وشروط استخدام وإبلاغ وحظر وحذف حساب.</p></div>`}

function commentList(){
 const [kind,target]=arg.split(':');
 return data.comments.filter(c=>c.kind===kind&&c.target===target).map(c=>`<div class="card"><b>${safe(c.author)}</b> <span class="badge">مشترك</span><p>${safe(c.body)}</p><span class="muted mini">${date(c.createdAt)}</span></div>`).join('')||empty('كن أول من يعلّق');
}
function refreshComments(){const node=$('#commentList');if(node)node.innerHTML=commentList()}
function detail(){if(page==='compose')return `<h2>${storyTab==='short'?'اكتب قصة قصيرة':'اكتب رواية'}</h2><div class="card"><input class="field" id="title" maxlength="160" placeholder="عنوان العمل"><label class="muted">غلاف العمل (مطلوب)</label><input class="field" id="cover" type="file" accept="image/*" required><textarea class="field" id="body" placeholder="${storyTab==='short'?'نص القصة':'الفصل الأول من الرواية'}"></textarea>${btn('انشر العمل','publishStory')}</div>`;
if(page==='read'){const s=data.stories.find(x=>x.id===arg);if(!s)return empty('العمل غير موجود');const chapters=data.chapters.filter(c=>c.storyId===s.id).sort((a,b)=>a.number-b.number);return `<div class="card"><h2>${safe(s.title)}</h2><p class="muted">${safe(s.author)}</p>${s.type==='novel'?`<h3>فصول الرواية</h3>${chapters.map(c=>`<div class="row" style="padding:8px 0;border-bottom:1px solid #28415c"><span>${safe(c.number)}. ${safe(c.title)}</span>${btn('اقرأ',`chapter:${c.id}`,true)}</div>`).join('')||empty('لم تُنشر فصول بعد')}${user?.uid===s.authorId?`<div class="actions">${btn('＋ أضف فصلًا',`addChapter:${s.id}`)}</div>`:''}`:`<div class="reading">${safe(s.body)}</div>`}<div class="actions">${btn('التعليقات',`comments:story:${s.id}`,true)}</div></div>${ad()}`}
if(page==='chapter'){const c=data.chapters.find(x=>x.id===arg);if(!c)return empty('الفصل غير موجود');return `<div class="card"><h2>${safe(c.title)}</h2><div class="reading">${safe(c.body)}</div>${btn('التعليقات',`comments:chapter:${c.id}`,true)}</div>${ad()}`}
if(page==='addChapter')return `<h2>إضافة فصل</h2><div class="card"><input class="field" id="chapterTitle" placeholder="عنوان الفصل"><textarea class="field" id="chapterBody" placeholder="نص الفصل"></textarea>${btn('نشر الفصل','publishChapter')}</div>`;
if(page==='comments')return `<h2>التعليقات</h2><div id="commentList">${commentList()}</div>${user?`<div class="card"><textarea class="field" id="comment" placeholder="اكتب تعليقًا محترمًا"></textarea><p class="muted">التعليق المؤهل للمكافآت يتطلب 15 كلمة على الأقل، ويُحتسب العضو مرة واحدة لكل عمل. المكافآت لم تُفعّل بعد.</p>${btn('أرسل التعليق','postComment')}</div>`:notice('يمكنك قراءة التعليقات. سجّل الدخول لإضافة تعليق.')+btn('تسجيل الدخول','openAccount')}`;
if(page==='uploadAudio')return `<h2>سجّل أو ارفع صوتًا</h2><div class="card"><input class="field" id="mediaTitle" maxlength="160" placeholder="عنوان التسجيل"><input class="field" id="mediaFile" type="file" accept="audio/*"><div class="actions">${btn('ابدأ التسجيل','startRecord',true)}${btn('أوقف التسجيل','stopRecord',true)}</div><p id="recStatus" class="muted">يمكنك اختيار ملف أو تسجيل صوتك من الميكروفون.</p><p id="uploadStatus" role="status" aria-live="polite"></p><progress id="uploadProgress" max="100" value="0" hidden></progress>${btn('انشر التسجيل','publishAudio')}</div>`;
if(page==='uploadVideo')return `<h2>انشر فيديو</h2><div class="card"><input class="field" id="mediaTitle" maxlength="160" placeholder="عنوان الفيديو"><input class="field" id="mediaFile" type="file" accept="video/*,.mp4,.m4v,.mov,.webm"><p class="muted">مدة الفيديو من 5 ثوانٍ إلى 3 دقائق. اختيار الصوت: استخدم ملفًا جاهزًا بصوتك أو صامتًا. محرر الصوت والموسيقى المرخّصة لم يُنفذ بعد.</p><p id="uploadStatus" role="status" aria-live="polite"></p><progress id="uploadProgress" max="100" value="0" hidden></progress>${btn('انشر الفيديو','publishVideo')}</div>`;
if(page==='offer')return `<h2>إضافة عرض حقوق</h2><div class="card"><input class="field" id="offerTitle" maxlength="160" placeholder="عنوان العمل"><select class="field" id="offerRight"><option>حقوق النشر</option><option>حقوق التحويل لفيلم</option><option>حقوق التحويل لمسلسل</option><option>حقوق الكتاب الصوتي</option></select><textarea class="field" id="offerDesc" placeholder="تفاصيل العرض ونطاق الحقوق"></textarea>${btn('نشر العرض','publishOffer')}</div>`;
if(page==='listing'){const l=data.listings.find(x=>x.id===arg);return l?`<div class="card"><h2>${safe(l.title)}</h2><p>${safe(l.description)}</p><p class="muted">الحق: ${safe(l.right)}</p>${notice('التفاوض والعقود والمدفوعات الموثقة غير مفعلة بعد. لا ترسل بيانات مالية أو شخصية في التعليقات.')}</div>`:empty('العرض غير موجود')}
return empty('الصفحة غير موجودة')}
const val=id=>$('#'+id)?.value?.trim()||'';function uploadMessage(text,percent){const node=$('#uploadStatus');if(node)node.textContent=text;const bar=$('#uploadProgress');if(bar&&Number.isFinite(percent)){bar.hidden=false;bar.value=percent}}
function uploadError(e){
 const messages={'storage/unauthorized':'إعدادات التخزين تمنع الرفع. يلزم مراجعة قواعد Storage لحسابك.', 'storage/unauthenticated':'انتهت الجلسة. سجّل الدخول مجددًا.', 'storage/retry-limit-exceeded':'تعذر إكمال الرفع بسبب الاتصال. حاول مجددًا.', 'storage/canceled':'أُلغي الرفع.', 'storage/quota-exceeded':'حصة التخزين غير متاحة. يلزم مراجعة خطة المشروع والفوترة.', 'storage/bucket-not-found':'مساحة التخزين غير موجودة. يلزم مراجعة إعدادات Firebase.', 'storage/no-default-bucket':'لم تُحدد مساحة التخزين في الإعدادات.'};
 return messages[e?.code]||e?.message||'تعذر إكمال العملية. حاول مجددًا.';
}
async function uploadFile(file,folder,contentType=file?.type){
 validateFileSize(file);
 const originalName=file.name||('recording.'+(contentType?.includes('mp4')?'m4a':contentType?.includes('ogg')?'ogg':'webm'));
 const name=`${folder}/${user.uid}/${crypto.randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const location=ref(storage,name);
 const task=uploadBytesResumable(location,file,{contentType:contentType||'application/octet-stream'});
 await new Promise((resolve,reject)=>{task.on('state_changed',snap=>{const percent=Math.round(snap.bytesTransferred/snap.totalBytes*100);uploadMessage(`جارٍ رفع الملف: ${percent}٪`,percent)},reject,resolve)});
 uploadMessage('اكتمل رفع الملف، جارٍ حفظ المنشور...',100);
 return getDownloadURL(task.snapshot.ref);
}
async function publishStory(){if(!need())return;let title=val('title'),body=val('body');if(title.length<3||title.length>160||body.length<15||body.length>100000)return say('اكتب عنوانًا ونصًا مناسبين');try{let file=$('#cover').files[0];if(!file)throw Error('اختر صورة غلاف قبل النشر');let cover;if(file){if(!file.type.startsWith('image/'))throw Error('اختر صورة غلاف');cover=await uploadFile(file,'covers')}let refStory=await addDoc(collection(fire,'stories'),{title,body:storyTab==='short'?body:'',type:storyTab,cover,author:user.displayName||'كاتب مرآة',authorId:user.uid,createdAt:serverTimestamp()});if(storyTab==='novel')await addDoc(collection(fire,'chapters'),{storyId:refStory.id,number:1,title:'الفصل الأول',body,authorId:user.uid,createdAt:serverTimestamp()});return {storyId:refStory.id}}catch(e){say('تعذر النشر: '+e.message)}}
async function publishChapter(){if(!need())return;let s=data.stories.find(x=>x.id===arg);if(!s||s.authorId!==user.uid)return say('هذه الرواية ليست ملك حسابك');let title=val('chapterTitle'),body=val('chapterBody');if(!title||body.length<15||body.length>100000)return say('أكمل عنوان الفصل ونصه');try{let num=1+Math.max(0,...data.chapters.filter(c=>c.storyId===s.id).map(c=>c.number||0));await addDoc(collection(fire,'chapters'),{storyId:s.id,number:num,title,body,authorId:user.uid,createdAt:serverTimestamp()});return {storyId:s.id}}catch(e){say(e.message)}}
async function postComment(){if(!need())return;let body=val('comment');if(body.length<2||body.length>3000)return say('التعليق يجب أن يكون بين حرفين و3000 حرف');let [kind,target]=arg.split(':');try{await addDoc(collection(fire,'comments'),{kind,target,body,author:user.displayName||'عضو مرآة',authorId:user.uid,createdAt:serverTimestamp()});$('#comment').value=''}catch(e){say(e.message)}}
async function publishOffer(){if(!need())return;let title=val('offerTitle'),description=val('offerDesc'),right=val('offerRight');if(title.length<3||title.length>160||description.length<10||description.length>10000)return say('أكمل بيانات العرض');try{await addDoc(collection(fire,'listings'),{title,description,right,author:user.displayName||'عضو مرآة',authorId:user.uid,createdAt:serverTimestamp()});return {published:true}}catch(e){say(e.message)}}
let startingRecord=false;async function startRecord(){if(!need())return;if(startingRecord||recording?.state==='recording')return;if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return say('التسجيل يحتاج HTTPS ومتصفحًا يدعم الميكروفون');startingRecord=true;try{let stream=await navigator.mediaDevices.getUserMedia({audio:true});recordChunks=[];recorded=null;recording=new MediaRecorder(stream);recording.ondataavailable=e=>recordChunks.push(e.data);recording.onstop=()=>{recorded=new Blob(recordChunks,{type:recording.mimeType});stream.getTracks().forEach(t=>t.stop());let x=$('#recStatus');if(x)x.textContent='تم التسجيل. يمكنك نشره الآن.'};recording.start();$('#recStatus').textContent='جارٍ التسجيل...'}catch(e){say('تعذر التسجيل: '+e.message)}finally{startingRecord=false}}function stopRecord(){if(recording?.state==='recording')recording.stop()}
async function publishMedia(kind){
 if(!need())return;
 if(recording?.state==='recording')return say('أوقف التسجيل أولًا ثم انشره.');
 const title=val('mediaTitle');
 if(title.length<3||title.length>160)return say('عنوان المنشور يجب أن يكون بين 3 و160 حرف.');
 const file=$('#mediaFile')?.files[0]||(kind==='audios'?recorded:null);
 if(!file)return say('اختر ملفًا أو سجّل صوتًا');
 let url;
 try{
   validateFileSize(file);
   const type=mediaType(file,kind);
   if(!type)throw Error(kind==='videos'?'اختر ملف فيديو مدعومًا.':'اختر ملفًا صوتيًا مدعومًا.');
   if(kind==='videos'){
     uploadMessage('جارٍ التحقق من مدة الفيديو...');
     validateVideoDuration(await readVideoDuration(file));
   }
   url=await uploadFile(file,kind,type);
   await addDoc(collection(fire,kind),{title,url,author:user.displayName||'عضو مرآة',authorId:user.uid,createdAt:serverTimestamp()});
   if(kind==='audios')recorded=null;
   // Navigation happens after the action lock is released by the dispatcher.
   return {published:true};
 }catch(e){const message=uploadError(e);uploadMessage(message);say('تعذر نشر الملف: '+message);}
}
async function registerEmail(){if(!cloud)return say('إعداد Firebase غير متاح');const email=val('email'),password=$('#password')?.value||'',name=val('displayName');if(!email.includes('@')||password.length<6||name.length<2)return say('أدخل بريدًا صحيحًا وكلمة مرور من 6 أحرف على الأقل واسمًا مستعارًا');try{const result=await createUserWithEmailAndPassword(auth,email,password);user=result.user;await updateProfile(user,{displayName:name});await setDoc(doc(fire,'users',user.uid),{displayName:name,createdAt:serverTimestamp()});render()}catch(e){console.error(e);say('تعذر إنشاء الحساب: '+e.message)}}
async function loginEmail(){if(!cloud)return say('إعداد Firebase غير متاح');const email=val('email'),password=$('#password')?.value||'';if(!email||!password)return say('أدخل البريد وكلمة المرور');try{const result=await signInWithEmailAndPassword(auth,email,password);user=result.user;render()}catch(e){console.error(e);say('تعذر الدخول: '+e.message)}}
const actions={openAccount:()=>go('account'),compose:()=>{if(need())go('stories','compose')},uploadAudio:()=>{if(need())go('audio','uploadAudio')},uploadVideo:()=>{if(need())go('videos','uploadVideo')},offer:()=>{if(need())go('market','offer')},publishStory,publishChapter,postComment,publishOffer,publishAudio:()=>publishMedia('audios'),publishVideo:()=>publishMedia('videos'),startRecord,stopRecord,registerEmail,loginEmail,logout:async()=>{await signOut(auth);go('account')}};
document.addEventListener('input',e=>{
 if(e.target.id!=='storySearch')return;
 storySearch=e.target.value;
 const node=$('#storyResults');if(node)node.innerHTML=sortedStories().map((s,i)=>storyCard(s)+(i%4===3?ad():'')).join('')||empty('لا توجد نتائج مطابقة.');
});
document.addEventListener('change',e=>{
 if(e.target.id!=='storyOrder')return;
 storyOrder=e.target.value;try{localStorage.setItem('miraa.storyOrder',storyOrder)}catch{}
 render();
});
const lockedActions=new Set(['publishStory','publishChapter','postComment','publishOffer','publishAudio','publishVideo','registerEmail','loginEmail']);
document.addEventListener('click',async e=>{
 let target=e.target.closest('[data-action],[data-go]');if(!target)return;
 if(target.disabled||pendingAction)return;
 if(target.dataset.go){history=[];go(target.dataset.go);return}
 let a=target.dataset.action;
 if(actions[a]){
   const locked=lockedActions.has(a);
   if(locked){pendingAction=true;target.disabled=true;target.setAttribute('aria-busy','true')}
   let result;
   try{result=await actions[a]()}catch(error){say(uploadError(error))}
   finally{if(locked){pendingAction=false;target.disabled=false;target.removeAttribute('aria-busy')}}
   if(result?.storyId)go('stories','read',result.storyId);else if(result?.published)back();else if(a==='postComment')refreshComments();
   return;
 }
 let [op,...rest]=a.split(':');let v=rest.join(':');
 if(op==='tab'){storyTab=v;render()}else if(op==='read')go('stories','read',v);else if(op==='chapter')go('stories','chapter',v);else if(op==='addChapter')go('stories','addChapter',v);else if(op==='comments')go(section,'comments',v);else if(op==='listing')go('market','listing',v)
});
if(cloud){onAuthStateChanged(auth,u=>{user=u;if(page==='comments')render();else autoRender()});for(let name of Object.keys(data)){let q=query(collection(fire,name),orderBy('createdAt','desc'));unsubs.push(onSnapshot(q,snap=>{data[name]=snap.docs.map(d=>({id:d.id,...d.data()}));autoRender()},e=>{console.error(name,e);if(name==='stories')say('تعذر قراءة قاعدة البيانات. راجع قواعد Firestore.')}))}}render();
