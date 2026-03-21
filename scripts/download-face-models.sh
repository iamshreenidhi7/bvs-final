#!/bin/bash
# ============================================================
# scripts/download-face-models.sh
# Downloads face-api.js model weights into frontend/public/models
# Run once before starting the frontend
# ============================================================

set -e

MODELS_DIR="./frontend/public/models"
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

echo "📥 Downloading face-api.js models to $MODELS_DIR"
mkdir -p "$MODELS_DIR"

FILES=(
  # SSD MobileNet v1 (face detection)
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"

  # Face Landmark 68-point
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"

  # Face Recognition (128-D descriptor)
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"

  # Face Expression
  "face_expression_recognition_model-weights_manifest.json"
  "face_expression_recognition_model-shard1"
)

for file in "${FILES[@]}"; do
  if [ -f "$MODELS_DIR/$file" ]; then
    echo "  ✅ Already exists: $file"
  else
    echo "  ⬇️  Downloading: $file"
    curl -sL "$BASE_URL/$file" -o "$MODELS_DIR/$file"
    echo "  ✔  Done: $file"
  fi
done

echo ""
echo "✅ All models downloaded to $MODELS_DIR"
echo "   Model sizes:"
du -sh "$MODELS_DIR"/*manifest* 2>/dev/null | head -20
echo ""
echo "   Total:"
du -sh "$MODELS_DIR"
