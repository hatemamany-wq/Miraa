// Pure validation helpers shared by the UI and the regression checks.
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
export function mediaType(file, kind) {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith(kind === 'videos' ? 'video/' : 'audio/')) return type;
  // Some iPhone exports have no MIME type. Use only recognized extensions then.
  if (type && type !== 'application/octet-stream') return '';
  const extension = (file.name || '').split('.').pop().toLowerCase();
  const types = kind === 'videos'
    ? {mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm'}
    : {mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',wav:'audio/wav',webm:'audio/webm',ogg:'audio/ogg',aac:'audio/aac'};
  return types[extension] || '';
}
export function validateFileSize(file) {
  if (!file || !file.size) throw Error('الملف فارغ. اختر ملفًا آخر.');
  if (file.size > MAX_UPLOAD_BYTES) throw Error('الحد التجريبي للملف 30 ميجابايت.');
}
export function validateVideoDuration(seconds) {
  if (!Number.isFinite(seconds)) throw Error('تعذّر تحديد مدة الفيديو. جرّب تصديره بصيغة MP4.');
  if (seconds < 5 || seconds > 180) throw Error('مدة الفيديو يجب أن تكون من 5 ثوانٍ إلى 3 دقائق.');
}
export function readVideoDuration(file, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let timer;
    const finish = (error) => {
      const seconds = video.duration;
      clearTimeout(timer);
      video.onloadedmetadata = video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      error ? reject(error) : resolve(seconds);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => finish();
    video.onerror = () => finish(Error('المتصفح لم يستطع قراءة الفيديو. جرّب MP4 بترميز H.264.'));
    timer = setTimeout(() => finish(Error('انتهت مهلة قراءة الفيديو. جرّب ملفًا آخر.')), timeoutMs);
    video.src = url;
    video.load();
  });
}
