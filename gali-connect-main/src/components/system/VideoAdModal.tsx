import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Volume2, VolumeX, Play, Pause, X, ExternalLink, Sparkles, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VideoAdData {
  id: string;
  title: string;
  subtitle?: string | null;
  video_url: string;
  thumbnail_url?: string | null;
  cta_text?: string | null;
  cta_link?: string | null;
  display_mode?: string;
  duration?: number;
}

interface VideoAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoAd: VideoAdData | null;
}

export function VideoAdModal({ isOpen, onClose, videoAd }: VideoAdModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.currentTime = 0;
      setIsCompleted(false);
      videoRef.current.play().catch(() => {
        setIsMuted(true);
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
      setIsPlaying(true);
      setTimeLeft(videoAd?.duration || 30);
    }
  }, [isOpen, videoAd]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const dur = videoRef.current.duration || videoAd?.duration || 30;
    const pct = Math.min(100, (current / dur) * 100);
    setProgress(pct);
    setTimeLeft(Math.max(0, Math.ceil(dur - current)));
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setIsCompleted(true);
    setProgress(100);
    setTimeLeft(0);
  };

  if (!videoAd) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-zinc-950 border-zinc-800 text-white shadow-[0_0_80px_rgba(16,185,129,0.25)] rounded-3xl">
        <DialogTitle className="sr-only">{videoAd.title || "Video Advertisement"}</DialogTitle>
        <div className="relative aspect-video w-full bg-black group overflow-hidden">
          <video
            ref={videoRef}
            src={videoAd.video_url}
            poster={videoAd.thumbnail_url || undefined}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            playsInline
            autoPlay
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />

          {/* Top Bar Overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Sparkles className="h-3 w-3 animate-pulse" /> 30s Ad
              </span>
              <span className="text-xs font-semibold text-zinc-200 backdrop-blur-md bg-black/50 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {isCompleted ? "Ad Completed" : `${timeLeft}s remaining`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="h-9 px-3 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white flex items-center gap-2 backdrop-blur-md transition-all active:scale-95 text-xs font-semibold"
                title={isMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="h-4 w-4 text-amber-400" />
                    <span>Unmute</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_100ms] h-full" />
                      <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_200ms] h-2/3" />
                      <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_300ms] h-full" />
                      <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite_400ms] h-1/2" />
                    </span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white grid place-items-center backdrop-blur-md transition-all active:scale-95"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause Overlay */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 grid place-items-center bg-black/50 cursor-pointer z-10 animate-in fade-in duration-200"
            >
              <div className="h-16 w-16 rounded-full bg-emerald-500/30 backdrop-blur-md border border-emerald-400/50 grid place-items-center shadow-2xl transition hover:scale-110">
                <Play className="h-8 w-8 text-white fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Incentive Banner Overlay */}
          <div className="absolute top-14 left-4 right-4 z-10 pointer-events-none">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-400/30 text-amber-300 text-[11px] font-bold shadow-lg">
              <Gift className="h-3.5 w-3.5 text-amber-400 animate-bounce" />
              Watch 30s ad to unlock exclusive deals!
            </div>
          </div>

          {/* Progress Track Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20 z-30">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Modal Bottom Conversion Footer */}
        <div className="p-5 sm:p-6 bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-800/80">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-bold text-white truncate">
                {videoAd.title || "Video Advertisement"}
              </h3>
              {isCompleted && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Unlocked ✓
                </span>
              )}
            </div>
            {videoAd.subtitle && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{videoAd.subtitle}</p>
            )}
          </div>

          {videoAd.cta_link ? (
            <a
              href={videoAd.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm px-6 py-3.5 shadow-lg shadow-emerald-500/25 transition-all active:scale-95 animate-pulse"
            >
              {videoAd.cta_text || "Claim Offer Now"} <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <Button
              onClick={onClose}
              className="shrink-0 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold px-6 py-3.5"
            >
              {videoAd.cta_text || "Claim Offer Now"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
