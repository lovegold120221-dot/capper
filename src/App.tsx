import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Save, Loader2, Music, Video, Type as TypeIcon, X, Download, Settings } from 'lucide-react';
import { extractAudioBase64 } from './lib/audioUtils';
import { generateSubtitles, Subtitle } from './lib/gemini';
import { motion, AnimatePresence } from 'motion/react';

function KaraokeText({ subtitle, currentTime }: { subtitle: Subtitle, currentTime: number }) {
  const duration = subtitle.end - subtitle.start;
  const elapsed = currentTime - subtitle.start;
  const progress = Math.min(1, Math.max(0, elapsed / duration));
  
  return (
    <span className="relative inline-block transform -rotate-2 uppercase font-black" style={{ WebkitTextStroke: '3px black' }}>
      <span className="text-white/40 drop-shadow-xl">{subtitle.text}</span>
      <span 
        className="absolute left-0 top-0 text-[#FFD700] overflow-hidden whitespace-nowrap drop-shadow-[0_2px_10px_rgba(255,215,0,0.5)]"
        style={{ width: `${progress * 100}%` }}
      >
        {subtitle.text}
      </span>
    </span>
  );
}

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [bgAudioFile, setBgAudioFile] = useState<File | null>(null);
  const [bgAudioUrl, setBgAudioUrl] = useState<string | null>(null);
  
  const [title, setTitle] = useState("Power of Identity");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportResolution, setExportResolution] = useState("1080p");
  const [exportFormat, setExportFormat] = useState("MP4");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  // Subtitle Settings
  const [subSettings, setSubSettings] = useState(() => {
    const saved = localStorage.getItem('captionSyncSettings');
    return saved ? JSON.parse(saved) : {
      font: 'sans',
      size: 'md',
      style: 'block', // 'block', 'stroke', 'karaoke'
      position: 'bottom',
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('captionSyncSettings', JSON.stringify(subSettings));
  }, [subSettings]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);

  // Handle Video Upload
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setSubtitles([]);
    }
  };

  // Handle BGM Upload
  const handleBgAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBgAudioFile(file);
      setBgAudioUrl(URL.createObjectURL(file));
    }
  };

  // Generation Flow
  const handleGenerate = async () => {
    if (!videoFile) return;
    setIsGenerating(true);
    try {
      const base64Audio = await extractAudioBase64(videoFile);
      const generatedSubtitles = await generateSubtitles(base64Audio);
      setSubtitles(generatedSubtitles);
      // Reset play state
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to generate subtitles.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Video & BGM Sync Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const bgAudio = bgAudioRef.current;

    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      if (bgAudio) {
        if (!isNaN(bgAudio.duration) && bgAudio.duration > 0) {
          bgAudio.currentTime = video.currentTime % bgAudio.duration;
        } else {
          bgAudio.currentTime = video.currentTime;
        }
        bgAudio.play().catch(() => {});
      }
    };

    const onPause = () => {
      setIsPlaying(false);
      if (bgAudio) {
        bgAudio.pause();
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onSeeked = () => {
      if (bgAudio) {
        if (!isNaN(bgAudio.duration) && bgAudio.duration > 0) {
          bgAudio.currentTime = video.currentTime % bgAudio.duration;
        } else {
          bgAudio.currentTime = video.currentTime;
        }
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoUrl, bgAudioUrl]);

  // Adjust background audio volume to be slight
  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = 0.15; // "Slight lang na background music"
    }
  }, [bgAudioUrl]);

  // Find currently active subtitle
  const activeSubtitle = subtitles.find(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  );

  const handleExport = async () => {
    if (!videoUrl) return;
    setIsExporting(true);
    setExportProgress(0);
    try {
      const { exportVideo } = await import('./lib/exportUtils');
      const blob = await exportVideo({
        videoUrl,
        bgAudioUrl,
        subtitles,
        title,
        subSettings,
        resolution: exportResolution as '720p' | '1080p',
        format: exportFormat,
        onProgress: (p) => setExportProgress(p)
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      a.download = `caption_sync_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Export failed: " + (err as Error).message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const renderSubtitles = () => {
    const { font, size, style } = subSettings;
    
    let fontClass = 'font-sans';
    let addedClasses = 'italic';
    if (font === 'serif') fontClass = 'font-serif';
    if (font === 'mono') { fontClass = 'font-mono'; addedClasses = 'uppercase'; }
    if (font === 'impact') { fontClass = 'font-sans opacity-90'; addedClasses = 'uppercase tracking-tighter'; }

    const sizeMap: Record<string, string> = { sm: 'text-xl md:text-2xl', md: 'text-2xl md:text-3xl', lg: 'text-4xl md:text-5xl', xl: 'text-5xl md:text-7xl' };
    const fontSizeClass = sizeMap[size];

    return (
      <AnimatePresence mode="wait">
        {activeSubtitle && (
          <motion.div
            key={activeSubtitle.start}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            className={`${fontSizeClass} font-black ${addedClasses} tracking-tight text-center leading-snug w-full select-none ${fontClass}`}
          >
            {style === 'block' && (
              <span className="bg-[#FFD700] text-black px-3 py-1 inline-block transform -rotate-2 uppercase shadow-xl">
                {activeSubtitle.text}
              </span>
            )}
            {style === 'stroke' && (
              <span 
                className="text-white transform -rotate-2 inline-block uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
                style={{ WebkitTextStroke: '2px black' }}
              >
                {activeSubtitle.text}
              </span>
            )}
            {style === 'karaoke' && (
              <KaraokeText subtitle={activeSubtitle} currentTime={currentTime} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E8E8E8] font-sans flex flex-col selection:bg-[#FFD700]/30 selection:text-black">
      {/* Top Navigation / Header */}
      <header className="border-b border-white/10 px-8 py-4 flex justify-between items-center bg-[#0F0F11]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FFD700] rounded-sm flex items-center justify-center text-black font-black italic">S</div>
          <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">CaptionSync Pro</span>
        </div>
        <div className="flex gap-6">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            disabled={!videoFile}
            className="text-[10px] uppercase tracking-widest font-bold text-[#FFD700] border border-[#FFD700]/30 px-4 py-2 rounded-full hover:bg-[#FFD700]/10 transition-colors disabled:opacity-30 disabled:border-white/10 disabled:text-white disabled:cursor-not-allowed"
          >
            Export Recap
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="text-[10px] flex items-center justify-center gap-1 uppercase tracking-widest font-bold opacity-70 hover:opacity-100 hover:text-[#FFD700] transition-colors">
             <Settings className="w-3 h-3" />
             Settings
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Controls */}
        <aside className="w-full lg:w-80 border-r border-white/10 p-8 flex flex-col gap-10 overflow-y-auto shrink-0 custom-scrollbar">
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700] mb-6">Source Video</h3>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 bg-white/5 flex flex-col items-center gap-3 relative group hover:border-[#FFD700]/50 transition-colors">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <Video className="w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:text-[#FFD700] transition-colors" />
              </div>
              <p className="text-[11px] font-medium opacity-60 text-center uppercase tracking-wider">
                {videoFile ? videoFile.name : "Upload Core Video"}
                <br />
                <span className="opacity-30">{videoFile ? "Ready for Sync" : "Max 60s Recap"}</span>
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700] mb-6">Text Overlay</h3>
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Prominent Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#141416] border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#FFD700] outline-none transition-all text-xs uppercase tracking-widest font-bold"
                placeholder="e.g. Power of Identity"
              />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700] mb-6">Audio Layering</h3>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 bg-white/5 flex flex-col items-center gap-3 relative group hover:border-[#FFD700]/50 transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleBgAudioUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <Music className="w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:text-[#FFD700] transition-colors" />
              </div>
              <p className="text-[11px] font-medium opacity-60 text-center uppercase tracking-wider">
                {bgAudioFile ? bgAudioFile.name : "Add Backing Track"}
                <br />
                <span className="opacity-30">{bgAudioFile ? "Track Active" : "Optional BGM"}</span>
              </p>
            </div>
            
            {/* Lyra BGM Presets */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { name: 'Lofi Study', url: 'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3' },
                { name: 'Cinematic', url: 'https://assets.mixkit.co/music/preview/mixkit-life-is-a-dream-837.mp3' },
                { name: 'Tech House', url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3' },
                { name: 'Upbeat', url: 'https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3' },
              ].map(bgm => (
                <button
                  key={bgm.name}
                  onClick={() => { setBgAudioUrl(bgm.url); setBgAudioFile(new File([], `Lyra: ${bgm.name}`)); }}
                  className="bg-white/5 hover:bg-white/10 hover:border-[#FFD700]/50 border border-white/10 rounded-md py-2 px-3 text-[9px] uppercase tracking-wider font-bold text-white transition-colors"
                >
                  Lyra: {bgm.name}
                </button>
              ))}
            </div>

            {bgAudioFile && (
              <div className="mt-6 space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] uppercase tracking-widest mb-3 opacity-60">
                    <span>BGM Overlay (Volume)</span>
                    <span>15%</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[15%] bg-[#FFD700]"></div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="mt-auto pt-8">
            <button
              onClick={handleGenerate}
              disabled={!videoFile || isGenerating}
              className="w-full bg-[#FFD700] hover:bg-[#FFD700]/80 disabled:bg-[#FFD700]/10 disabled:text-white/30 disabled:border-white/10 disabled:border disabled:cursor-not-allowed text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-full transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting Transcript...
                </>
              ) : (
                <>
                  <TypeIcon className="w-4 h-4" />
                  Generate Subtitles
                </>
              )}
            </button>
            <div className="mt-4 p-4 bg-[#FFD700]/5 border border-[#FFD700]/20 rounded-lg">
              <p className="text-[11px] leading-relaxed italic opacity-80 text-center">
                "Syncing syllables with rhythmic pulses for maximum engagement."
              </p>
            </div>
          </section>
        </aside>

        {/* Center: Video Preview (The core feature) */}
        <section className="flex-1 bg-[#141416] flex items-center justify-center relative p-8">
          <div className="h-[680px] w-[382px] bg-black rounded-[48px] border-[8px] border-[#2A2A2E] shadow-2xl relative overflow-hidden flex flex-col shrink-0 group">
            {/* Mock Video Background if no video */}
            {!videoUrl && (
              <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] flex items-center justify-center flex-col gap-4 text-white/20">
                <Video className="w-12 h-12" />
                <span className="text-[10px] uppercase tracking-widest font-bold">No Signal</span>
              </div>
            )}
            
            {videoUrl && (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  onClick={togglePlay}
                />
                
                {/* Background Audio Element */}
                {bgAudioUrl && <audio ref={bgAudioRef} src={bgAudioUrl} loop />}

                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10">
                  {/* Editorial Title (Top Area) */}
                  <div className="relative pt-16 px-8 drop-shadow-2xl">
                    <motion.h1 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-4xl font-black italic tracking-tighter text-white leading-[0.9] uppercase"
                      style={{
                        textShadow: "0px 4px 12px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,1)",
                      }}
                    >
                      {title.split(' ').map((word, idx, arr) => {
                        if (idx === arr.length - 1 && arr.length > 1) {
                          return <span key={idx}><br/><span className="text-[#FFD700]">{word}</span></span>
                        }
                        return word + " ";
                      })}
                    </motion.h1>
                    {title && <div className="w-12 h-1 bg-white mt-4 shadow-lg shadow-black"></div>}
                  </div>

                  {/* Center Placement */}
                  {subSettings.position === 'center' && (
                    <div className="absolute inset-0 flex items-center justify-center px-8 z-20 pointer-events-none mt-16">
                      {renderSubtitles()}
                    </div>
                  )}
                  
                  {/* Top Placement */}
                  {subSettings.position === 'top' && (
                    <div className="absolute inset-x-0 top-0 pt-24 flex justify-center px-8 z-20 pointer-events-none">
                      {renderSubtitles()}
                    </div>
                  )}

                  {/* Bottom: Video UI Overlays */}
                  <div className="pb-8 px-8 space-y-6 relative">
                    {/* Karaoke Subtitles */}
                    <div className="flex justify-center w-full min-h-[120px] items-end">
                      {subSettings.position === 'bottom' && renderSubtitles()}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#FFD700] transition-all duration-100 ease-linear" 
                        style={{ width: videoRef.current ? `${(currentTime / videoRef.current.duration) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Play/Pause UI Overlay */}
                  <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 pointer-events-none ${isPlaying ? "opacity-0" : "opacity-100 group-hover:opacity-100"}`}>
                    <div className="w-16 h-16 border border-white/20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1 opacity-80" fill="currentColor" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Bottom Notch Decor */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/20 rounded-full z-20"></div>
          </div>
        </section>

        {/* Right Sidebar: Live Transcription */}
        <aside className="w-full lg:w-80 border-l border-white/10 p-8 hidden xl:flex flex-col overflow-y-auto shrink-0 bg-[#0A0A0B]/50 custom-scrollbar">
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700] mb-6">Live Transcript</h3>
          <div className="space-y-6 opacity-80 flex-1">
            {subtitles.length > 0 ? (
              subtitles.map((sub, index) => {
                const isActive = currentTime >= sub.start && currentTime <= sub.end;
                return (
                  <div key={index} className="flex gap-4">
                    <span className={`text-[10px] font-mono mt-0.5 ${isActive ? 'text-[#FFD700]' : 'opacity-30 text-white'}`}>
                      {formatTime(sub.start)}
                    </span>
                    <p className={`text-[12px] leading-relaxed uppercase ${isActive ? 'font-bold text-white' : 'text-white/80'}`}>
                      {sub.text}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-[12px] leading-relaxed uppercase opacity-40">
                Upload a video and extract transcript to view the live timeline.
              </p>
            )}
          </div>

          {/* Subtitle Style Options */}
          <div className="mt-6 p-6 rounded-2xl bg-white/5 border border-[#FFD700]/20 sticky bottom-0 backdrop-blur-md space-y-6 shadow-[0_-10px_40px_rgba(255,215,0,0.05)]">
            <div className="flex items-center justify-between opacity-60">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#FFD700]">Subtitle Quick Edits</span>
              <Settings className="w-3 h-3 text-[#FFD700]" />
            </div>

            <div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSubSettings({...subSettings, font: 'sans'})}
                  className={`flex-1 rounded-lg border flex items-center justify-center text-[11px] py-1 font-sans font-bold transition-colors ${subSettings.font === 'sans' ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/20 text-white hover:bg-white/10'}`}>Aa</button>
                <button 
                  onClick={() => setSubSettings({...subSettings, font: 'serif'})}
                  className={`flex-1 rounded-lg border flex items-center justify-center text-[11px] py-1 font-serif font-black italic transition-colors ${subSettings.font === 'serif' ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/20 text-white hover:bg-white/10'}`}>Aa</button>
                <button 
                  onClick={() => setSubSettings({...subSettings, font: 'mono'})}
                  className={`flex-1 rounded-lg border flex items-center justify-center text-[11px] py-1 font-mono font-bold uppercase transition-colors ${subSettings.font === 'mono' ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/20 text-white hover:bg-white/10'}`}>Aa</button>
              </div>
            </div>

            <div>
              <div className="flex gap-2 text-[9px] uppercase tracking-widest font-bold">
                 {['block', 'stroke', 'karaoke'].map((s) => (
                    <button 
                      key={s}
                      onClick={() => setSubSettings({...subSettings, style: s as 'block'|'stroke'|'karaoke'})}
                      className={`flex-1 py-1.5 rounded border transition-colors ${subSettings.style === s ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white'}`}
                    >
                      {s}
                    </button>
                 ))}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Global styles for custom scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />

      {/* Full Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-[#141416] border border-[#FFD700]/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="border-b border-white/10 px-8 py-5 flex justify-between items-center bg-[#0F0F11]">
                <h3 className="text-[12px] uppercase tracking-[0.3em] font-bold text-[#FFD700] flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Global Subtitle Settings
                </h3>
                <button onClick={() => setIsSettingsOpen(false)} className="opacity-40 hover:opacity-100 transition-opacity">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                
                {/* Font Selector */}
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Font Family</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'sans', label: 'Sans Serif', cls: 'font-sans' },
                      { id: 'serif', label: 'Serif Italic', cls: 'font-serif italic' },
                      { id: 'mono', label: 'Monospace', cls: 'font-mono uppercase' },
                      { id: 'impact', label: 'Impact / Bold', cls: 'font-sans font-black tracking-tighter uppercase' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSubSettings({...subSettings, font: f.id})}
                        className={`py-4 px-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                          subSettings.font === f.id 
                            ? "border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]" 
                            : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30"
                        }`}
                      >
                        <span className={`text-2xl font-bold leading-none ${f.cls}`}>Aa</span>
                        <span className="text-[9px] uppercase tracking-widest font-bold">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Size */}
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Text Size</label>
                  <div className="flex gap-3">
                    {['sm', 'md', 'lg', 'xl'].map(size => (
                      <button
                        key={size}
                        onClick={() => setSubSettings({...subSettings, size: size as any})}
                        className={`flex-1 py-3 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all ${
                          subSettings.size === size 
                            ? "border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]" 
                            : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Style */}
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Design Style</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { id: 'block', name: 'Solid Block', desc: 'Yellow Background' },
                      { id: 'stroke', name: 'Text Stroke', desc: 'Outline / Drop Shadow' },
                      { id: 'karaoke', name: 'Karaoke', desc: 'Animated Word-by-Word' },
                    ].map(style => (
                      <button
                        key={style.id}
                        onClick={() => setSubSettings({...subSettings, style: style.id as any})}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          subSettings.style === style.id 
                            ? "border-[#FFD700] bg-[#FFD700]/10" 
                            : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30"
                        }`}
                      >
                        <div className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${subSettings.style === style.id ? 'text-[#FFD700]' : 'text-white'}`}>{style.name}</div>
                        <div className="text-[10px] opacity-50">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position */}
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Screen Placement</label>
                  <div className="flex gap-3">
                    {['top', 'center', 'bottom'].map(pos => (
                      <button
                        key={pos}
                        onClick={() => setSubSettings({...subSettings, position: pos as any})}
                        className={`flex-1 py-3 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all ${
                          subSettings.position === pos 
                            ? "border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]" 
                            : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30"
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div className="border-t border-white/10 p-6 bg-[#0F0F11] flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="bg-[#FFD700] text-black font-black uppercase tracking-widest text-[10px] px-8 py-3 rounded-md transition-transform hover:scale-[1.02]"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !isExporting && setIsExportModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[#141416] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#0F0F11]">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700]">Export Details</h3>
                <button 
                  onClick={() => !isExporting && setIsExportModalOpen(false)}
                  className="opacity-40 hover:opacity-100 transition-opacity disabled:opacity-20"
                  disabled={isExporting}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Resolution</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["720p", "1080p"].map(res => (
                      <button
                        key={res}
                        onClick={() => setExportResolution(res)}
                        className={`py-3 rounded-lg border text-xs font-bold tracking-widest transition-all ${
                          exportResolution === res 
                            ? "border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]" 
                            : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30"
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["MP4", "MOV"].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`py-3 rounded-lg border text-xs font-bold tracking-widest transition-all ${
                          exportFormat === fmt 
                            ? "border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]" 
                            : "border-white/10 bg-white/5 opacity-60 hover:opacity-100 hover:border-white/30"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 p-6 bg-[#0F0F11] flex justify-end gap-4">
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  disabled={isExporting}
                  className="text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity px-6 py-3 disabled:opacity-30"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExport}
                  disabled={isExporting || !videoFile}
                  className="relative bg-[#FFD700] hover:bg-[#FFD700]/80 disabled:bg-[#FFD700]/20 disabled:text-white/40 text-black font-black uppercase tracking-widest text-[10px] px-8 py-3 rounded-full transition-all flex items-center justify-center gap-2 overflow-hidden"
                >
                  {isExporting && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-[#FFD700]/40 transition-all duration-200 ease-out" 
                      style={{ width: `${exportProgress * 100}%` }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    {isExporting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {Math.round(exportProgress * 100)}%
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        Export
                      </>
                    )}
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
