// ============================================================
// src/components/FaceScanner.jsx
// Live webcam face capture with visual guidance
// ============================================================
import React, { useEffect, useState } from 'react';
import { useFaceDetection } from '../hooks/useFaceDetection';

export default function FaceScanner({ onCapture, mode = 'capture', label = 'Scan Face' }) {
  const {
    videoRef, canvasRef,
    isModelsLoaded, isCameraOn,
    faceDetected, liveness, error, isCapturing,
    startCamera, stopCamera, startDetectionLoop, captureEmbedding,
  } = useFaceDetection();

  const [status, setStatus] = useState('idle'); // idle | scanning | captured | error
  const [captureProgress, setCaptureProgress] = useState(0);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function handleStart() {
    setStatus('scanning');
    await startCamera();
    // Wait for video to load then start loop
    setTimeout(startDetectionLoop, 800);
  }

  async function handleCapture() {
    if (!faceDetected) {
      setStatus('error');
      setTimeout(() => setStatus('scanning'), 2000);
      return;
    }
    try {
      // Animate progress
      let p = 0;
      const interval = setInterval(() => {
        p += 20;
        setCaptureProgress(p);
        if (p >= 100) clearInterval(interval);
      }, 100);

      const embedding = await captureEmbedding();
      setStatus('captured');
      stopCamera();
      onCapture(embedding);
    } catch (err) {
      setStatus('error');
      setTimeout(() => setStatus('scanning'), 3000);
    }
  }

  return (
    <div className="face-scanner">
      {/* Camera Preview */}
      <div className="camera-wrapper">
        {status === 'idle' && (
          <div className="camera-placeholder flex-center flex-col" style={{ height: '100%', gap: 16 }}>
            <div style={{ fontSize: '3rem' }}>👁️</div>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Camera not started</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: status === 'idle' || status === 'captured' ? 'none' : 'block' }}
        />
        <canvas ref={canvasRef} style={{ display: status === 'scanning' ? 'block' : 'none' }} />

        {status === 'scanning' && (
          <div className="camera-overlay">
            <div className={`face-guide ${faceDetected ? 'detected' : ''}`} />
          </div>
        )}

        {status === 'scanning' && (
          <div className="camera-status">
            {faceDetected
              ? `✅ Face detected — ${liveness}% confidence`
              : '👤 Position your face in the oval'}
          </div>
        )}

        {status === 'captured' && (
          <div className="flex-center flex-col" style={{ height: 240, gap: 12 }}>
            <div style={{ fontSize: '4rem' }}>✅</div>
            <p style={{ color: 'var(--success)', fontWeight: 600 }}>Face captured!</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex-center flex-col" style={{ height: 240, gap: 12 }}>
            <div style={{ fontSize: '3rem' }}>⚠️</div>
            <p style={{ color: 'var(--danger)', fontWeight: 600, textAlign: 'center', padding: '0 20px' }}>
              {error || 'No face detected. Please try again.'}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar during capture */}
      {isCapturing && (
        <div style={{ marginTop: 12 }}>
          <div className="result-bar-track">
            <div className="result-bar-fill" style={{ width: `${captureProgress}%` }} />
          </div>
          <p className="text-muted mt-2" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
            Analyzing face... {captureProgress}%
          </p>
        </div>
      )}

      {/* Loading models */}
      {!isModelsLoaded && (
        <div className="alert alert-info mt-3">
          <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
          Loading face detection models...
        </div>
      )}

      {/* Error display */}
      {error && status !== 'error' && (
        <div className="alert alert-error mt-3">⚠️ {error}</div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-4" style={{ justifyContent: 'center' }}>
        {status === 'idle' && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={!isModelsLoaded}
          >
            {!isModelsLoaded ? (
              <><span className="spinner" /> Loading Models...</>
            ) : (
              <> 📷 Start Camera</>
            )}
          </button>
        )}

        {status === 'scanning' && (
          <>
            <button
              className="btn btn-gold btn-lg"
              onClick={handleCapture}
              disabled={!faceDetected || isCapturing}
            >
              {isCapturing ? (
                <><span className="spinner" /> Capturing...</>
              ) : (
                <> {label}</>
              )}
            </button>
            <button className="btn btn-outline" onClick={() => { stopCamera(); setStatus('idle'); }}>
              Cancel
            </button>
          </>
        )}

        {status === 'captured' && (
          <button
            className="btn btn-outline"
            onClick={() => { setStatus('idle'); setCaptureProgress(0); }}
          >
            🔄 Re-scan
          </button>
        )}
      </div>

      {/* Tips */}
      {status === 'scanning' && (
        <div className="mt-4" style={{ background: 'rgba(10,22,40,0.04)', borderRadius: 8, padding: '12px 16px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
            📋 Tips for best results:
          </p>
          <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: 16 }}>
            <li>Face the camera directly</li>
            <li>Ensure good lighting (avoid backlight)</li>
            <li>Remove sunglasses or face coverings</li>
            <li>Keep still during capture</li>
          </ul>
        </div>
      )}
    </div>
  );
}
