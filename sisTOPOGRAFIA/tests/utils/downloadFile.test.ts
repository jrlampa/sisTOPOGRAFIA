import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadFile, downloadBlob } from '../../src/utils/downloadFile';

describe('downloadFile', () => {
  let anchorMock: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    anchorMock = { href: '', download: '', click: vi.fn() };
    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchorMock as unknown as HTMLElement);
    appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation(() => anchorMock as unknown as Node);
    removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation(() => anchorMock as unknown as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor with the correct href and download, clicks it, and removes it', () => {
    downloadFile('https://example.com/file.dxf', 'export.dxf');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchorMock.href).toBe('https://example.com/file.dxf');
    expect(anchorMock.download).toBe('export.dxf');
    expect(appendChildSpy).toHaveBeenCalledWith(anchorMock);
    expect(anchorMock.click).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledWith(anchorMock);
  });
});

describe('downloadBlob', () => {
  let anchorMock: { href: string; download: string; click: ReturnType<typeof vi.fn> };
  const fakeObjectUrl = 'blob:fake-url';

  beforeEach(() => {
    anchorMock = { href: '', download: '', click: vi.fn() };
    vi.spyOn(document, 'createElement').mockReturnValue(
      anchorMock as unknown as HTMLElement
    );
    vi.spyOn(document.body, 'appendChild').mockImplementation(
      () => anchorMock as unknown as Node
    );
    vi.spyOn(document.body, 'removeChild').mockImplementation(
      () => anchorMock as unknown as Node
    );
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => fakeObjectUrl),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates an object URL, triggers download, then revokes the URL', () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    downloadBlob(blob, 'file.txt');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchorMock.href).toBe(fakeObjectUrl);
    expect(anchorMock.download).toBe('file.txt');
    expect(anchorMock.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });
});
