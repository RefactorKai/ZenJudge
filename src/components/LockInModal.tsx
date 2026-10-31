import React, { useEffect, useState, useRef } from 'react';
import { LockInStatus } from '../types';
import { Shield, ShieldAlert, AlertTriangle, X } from 'lucide-react';

interface LockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLockIn: () => void;
  lockInStatus: LockInStatus;
  abortHoldProgress: number; // 0 to 100
}

export const LockInModal: React.FC<LockInModalProps> = ({
  isOpen,
  onClose,
  onConfirmLockIn,
  lockInStatus,
  abortHoldProgress,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-zen-900 border border-zen-700/80 rounded-xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zen-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Arm "Lock-In" Kiosk Mode</h2>
            <p className="text-xs text-zen-400">SEB-Lite distraction-free lockdown</p>
          </div>
        </div>

        <div className="bg-zen-950 p-4 rounded-lg border border-zen-800 space-y-2.5 text-xs text-zen-300">
          <div className="flex items-start space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
            <p><strong>Window Constraints:</strong> Pins window on top, enters fullscreen, and strips window borders.</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
            <p><strong>Focus Hook & Strike:</strong> If you Alt+Tab or lose window focus, a strike breach is recorded to local SQLite and your editor is temporarily locked.</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
            <p><strong>Emergency Abort:</strong> Press and hold <kbd className="bg-zen-800 px-1 rounded text-[11px] font-mono text-white">Ctrl + Shift + Q</kbd> for <strong>3 seconds</strong> to break lockdown and log a forfeit.</p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded text-xs text-zen-400 hover:text-white border border-zen-800 hover:bg-zen-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              onConfirmLockIn();
            }}
            className="px-4 py-1.5 rounded text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-600/30"
          >
            Engage Lockdown
          </button>
        </div>
      </div>
    </div>
  );
};

export const EmergencyAbortOverlay: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-950/90 border border-rose-600 text-rose-200 px-5 py-3 rounded-xl shadow-2xl flex flex-col items-center space-y-2 animate-fadeIn select-none">
      <div className="flex items-center space-x-2 text-xs font-bold text-rose-300">
        <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
        <span>HOLDING EMERGENCY ABORT (CTRL+SHIFT+Q)</span>
      </div>
      <div className="w-64 h-2.5 bg-rose-900/60 rounded-full overflow-hidden border border-rose-700/60">
        <div
          className="h-full bg-rose-500 transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-rose-400 font-mono">
        Release to cancel abort. Breaking lockdown forfeits attempt.
      </span>
    </div>
  );
};
