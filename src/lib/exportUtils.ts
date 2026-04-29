import { Subtitle, generateThumbnailHook } from './gemini';

export interface ExportOptions {
  videoUrl: string;
  bgAudioUrl: string | null;
  subtitles: Subtitle[];
  title: string;
  subSettings: {
    font: string;
    size: 'sm' | 'md' | 'lg' | 'xl';
    style: 'block' | 'stroke' | 'karaoke';
    position: 'bottom' | 'center' | 'top';
  };
  resolution: '720p' | '1080p';
  format: string;
  onProgress: (progress: number) => void;
}

export async function generateThumbnail(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    if (!videoUrl.startsWith('blob:')) {
      video.crossOrigin = 'anonymous';
    }
    video.muted = true;
    
    video.onloadeddata = () => {
      // seek to 1/3 of the video
      video.currentTime = (video.duration || 10) * 0.33;
    };

    video.onseeked = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        ctx.fillStyle = '#0a0a0b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const canvasRatio = canvas.width / canvas.height;
        const videoRatio = video.videoWidth / (video.videoHeight || 1);
        let drawW, drawH, drawX, drawY;
        if (videoRatio > canvasRatio) {
          drawH = canvas.height;
          drawW = video.videoWidth * (canvas.height / video.videoHeight);
          drawX = (canvas.width - drawW) / 2;
          drawY = 0;
        } else {
          drawW = canvas.width;
          drawH = video.videoHeight * (canvas.width / video.videoWidth);
          drawX = 0;
          drawY = (canvas.height - drawH) / 2;
        }
        ctx.drawImage(video, drawX, drawY, drawW, drawH);

        // Get base64 for Gemini Vision
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        let hookText = "WATCH NOW!";
        try {
          hookText = await generateThumbnailHook(base64Image);
        } catch (e) {
          console.error("AI Hook generation failed", e);
        }

        // Draw overlay gradient
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, 'rgba(0,0,0,0.1)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Hook Text
        ctx.save();
        const width = canvas.width;
        const height = canvas.height;
        ctx.translate(width/2, height * 0.75);
        ctx.rotate(-4 * Math.PI / 180);

        ctx.font = `italic 900 ${Math.floor(width * 0.18)}px Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = hookText.toUpperCase();
        
        // Stroke
        ctx.shadowColor = '#FF0055';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = width * 0.05;
        ctx.strokeText(text, 0, 0);

        // Gradient Fill
        const textGrad = ctx.createLinearGradient(0, -height*0.1, 0, height*0.1);
        textGrad.addColorStop(0, '#FFFFFF');
        textGrad.addColorStop(0.5, '#FFD700');
        textGrad.addColorStop(1, '#FF4500');
        ctx.fillStyle = textGrad;
        
        ctx.shadowColor = 'transparent';
        ctx.fillText(text, 0, 0);
        
        // Add minimal highlight inside
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = width * 0.005;
        ctx.strokeText(text, -2, -2);
        
        ctx.restore();

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => reject(new Error('Failed to load video for thumbnail'));
  });
}

function addAutoBGM(audioCtx: AudioContext, destination: AudioNode, duration: number) {
  const chords = [
    [261.63, 329.63, 392.00], // C4, E4, G4
    [220.00, 261.63, 329.63], // A3, C4, E4
    [174.61, 220.00, 261.63], // F3, A3, C4
    [196.00, 246.94, 293.66], // G3, B3, D4
  ];
  
  for (let i = 0; i < duration; i += 4) {
     const chord = chords[Math.floor(i / 4) % chords.length];
     chord.forEach((freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime + i);
        gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + i + 2);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + i + 4);
        
        osc.connect(gain);
        gain.connect(destination);
        
        osc.start(audioCtx.currentTime + i);
        osc.stop(audioCtx.currentTime + i + 4);
     });
  }
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
      } else {
        const duration = video.duration || 60;
        addAutoBGM(audioCtx, destCtx, duration);
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
          const { font, size, style, position } = options.subSettings;
          
          const sizeMap = { sm: 0.05, md: 0.08, lg: 0.11, xl: 0.14 };
          const fontSize = Math.floor(width * sizeMap[size]);
          
          let subY = height * 0.78;
          if (position === 'center') subY = height * 0.5;
          if (position === 'top') subY = height * 0.25;
          
          let fontName = 'sans-serif';
          let fontStyle = 'normal';
          let fontWeight = '900';
          
          if (font === 'serif') { fontName = 'serif'; fontStyle = 'italic'; }
          else if (font === 'mono') { fontName = 'monospace'; }
          else if (font === 'impact') { fontName = 'Impact, sans-serif'; fontStyle = 'italic'; }
          else { fontStyle = 'italic'; }
          
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontName}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const text = activeSub.text.toUpperCase();
          const textWidth = ctx.measureText(text).width;
          
          ctx.translate(width/2, subY);
          // slight tilt
          ctx.rotate(-2 * Math.PI / 180);
          
          const padX = width * 0.04;
          const padY = width * 0.03;
          
          if (style === 'block') {
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 8;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-textWidth/2 - padX, -fontSize/2 - padY, textWidth + padX*2, fontSize + padY*2);
            
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'black';
            ctx.fillText(text, 0, 0);
          } else if (style === 'stroke') {
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 5;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = fontSize * 0.15;
            ctx.strokeText(text, 0, 0);
            
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = 'white';
            ctx.fillText(text, 0, 0);
          } else if (style === 'karaoke') {
             // Karaoke Logic
             const words = text.split(' ');
             const duration = activeSub.end - activeSub.start;
             const elapsed = curTime - activeSub.start;
             const progress = Math.max(0, Math.min(1, elapsed / duration));
             
             ctx.shadowColor = 'rgba(0,0,0,0.9)';
             ctx.shadowBlur = 10;
             ctx.shadowOffsetY = 5;
             
             // Draw background text (grayed out)
             ctx.strokeStyle = 'black';
             ctx.lineWidth = fontSize * 0.15;
             ctx.strokeText(text, 0, 0);
             ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
             ctx.fillText(text, 0, 0);
             
             // Draw filled text clipped by progress
             ctx.save();
             ctx.beginPath();
             ctx.rect(-textWidth/2 - padX, -fontSize, (textWidth + padX * 2) * progress, fontSize * 2);
             ctx.clip();
             
             ctx.strokeStyle = 'black';
             ctx.lineWidth = fontSize * 0.15;
             ctx.strokeText(text, 0, 0);
             ctx.fillStyle = '#FFD700';
             ctx.fillText(text, 0, 0);
             
             ctx.restore();
          }
          
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
