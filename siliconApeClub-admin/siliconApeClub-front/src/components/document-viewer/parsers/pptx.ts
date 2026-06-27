import JSZip from 'jszip';

export interface PptxSlidePreview {
  index: number;
  texts: string[];
  images: string[];
}

function sortSlidePaths(left: string, right: string) {
  const extractNumber = (path: string) => Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
  return extractNumber(left) - extractNumber(right);
}

function normalizeZipPath(basePath: string, relativePath: string) {
  const baseParts = basePath.split('/').slice(0, -1);
  const targetParts = relativePath.split('/');
  const allParts = [...baseParts, ...targetParts];
  const normalized: string[] = [];

  allParts.forEach((part) => {
    if (!part || part === '.') {
      return;
    }
    if (part === '..') {
      normalized.pop();
      return;
    }
    normalized.push(part);
  });

  return normalized.join('/');
}

function parseXml(text: string) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function readRelationshipMap(xmlText: string) {
  const xml = parseXml(xmlText);
  const relationships = Array.from(xml.getElementsByTagNameNS('*', 'Relationship'));
  const relationMap: Record<string, string> = {};

  relationships.forEach((relationship) => {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id && target) {
      relationMap[id] = target;
    }
  });

  return relationMap;
}

function collectSlideTexts(xmlText: string) {
  const xml = parseXml(xmlText);
  return Array.from(xml.getElementsByTagNameNS('*', 't'))
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean);
}

function collectImageRelationIds(xmlText: string) {
  const xml = parseXml(xmlText);
  return Array.from(xml.getElementsByTagNameNS('*', 'blip'))
    .map((node) => node.getAttribute('r:embed') ?? node.getAttribute('embed') ?? '')
    .filter(Boolean);
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function extractPptxSlides(blob: Blob): Promise<PptxSlidePreview[]> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort(sortSlidePaths);

  const slides: PptxSlidePreview[] = [];

  for (let index = 0; index < slidePaths.length; index += 1) {
    const slidePath = slidePaths[index];
    const slideFile = zip.file(slidePath);
    if (!slideFile) {
      continue;
    }

    const slideXml = await slideFile.async('text');
    const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/').replace(/\.xml$/i, '.xml.rels');
    const relsFile = zip.file(relsPath);
    const relationshipMap = relsFile ? readRelationshipMap(await relsFile.async('text')) : {};
    const textBlocks = collectSlideTexts(slideXml);
    const imageIds = collectImageRelationIds(slideXml);
    const images: string[] = [];

    for (const imageId of imageIds) {
      const target = relationshipMap[imageId];
      if (!target) {
        continue;
      }

      const normalizedPath = normalizeZipPath(slidePath, target);
      const imageFile = zip.file(normalizedPath);
      if (!imageFile) {
        continue;
      }

      const imageBlob = await imageFile.async('blob');
      images.push(await blobToDataUrl(imageBlob));
    }

    slides.push({
      index: index + 1,
      texts: textBlocks,
      images,
    });
  }

  return slides;
}
