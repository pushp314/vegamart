import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Volume2, VolumeX, Play, Pause, X, ExternalLink, Sparkles } from "lucide-react";
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

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        // If browser blocks unmuted autoplay, mute and try again
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

  if (!videoAd) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-zinc-950 border-zinc-800 text-white shadow-2xl rounded-3xl">
        <DialogTitle className="sr-only">{videoAd.title || "Video Advertisement"}</DialogTitle>
        <div className="relative aspect-video w-full bg-black group overflow-hidden">
          <video
            ref={videoRef}
            src={videoAd.video_url}
            poster={videoAd.thumbnail_url || undefined}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
            autoPlay
            className="w-full h-full object-contain cursor-pointer"
            onClick={togglePlay}
          />

          {/* Top Bar Overlay */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Sparkles className="h-3 w-3 animate-pulse" /> 30s Ad
              </span>
              <span className="text-xs font-semibold text-zinc-300 backdrop-blur-md bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
                {timeLeft}s remaining
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 text-white grid place-items-center backdrop-blur-md transition-all active:scale-95"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-amber-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
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

          {/* Center Play Button when paused */}
          {!isPlaying && (
            <div
              onClick={togglePlay}
              className="absolute inset-0 grid place-items-center bg-black/40 cursor-pointer z-10 animate-in fade-in duration-200"
            >
              <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 grid place-items-center shadow-2xl transition hover:scale-110">
                <Play className="h-8 w-8 text-white fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Modal Bottom Section */}
        <div className="p-5 sm:p-6 bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-800">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-white truncate">{videoAd.title}</h3>
            {videoAd.subtitle && (
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{videoAd.subtitle}</p>
            )}
          </div>

          {videoAd.cta_link ? (
            <a
              href={videoAd.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm px-6 py-3 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {videoAd.cta_text || "Explore Offer"} <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <Button
              onClick={onClose}
              className="shrink-0 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold"
            >
              {videoAd.cta_text || "Got it!"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
