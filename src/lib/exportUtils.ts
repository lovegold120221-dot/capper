import { Subtitle } from './gemini';

export interface ExportOptions {
  videoUrl: string;
  bgAudioUrl: string | null;
  subtitles: Subtitle[];
  title: string;
  subFont: 'sans' | 'serif' | 'mono';
  subPos: 'center' | 'bottom';
  resolution: '720p' | '1080p';
  format: string;
  onProgress: (progress: number) => void;
}

export async function exportVideo(options: ExportOptions): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const width = options.resolution === '1080p' ? 1080 : 720;
      const height = options.resolution === '1080p' ? 1920 : 1280;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot get canvas context');

      const video = document.createElement('video');
      video.src = options.videoUrl;
      if (!options.videoUrl.startsWith('blob:')) {
        video.crossOrigin = 'anonymous';
      }
      video.muted = false; 
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      let bgAudio: HTMLAudioElement | null = null;
      if (options.bgAudioUrl) {
        bgAudio = new Audio(options.bgAudioUrl);
        if (!options.bgAudioUrl.startsWith('blob:')) {
          bgAudio.crossOrigin = 'anonymous';
        }
        bgAudio.loop = true;
      }

      await new Promise<void>((res, rej) => {
        video.onloadeddata = () => res();
        video.onerror = () => rej(new Error('Failed to load video'));
        video.load();
      });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      await audioCtx.resume();
      
      const destCtx = audioCtx.createMediaStreamDestination();
      const videoSource = audioCtx.createMediaElementSource(video);
      videoSource.connect(destCtx); 

      if (bgAudio) {
        const bgSource = audioCtx.createMediaElementSource(bgAudio);
        const bgGain = audioCtx.createGain();
        bgGain.gain.value = 0.15;
        bgSource.connect(bgGain);
        bgGain.connect(destCtx);
      }

      const streamFrameRate = 30;
      const stream = (canvas as any).captureStream(streamFrameRate) as MediaStream;
      destCtx.stream.getAudioTracks().forEach((t: MediaStreamTrack) => stream.addTrack(t));

      let mimeType = 'video/webm;codecs=vp8,opus';
      if (options.format === 'MP4' && MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        audioCtx.close();
        video.remove();
        bgAudio && bgAudio.pause();
        resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.start(100); 
      await video.play();
      if (bgAudio) await bgAudio.play().catch(e => console.warn('BGM fail', e));

      const drawFrame = () => {
        if (video.ended) {
          recorder.stop();
          return;
        }

        options.onProgress(video.currentTime / (video.duration || 1));

        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(0, 0, width, height);

        const canvasRatio = width / height;
        const videoRatio = video.videoWidth / (video.videoHeight || 1);
        let drawW, drawH, drawX, drawY;
        if (videoRatio > canvasRatio) {
          drawH = height;
          drawW = video.videoWidth * (height / video.videoHeight);
          drawX = (width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = width;
          drawH = video.videoHeight * (width / video.videoWidth);
          drawX = 0;
          drawY = (height - drawH) / 2;
        }
        ctx.drawImage(video, drawX, drawY, drawW, drawH);

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(0,0,0,0.6)');
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        if (options.title) {
          ctx.save();
          const leftMargin = width * 0.1;
          let y = height * 0.15;
          ctx.font = `italic 900 ${Math.floor(width * 0.11)}px sans-serif`;
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetY = 6;
          
          const words = options.title.trim().split(/\s+/);
          if (words.length > 1) {
            const lastWord = words.pop();
            ctx.fillStyle = 'white';
            ctx.fillText(words.join(' ').toUpperCase(), leftMargin, y);
            y += width * 0.11;
            ctx.fillStyle = '#FFD700';
            ctx.fillText(lastWord!.toUpperCase(), leftMargin, y);
          } else if (words.length === 1 && words[0]) {
            ctx.fillStyle = 'white';
            ctx.fillText(words[0].toUpperCase(), leftMargin, y);
          }
          ctx.fillStyle = 'white';
          ctx.fillRect(leftMargin, y + width * 0.14, width * 0.12, 8);
          ctx.restore();
        }

        const curTime = video.currentTime;
        const activeSub = options.subtitles.find(s => curTime >= s.start && curTime <= s.end);
        
        if (activeSub) {
          ctx.save();
          const fontSize = Math.floor(width * 0.08); 
          const subY = options.subPos === 'center' ? height * 0.5 : height * 0.78;
          
          let fontName = 'sans-serif';
          let fontStyle = 'normal';
          if (options.subFont === 'serif') { fontName = 'serif'; fontStyle = 'italic'; }
          else if (options.subFont === 'mono') { fontName = 'monospace'; }
          else { fontStyle = 'italic'; }
          
          ctx.font = `${fontStyle} 900 ${fontSize}px ${fontName}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const text = activeSub.text.toUpperCase();
          const textWidth = ctx.measureText(text).width;
          
          ctx.translate(width/2, subY);
          ctx.rotate(-2 * Math.PI / 180);
          
          const padX = width * 0.04;
          const padY = width * 0.03;
          
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 8;
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(-textWidth/2 - padX, -fontSize/2 - padY, textWidth + padX*2, fontSize + padY*2);
          
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = 'black';
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }

        requestAnimationFrame(drawFrame);
      };
      requestAnimationFrame(drawFrame);
    } catch(err) {
      reject(err);
    }
  });
}
