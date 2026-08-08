import React, { useState, useEffect, useRef } from "react";
import { Mic, Volume2, VolumeX, X, CheckCircle2, AlertCircle, Radio } from "lucide-react";

interface MicTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MicTestModal({ isOpen, onClose }: MicTestModalProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isLoopbackEnabled, setIsLoopbackEnabled] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<string>("Click 'Start Mic Test' to verify your microphone.");

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startMicTest = async () => {
    setMicError(null);
    setMicStatus("Accessing microphone device...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = isLoopbackEnabled ? 1 : 0;
      gainNodeRef.current = gainNode;

      sourceNode.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const measureLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.floor((average / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(measureLevel);
      };

      animFrameRef.current = requestAnimationFrame(measureLevel);
      setIsTesting(true);
      setMicStatus("Microphone active! Speak into your mic to test input level.");
    } catch (err: any) {
      console.error("Mic test error:", err);
      setMicError(err.message || "Could not access microphone. Please check browser permissions.");
      setMicStatus("Microphone access failed.");
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsTesting(false);
    setAudioLevel(0);
    setMicStatus("Mic test stopped.");
  };

  const toggleLoopback = (enabled: boolean) => {
    setIsLoopbackEnabled(enabled);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.value = enabled ? 1 : 0;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startMicTest();
    } else {
      stopMicTest();
    }

    return () => {
      stopMicTest();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5">
        
        {/* Close Button */}
        <button
          onClick={() => {
            stopMicTest();
            onClose();
          }}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-sans font-semibold text-slate-900">Microphone Audio Test</h3>
            <p className="text-xs text-slate-500 font-sans">Verify your microphone stream quality</p>
          </div>
        </div>

        {micError ? (
          <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{micError}</p>
              <p className="text-[11px] text-red-600 mt-1">Make sure mic permission is allowed in your browser address bar.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* VU Level Meter */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-400 flex items-center gap-1.5">
                  <Radio className={`w-3.5 h-3.5 ${isTesting ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
                  Input Audio Level
                </span>
                <span className="font-mono text-emerald-400 font-bold">{audioLevel}%</span>
              </div>

              {/* Progress Bar with Green/Amber/Red Gradient */}
              <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    audioLevel > 80 ? "bg-red-500" : audioLevel > 40 ? "bg-amber-400" : "bg-emerald-500"
                  }`}
                  style={{ width: `${audioLevel}%` }}
                ></div>
              </div>

              {/* Status Note */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>0 dB</span>
                <span>{audioLevel > 15 ? "🟢 Signal Detected" : "⚪ Quiet / Silent"}</span>
                <span>100 dB</span>
              </div>
            </div>

            {/* Loopback Audio Switch */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-sans font-semibold text-slate-800 flex items-center gap-1.5">
                  {isLoopbackEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                  Speaker Voice Preview (Loopback)
                </span>
                <p className="text-[11px] text-slate-500">Play your mic sound directly back to your speakers</p>
              </div>
              <input
                type="checkbox"
                checked={isLoopbackEnabled}
                onChange={(e) => toggleLoopback(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Status Message */}
            <div className="flex items-center gap-2 text-xs font-sans text-slate-600 bg-emerald-50/70 border border-emerald-100 p-3 rounded-2xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{micStatus}</span>
            </div>
          </div>
        )}

        {/* Modal Controls */}
        <div className="flex gap-2.5 pt-2">
          {isTesting ? (
            <button
              onClick={stopMicTest}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-xl text-xs font-sans font-semibold transition-colors cursor-pointer"
            >
              Pause Test
            </button>
          ) : (
            <button
              onClick={startMicTest}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-sans font-semibold transition-colors cursor-pointer"
            >
              Start Mic Test
            </button>
          )}

          <button
            onClick={() => {
              stopMicTest();
              onClose();
            }}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl text-xs font-sans font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
