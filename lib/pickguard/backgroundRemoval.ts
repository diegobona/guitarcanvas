import type { Config, ImageSource } from "@imgly/background-removal";

import type { UploadedPhoto } from "./geometry";

export type BackgroundRemovalProgress = {
  key: string;
  current: number;
  total: number;
};

export type RemovePickguardBackgroundInput = {
  file: File;
  sourcePhoto: UploadedPhoto;
  onProgress?: (progress: BackgroundRemovalProgress) => void;
};

export async function removePickguardBackground({
  file,
  sourcePhoto,
  onProgress,
}: RemovePickguardBackgroundInput): Promise<UploadedPhoto> {
  const blob = await removeImageBackground(file, onProgress);
  const transparentDataUrl = await blobToDataUrl(blob);

  return buildCutoutPhoto(sourcePhoto, transparentDataUrl);
}

export async function removeImageBackground(
  image: ImageSource,
  onProgress?: (progress: BackgroundRemovalProgress) => void,
): Promise<Blob> {
  const { removeBackground } = await import(
    "@imgly/background-removal"
  );

  const config: Config = {
    model: "isnet_fp16",
    output: {
      format: "image/png",
      quality: 1,
    },
    progress: onProgress
      ? (key, current, total) => onProgress({ key, current, total })
      : undefined,
  };

  return removeBackground(image, config);
}

export function buildCutoutPhoto(
  sourcePhoto: UploadedPhoto,
  transparentDataUrl: string,
): UploadedPhoto {
  return {
    ...sourcePhoto,
    dataUrl: transparentDataUrl,
    name: `${stripImageExtension(sourcePhoto.name)}-cutout.png`,
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read cutout image."));
    reader.readAsDataURL(blob);
  });
}

function stripImageExtension(name: string) {
  return name.replace(/\.(jpe?g|png|webp)$/i, "");
}
