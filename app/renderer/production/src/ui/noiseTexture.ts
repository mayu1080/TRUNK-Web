/** Procedural grain for LIST. Missing content/noise files fall back here. */
export function createProceduralNoiseTile(size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const image = ctx.createImageData(size, size);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const v = 118 + (Math.random() - 0.5) * 160;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 200 + Math.random() * 55;
  }
  ctx.putImageData(image, 0, 0);

  const soft = document.createElement('canvas');
  soft.width = size;
  soft.height = size;
  const sctx = soft.getContext('2d');
  if (sctx) {
    sctx.filter = 'blur(0.45px)';
    sctx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(soft, 0, 0);
  }

  return canvas.toDataURL('image/png');
}
