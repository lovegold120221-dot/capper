import React, { useState } from 'react';
import { Loader2, Video, Download, Image as ImageIcon } from 'lucide-react';
import { generateThumbnail } from './lib/exportUtils';

interface ThumbnailTabProps {
  videoUrl: string | null;
}

export default function ThumbnailTab({ videoUrl }: ThumbnailTabProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!videoUrl) return;
    setIsGenerating(true);
    try {
      const dataUrl = await generateThumbnail(videoUrl);
      setThumbnailUrl(dataUrl);
    } catch (e) {
      console.error(e);
      alert("Failed to generate thumbnail");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!thumbnailUrl) return;
    const a = document.createElement('a');
    a.href = thumbnailUrl;
    a.download = `thumbnail_hook_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto pb-[90px] md:pb-8">
      <div className="max-w-4xl mx-auto w-full space-y-6 md:space-y-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tight text-white mb-2">Thumbnail <span className="text-[#FFD700]">Generator</span></h2>
          <p className="text-white/50 text-[10px] md:text-sm font-medium uppercase tracking-widest leading-relaxed">Generate viral hooks and eye-catching thumbnails based on your movie recap.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[24px] p-8 flex flex-col items-center justify-center text-center gap-4 hover:border-[#FFD700]/50 transition-colors">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                <ImageIcon className="w-8 h-8 text-[#FFD700]" />
              </div>
              <h3 className="text-white font-bold tracking-widest uppercase text-sm">Generate Thumbnail</h3>
              <p className="text-white/40 text-xs">AI will analyze a frame from your video and create a viral hook text layered over a high-contrast thumbnail.</p>
              
              <button 
                onClick={handleGenerate}
                disabled={!videoUrl || isGenerating}
                className="mt-4 text-xs tracking-widest uppercase font-bold text-black bg-[#FFD700] hover:bg-[#FFD700]/90 px-8 py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full max-w-[240px]"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Video className="w-4 h-4" />}
                {isGenerating ? 'Generating...' : 'Generate New'}
              </button>
            </div>
            
            {!videoUrl && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400 text-xs text-center font-bold tracking-widest uppercase">Please select a source video in the Caption tab first.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center bg-black/40 rounded-[24px] border border-white/10 p-4 min-h-[400px] aspect-[9/16] relative overflow-hidden mx-auto w-full max-w-sm">
            {thumbnailUrl ? (
              <>
                <img src={thumbnailUrl} alt="Generated Thumbnail" className="w-full h-full object-contain rounded-xl" />
                <button 
                  onClick={handleDownload}
                  className="absolute bottom-6 right-6 bg-[#FFD700] text-black p-3 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] hover:scale-110 active:scale-95 transition-all"
                  title="Download File"
                >
                  <Download className="w-6 h-6" />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center opacity-30 gap-4">
                <ImageIcon className="w-16 h-16" />
                <p className="text-xs uppercase tracking-widest font-bold">No Thumbnail Yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
