export type ScannerDocumentType =
  | "customer_photo"
  | "identity_front"
  | "identity_back"
  | "health_card_front"
  | "health_card_back"
  | "medical_certificate"
  | "privacy"
  | "waiver"
  | "other";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_LONG_SIDE = 1800;
const DEFAULT_JPEG_QUALITY = 0.82;

export function isImageFile(file: File) {
  return IMAGE_MIME_TYPES.has(file.type.toLowerCase());
}

export function isPdfFile(file: File) {
  return PDF_MIME_TYPES.has(file.type.toLowerCase()) || file.name.toLowerCase().endsWith(".pdf");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function validateScannerFile(
  file: File,
  options: { maxSizeBytes?: number; allowPdf?: boolean; allowImages?: boolean } = {},
) {
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const allowPdf = options.allowPdf ?? true;
  const allowImages = options.allowImages ?? true;

  if (!file) return { valid: false, error: "Seleziona un file." };
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File troppo grande. Limite ${formatFileSize(maxSizeBytes)}.` };
  }
  if (allowImages && isImageFile(file)) return { valid: true };
  if (allowPdf && isPdfFile(file)) return { valid: true };
  return { valid: false, error: "Formato non supportato. Usa JPG, PNG, WEBP o PDF." };
}

function safeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();
}

export function createSafeScannerFileName(options: {
  documentType: ScannerDocumentType;
  originalName?: string;
  extension?: string;
  timestamp?: number;
}) {
  const timestamp = options.timestamp ?? Date.now();
  const originalExt = options.originalName?.split(".").pop()?.toLowerCase();
  const extension = safeSlug(options.extension || originalExt || "jpg").replace(/^\./, "") || "jpg";
  const prefixByType: Record<ScannerDocumentType, string> = {
    customer_photo: "profile",
    identity_front: "front",
    identity_back: "back",
    health_card_front: "front",
    health_card_back: "back",
    medical_certificate: "certificate",
    privacy: "privacy",
    waiver: "waiver",
    other: "document",
  };
  return `${prefixByType[options.documentType]}-${timestamp}.${extension}`;
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere l’immagine."));
    };
    image.src = url;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, name: string, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], name, { type: "image/jpeg" })) : reject(new Error("Compressione non riuscita."))),
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImageFile(
  file: File,
  options: { maxLongSide?: number; quality?: number; fileName?: string } = {},
) {
  if (!isImageFile(file)) return file;
  const image = await fileToImage(file);
  const maxLongSide = options.maxLongSide ?? DEFAULT_MAX_LONG_SIDE;
  const quality = options.quality ?? DEFAULT_JPEG_QUALITY;
  const scale = Math.min(1, maxLongSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToFile(canvas, options.fileName || file.name.replace(/\.[^.]+$/, ".jpg"), quality);
}

export async function rotateImageFile(file: File, degrees: number) {
  if (!isImageFile(file)) return file;
  const normalized = ((degrees % 360) + 360) % 360;
  if (!normalized) return file;
  const image = await fileToImage(file);
  const swap = normalized === 90 || normalized === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? image.height : image.width;
  canvas.height = swap ? image.width : image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile.");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return canvasToFile(canvas, file.name.replace(/\.[^.]+$/, ".jpg"), DEFAULT_JPEG_QUALITY);
}

export function buildCustomerDocumentStoragePath(customerId: string, documentType: ScannerDocumentType, fileName: string) {
  const safeCustomerId = safeSlug(customerId);
  const safeFileName = safeSlug(fileName) || createSafeScannerFileName({ documentType });
  const folderByType: Record<ScannerDocumentType, string> = {
    customer_photo: "photo",
    identity_front: "identity",
    identity_back: "identity",
    health_card_front: "health-card",
    health_card_back: "health-card",
    medical_certificate: "medical",
    privacy: "other",
    waiver: "other",
    other: "other",
  };
  return `customers/${safeCustomerId}/${folderByType[documentType]}/${safeFileName}`;
}
