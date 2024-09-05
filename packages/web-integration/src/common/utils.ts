import assert from 'node:assert';
import type { Buffer } from 'node:buffer';
import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ElementInfo } from '@/extractor';
import type { PlaywrightParserOpt, UIContext } from '@midscene/core';
import { getTmpFile } from '@midscene/core/utils';
import { base64Encoded, imageInfoOfBase64 } from '@midscene/shared/img';
import dayjs from 'dayjs';
import { WebElementInfo } from '../web-element';
import type { WebPage } from './page';

export type WebUIContext = UIContext<WebElementInfo> & {
  url: string;
};

export async function parseContextFromWebPage(
  page: WebPage,
  _opt?: PlaywrightParserOpt,
): Promise<WebUIContext> {
  assert(page, 'page is required');

  const url = page.url();
  const file = getTmpFile('png');
  await page.screenshot({ path: file });
  const screenshotBuffer = readFileSync(file);
  const screenshotBase64 = base64Encoded(file);
  const captureElementSnapshot = await page.getElementInfos();

  // align element
  const elementsInfo = await alignElements(
    screenshotBuffer,
    captureElementSnapshot,
    page,
  );

  const size = await imageInfoOfBase64(screenshotBase64);

  return {
    content: elementsInfo,
    size,
    screenshotBase64,
    url,
  };
}

export async function getExtraReturnLogic() {
  const pathDir = findNearestPackageJson(__dirname);
  assert(pathDir, `can't find pathDir, with ${__dirname}`);
  const scriptPath = path.join(pathDir, './dist/script/htmlElement.js');
  const elementInfosScriptContent = readFileSync(scriptPath, 'utf-8');
  return `${elementInfosScriptContent}midscene_element_inspector.webExtractTextWithPosition()`;
}

const sizeThreshold = 3;
async function alignElements(
  screenshotBuffer: Buffer,
  elements: ElementInfo[],
  page: WebPage,
): Promise<WebElementInfo[]> {
  const validElements = elements.filter((item) => {
    return (
      item.rect.height >= sizeThreshold && item.rect.width >= sizeThreshold
    );
  });
  const textsAligned: WebElementInfo[] = [];
  for (const item of validElements) {
    const { rect, id, content, attributes, locator } = item;
    textsAligned.push(
      new WebElementInfo({
        rect,
        locator,
        id,
        content,
        attributes,
        page,
      }),
    );
  }

  return textsAligned;
}

/**
 * Find the nearest package.json file recursively
 * @param {string} dir - Home directory
 * @returns {string|null} - The most recent package.json file path or null
 */
export function findNearestPackageJson(dir: string): string | null {
  const packageJsonPath = path.join(dir, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    return dir;
  }

  const parentDir = path.dirname(dir);

  // Return null if the root directory has been reached
  if (parentDir === dir) {
    return null;
  }

  return findNearestPackageJson(parentDir);
}

export function reportFileName(tag = 'web') {
  const dateTimeInFileName = dayjs().format('YYYY-MM-DD_HH-mm-ss-SSS');
  return `${tag}-${dateTimeInFileName}`;
}

export function printReportMsg(filepath: string) {
  console.log('Midscene - report file updated:', filepath);
}
