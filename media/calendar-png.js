/* Capture the current calendar DOM and computed styles without a second layout. */
(() => {
  const DPI = 800, PIXEL_RATIO = DPI / 96;
  window.renderCalendarPng = async function () {
    await document.fonts.ready;
    const main = document.querySelector('main');
    const month = document.querySelector('.day')?.dataset.date.slice(0, 7);
    const bounds = main.getBoundingClientRect();
    const width = Math.ceil(bounds.width), height = Math.ceil(Math.max(bounds.height, main.scrollHeight));
    const outputWidth = Math.floor(width * PIXEL_RATIO), outputHeight = Math.floor(height * PIXEL_RATIO);
    if (outputWidth > 32767 || outputHeight > 32767 || outputWidth * outputHeight > 150000000) {
      throw new Error('当前月历尺寸超过 800 DPI 导出上限，请缩小窗口后重试。');
    }
    let canvas;
    try {
      canvas = await window.htmlToImage.toCanvas(main, {
        width, height, pixelRatio: PIXEL_RATIO, skipAutoScale: true, skipFonts: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        // The captured node owns its padding; remove only the outer page margin.
        style: { margin: '0' },
      });
      const data = canvas.toDataURL('image/png').split(',')[1];
      if (!data) throw new Error('PNG encoding failed');
      return { type: 'exportPng', month, data, width: canvas.width, height: canvas.height, dpi: DPI };
    } finally { if (canvas) { canvas.width = 0; canvas.height = 0; } }
  };
})();
