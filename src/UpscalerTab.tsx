import React, { useState } from 'react';
import { Upload, Wand2, Download, Play, Loader2 } from 'lucide-react';

export default function UpscalerTab() {
  const [file, setFile] = useState<File | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUpscaledUrl(null);
      setProgress(0);
    }
  };

  const handleUpscale = () => {
    if (!file) return;
    setIsUpscaling(true);
    setProgress(0);

    // Mock upscaling process
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUpscaling(false);
          setUpscaledUrl(URL.createObjectURL(file)); // Fallback to original
          return 100;
        }
        return prev + 5;
      });
    }, 200);
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-3xl font-black italic tracking-tight text-white mb-2">Video <span className="text-[#FFD700]">Upscaler</span></h2>
          <p className="text-white/50 text-sm font-medium uppercase tracking-widest">Enhance resolution and clarity using AI models.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700]">1. Source Material</h3>
            <div className="border-2 border-dashed border-white/10 rounded-xl p-10 bg-white/5 flex flex-col items-center justify-center gap-4 relative group hover:border-[#FFD700]/50 transition-colors min-h-[300px]">
              <input
                type="file"
                accept="video/*"
                onChange={handleUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Upload className="w-8 h-8 opacity-40 group-hover:opacity-100 group-hover:text-[#FFD700] transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white mb-1">{file ? file.name : "Drag & Drop Video"}</p>
                <p className="text-[10px] uppercase tracking-widest opacity-40">MP4, WEBM, MOV up to 500MB</p>
              </div>
            </div>
            
            <button
              onClick={handleUpscale}
              disabled={!file || isUpscaling}
              className="w-full bg-[#FFD700] hover:bg-[#FFD700]/80 disabled:bg-white/10 disabled:text-white/30 text-black font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isUpscaling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Upscaling ({progress}%)
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Enhance Quality
                </>
              )}
            </button>
            
            {isUpscaling && (
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#FFD700] transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#FFD700]">2. Upgraded Output</h3>
            <div className="border border-white/10 rounded-xl bg-black flex flex-col items-center justify-center relative overflow-hidden min-h-[300px] shadow-2xl">
              {upscaledUrl ? (
                <video src={upscaledUrl} controls className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-30">
                  <Play className="w-12 h-12" />
                  <p className="text-[10px] uppercase tracking-widest font-bold">Preview will appear here</p>
                </div>
              )}
            </div>

            {upscaledUrl && (
              <a 
                href={upscaledUrl}
                download="upscaled_video.mp4"
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Result
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
