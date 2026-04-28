// Real Google Cloud Vision API integration
// Docs: https://cloud.google.com/vision/docs/reference/rest

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export interface VisionResult {
  faceAnnotations: FaceAnnotation[];
  labelAnnotations: Label[];
  landmarkAnnotations: Label[];
}

interface FaceAnnotation {
  boundingPoly: { vertices: { x: number; y: number }[] };
  detectionConfidence: number;
  joyLikelihood: string;
}

interface Label {
  description: string;
  score: number;
}

export async function analyzeImage(
  imageUrl: string
): Promise<VisionResult | null> {
  const apiKey = import.meta.env.VITE_VISION_API_KEY;
  if (!apiKey) {
    console.warn('Vision API key not set — skipping AI analysis');
    return null;
  }

  const body = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [
          { type: 'FACE_DETECTION', maxResults: 10 },
          { type: 'LABEL_DETECTION', maxResults: 15 },
          { type: 'LANDMARK_DETECTION', maxResults: 5 },
        ],
      },
    ],
  };

  const res = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('Vision API error:', res.statusText);
    return null;
  }

  const json = await res.json();
  const response = json.responses?.[0];

  return {
    faceAnnotations: response?.faceAnnotations ?? [],
    labelAnnotations: response?.labelAnnotations ?? [],
    landmarkAnnotations: response?.landmarkAnnotations ?? [],
  };
}

export function extractLabels(result: VisionResult): string[] {
  const labels = [
    ...result.labelAnnotations.map((l) => l.description.toLowerCase()),
    ...result.landmarkAnnotations.map((l) => l.description.toLowerCase()),
  ];
  return [...new Set(labels)];
}

export function extractFaceCount(result: VisionResult): number {
  return result.faceAnnotations.length;
}
