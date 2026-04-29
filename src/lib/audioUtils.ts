export async function extractAudioBase64(file: File): Promise<string> {
  const fileArrayBuffer = await file.arrayBuffer();
  // decode using AudioContext
  const ctx = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await ctx.decodeAudioData(fileArrayBuffer);
  
  const wavBytes = audioBufferToWav(audioBuffer);
  return arrayBufferToBase64(wavBytes);
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const result = new Float32Array(buffer.length);
  // Mixdown to mono if multiple channels
  if (buffer.numberOfChannels > 1) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < buffer.length; i++) {
          result[i] = (left[i] + right[i]) / 2;
      }
  } else {
      result.set(buffer.getChannelData(0));
  }

  const length = result.length * (bitDepth / 8);
  const bufferWAV = new ArrayBuffer(44 + length);
  const view = new DataView(bufferWAV);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  
  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1size
  view.setUint16(20, format, true); // audio format
  view.setUint16(22, numChannels, true); // num channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // byte rate
  view.setUint16(32, numChannels * (bitDepth / 8), true); // block align
  view.setUint16(34, bitDepth, true); // bits per sample
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);
  
  // write PCM samples
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, result[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
  }
  
  return bufferWAV;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  // process in chunks to avoid max call stack size exceeded natively
  for (let i = 0; i < len; i += 8192) {
      const chunk = bytes.subarray(i, i + 8192);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}
