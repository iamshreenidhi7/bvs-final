// ============================================================
// src/hooks/useFaceDetection.js
// face-api.js webcam face detection hook
// ============================================================
import { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const MODELS_URL = '/models';

export function useFaceDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectIntervalRef = useRef(null);

  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [liveness, setLiveness] = useState(0); // 0-100 liveness score
  const [error, setError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Load face-api.js models
  useEffect(() => {
    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        setIsModelsLoaded(true);
      } catch (err) {
        setError('Failed to load face detection models: ' + err.message);
      }
    }
    loadModels();
  }, []);

  // Start webcam
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOn(true);
        setError(null);
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
    }
    setIsCameraOn(false);
    setFaceDetected(false);
  }, []);

  // Continuous face detection loop for UI feedback
  const startDetectionLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    detectIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks();

        const canvas = canvasRef.current;
        const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
        faceapi.draw.drawDetections(canvas, faceapi.resizeResults(detections, dims));
        faceapi.draw.drawFaceLandmarks(canvas, faceapi.resizeResults(detections, dims));

        setFaceDetected(detections.length === 1);
        setLiveness(detections.length === 1 ? Math.min(100, Math.round(detections[0].detection.score * 100)) : 0);
      } catch (_) {}
    }, 200);
  }, []);

  // Capture a single high-quality face embedding
  const captureEmbedding = useCallback(async () => {
    if (!videoRef.current || !isModelsLoaded) {
      throw new Error('Camera or models not ready');
    }
    setIsCapturing(true);
    try {
      // Take 3 readings and average for stability
      const embeddings = [];
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.7 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) throw new Error('No face detected. Please face the camera directly.');
        embeddings.push(Array.from(detection.descriptor));
      }

      // Average the 3 embeddings
      const averaged = embeddings[0].map((_, i) =>
        embeddings.reduce((sum, e) => sum + e[i], 0) / embeddings.length
      );

      return averaged; // 128-D float array
    } finally {
      setIsCapturing(false);
    }
  }, [isModelsLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isModelsLoaded,
    isCameraOn,
    faceDetected,
    liveness,
    error,
    isCapturing,
    startCamera,
    stopCamera,
    startDetectionLoop,
    captureEmbedding,
  };
}
