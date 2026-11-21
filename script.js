/* ==========================================================
   Format Converter · 纯前端本地处理
   - 视频转音频：ffmpeg.wasm (单线程 core，无需 COOP/COEP)
   - 图片转换：Canvas API + toDataURL
   - 直接返回 Base64 供下载
   - 无状态、无上传、单文件、无渐变 UI
============================================================ */

(function () {
  // ---------- 常量 ----------
  const SUPPORTED_VIDEO_EXT = ['.mp4', '.avi', '.mov', '.mkv'];
  const SUPPORTED_AUDIO_FMT = ['mp3', 'wav'];
  const SUPPORTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

  // ---------- DOM ----------
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  // 视频
  const formVideo = document.getElementById('form-video');
  const inputVideo = document.getElementById('input-video');
  const btnVideo = document.getElementById('btn-video');
  const progVideo = document.getElementById('video-progress');
  const progFillVideo = document.getElementById('video-progress-fill');
  const progPercentVideo = document.getElementById('video-progress-percent');
  const progDetailVideo = document.getElementById('video-progress-detail');
  const resVideo = document.getElementById('video-result');
  const btnVideoDl = document.getElementById('btn-video-download');
  const audioPlayer = document.getElementById('audio-player');
  const vName = document.getElementById('video-out-name');
  const vFmt = document.getElementById('video-out-format');
  const vSize = document.getElementById('video-out-size');
  const errVideo = document.getElementById('video-error');
  const errMsgVideo = document.getElementById('video-error-msg');
  const btnRetryVideo = document.getElementById('btn-video-retry');

  // 图片
  const formImage = document.getElementById('form-image');
  const inputImage = document.getElementById('input-image');
  const targetFmtSel = document.getElementById('image-target-format');
  const qualityRange = document.getElementById('image-quality');
  const qualityVal = document.getElementById('image-quality-val');
  const btnImage = document.getElementById('btn-image');
  const progImage = document.getElementById('image-progress');
  const progFillImage = document.getElementById('image-progress-fill');
  const progPercentImage = document.getElementById('image-progress-percent');
  const progDetailImage = document.getElementById('image-progress-detail');
  const resImage = document.getElementById('image-result');
  const btnImageDl = document.getElementById('btn-image-download');
  const iName = document.getElementById('image-out-name');
  const iFmt = document.getElementById('image-out-format');
  const iSize = document.getElementById('image-out-size');
  const iDims = document.getElementById('image-out-dims');
  const imgPreview = document.getElementById('image-preview');
  const errImage = document.getElementById('image-error');
  const errMsgImage = document.getElementById('image-error-msg');
  const btnRetryImage = document.getElementById('btn-image-retry');

  // ---------- 工具 ----------
  const show = el => el?.classList.remove('hidden');
  const hide = el => el?.classList.add('hidden');
  const setProg = (fill, percentEl, detailEl, pct, msg) => {
    const v = Math.max(0, Math.min(100, pct));
    fill.style.width = v + '%';
    if (percentEl) percentEl.textContent = Math.round(v) + '%';
    if (detailEl) detailEl.textContent = msg;
  };
  const bytesToHuman = b => {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(2) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };
  const toDataURL = (canvas, mime, quality) => {
    try { return canvas.toDataURL(mime, quality); }
    catch { return canvas.toDataURL('image/png'); }
  };

  // ---------- Tab ----------
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
    panels.forEach(p => p.classList.add('hidden'));
    t.classList.add('active'); t.setAttribute('aria-selected', 'true');
    document.getElementById('tab-' + t.dataset.tab).classList.remove('hidden');
  }));

  // ---------- 视频转音频 ----------
  formVideo.addEventListener('submit', async e => {
    e.preventDefault();
    hide(errVideo); hide(resVideo); hide(progVideo);
    const file = inputVideo.files[0];
    if (!file) return alert('请选择视频文件');
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_VIDEO_EXT.includes(ext)) {
      errMsgVideo.textContent = '不支持的格式：' + SUPPORTED_VIDEO_EXT.join('、');
      return show(errVideo);
    }

    btnVideo.disabled = true; btnVideo.textContent = '准备中…';
    show(progVideo); setProg(progFillVideo, progPercentVideo, progDetailVideo, 5, '加载 ffmpeg.wasm…');

    try {
      // 使用全局 createFFmpeg + fetchFile（单线程 core，无需 COOP/COEP）
      const { createFFmpeg } = FFmpeg;
const ffmpeg = createFFmpeg({ 
  log: true,
  coreURL: 'core.wasm'
});

setProg(progFillVideo, progPercentVideo, progDetailVideo, 15, '下载 core…');
await ffmpeg.load();

      setProg(progFillVideo, progPercentVideo, progDetailVideo, 35, '写入视频文件…');
      ffmpeg.FS('writeFile', 'input' + ext, await fetchFile(file));

      const outFmt = document.querySelector('input[name="audio-format"]:checked').value;
      const outExt = outFmt === 'mp3' ? 'mp3' : 'wav';

      setProg(progFillVideo, progPercentVideo, progDetailVideo, 55, '转码音频…');
      await ffmpeg.run('-i', 'input' + ext, '-vn', '-acodec', outFmt, '-y', 'output.' + outExt);

      setProg(progFillVideo, progPercentVideo, progDetailVideo, 90, '读取结果…');
      const data = ffmpeg.FS('readFile', 'output.' + outExt);
      const blob = new Blob([data.buffer], { type: 'audio/' + outFmt });
      const url = URL.createObjectURL(blob);

      // 结果展示
      show(resVideo);
      btnVideoDl.href = url; btnVideoDl.download = 'audio.' + outExt; btnVideoDl.textContent = '下载音频';
      vName.textContent = 'audio.' + outExt;
      vFmt.textContent = outFmt.toUpperCase();
      vSize.textContent = bytesToHuman(blob.size);
      audioPlayer.src = url; audioPlayer.load();

      setProg(progFillVideo, progPercentVideo, progDetailVideo, 100, '完成');
    } catch (err) {
      console.error(err);
      errMsgVideo.textContent = '转换失败：' + (err?.message || err);
      show(errVideo);
    } finally {
      btnVideo.disabled = false; btnVideo.textContent = '开始转换';
    }
  });

  // ---------- 图片格式转换 ----------
  formImage.addEventListener('submit', e => {
    e.preventDefault();
    hide(errImage); hide(resImage); hide(progImage);

    const file = inputImage.files[0];
    if (!file) return alert('请选择图片文件');
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_IMAGE_EXT.includes(ext)) {
      errMsgImage.textContent = '不支持的格式：' + SUPPORTED_IMAGE_EXT.join('、');
      return show(errImage);
    }

    const target = targetFmtSel.value;
    const quality = parseInt(qualityRange.value, 10) / 100;

    btnImage.disabled = true; btnImage.textContent = '处理中…';
    show(progImage); setProg(progFillImage, progPercentImage, progDetailImage, 5, '读取图片…');

    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      let mime, outExt;
      switch (target) {
        case 'jpg': mime = 'image/jpeg'; outExt = 'jpg'; break;
        case 'png': mime = 'image/png'; outExt = 'png'; break;
        case 'webp': mime = 'image/webp'; outExt = 'webp'; break;
        case 'bmp': mime = 'image/bmp'; outExt = 'bmp'; break;
        case 'gif': mime = 'image/gif'; outExt = 'gif'; break;
        default: mime = 'image/jpeg'; outExt = 'jpg';
      }

      const dataUrl = toDataURL(canvas, mime, quality);
      const byteLen = Math.round((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75); // base64 -> byte

      show(resImage);
      btnImageDl.href = dataUrl; btnImageDl.download = 'converted.' + outExt; btnImageDl.textContent = '下载图片';
      iName.textContent = 'converted.' + outExt;
      iFmt.textContent = outExt.toUpperCase();
      iSize.textContent = bytesToHuman(byteLen);
      iDims.textContent = canvas.width + ' × ' + canvas.height + ' px';
      imgPreview.src = dataUrl;

      setProg(progFillImage, progPercentImage, progDetailImage, 100, '完成');
      btnImage.disabled = false; btnImage.textContent = '开始转换';
    };
    img.onerror = err => {
      URL.revokeObjectURL(objUrl);
      errMsgImage.textContent = '无法加载图片：' + (err?.message || err);
      show(errImage);
      btnImage.disabled = false; btnImage.textContent = '开始转换';
    };
    img.src = objUrl;
  });

  // 质量滑块显示
  qualityRange.addEventListener('input', () => {
    qualityVal.textContent = qualityRange.value + '%';
  });

  // 重试
  btnRetryVideo.addEventListener('click', () => { hide(errVideo); hide(resVideo); hide(progVideo); formVideo.reset(); });
  btnRetryImage.addEventListener('click', () => { hide(errImage); hide(resImage); hide(progImage); formImage.reset(); });
})();
