# Builds the web sprites for the Luna runner from the original art in the project root.
# Run from anywhere: powershell -NoProfile -File tools\make-luna.ps1
# Outputs: assets\luna-run.png (6-frame strip), assets\luna-sit-1.png, assets\luna-sit-2.png
Add-Type -AssemblyName System.Drawing

$cs = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class LunaSlicer {
  const int Solid = 100;

  public class Piece { public byte[] Rgba; public int W, H; public int X0, Y0, X1, Y1; }

  static byte[] Read(string path, out int w, out int h) {
    using (var src = new Bitmap(path)) {
      w = src.Width; h = src.Height;
      var data = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      var bytes = new byte[data.Stride * h];
      Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
      src.UnlockBits(data);
      // normalize to tight w*4 rows
      var rgba = new byte[w * h * 4];
      for (int y = 0; y < h; y++) Buffer.BlockCopy(bytes, y * data.Stride, rgba, y * w * 4, w * 4);
      return rgba;
    }
  }

  // Labels 8-connected solid regions. Returns label per pixel (0 = background or soft edge).
  static int[] Label(byte[] px, int w, int h, out int count) {
    var lab = new int[w * h];
    int next = 0;
    var stack = new Stack<int>();
    for (int i = 0; i < w * h; i++) {
      if (lab[i] != 0 || px[i * 4 + 3] < Solid) continue;
      next++;
      lab[i] = next; stack.Push(i);
      while (stack.Count > 0) {
        int p = stack.Pop(); int x = p % w, y = p / w;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
          int nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          int q = ny * w + nx;
          if (lab[q] != 0 || px[q * 4 + 3] < Solid) continue;
          lab[q] = next; stack.Push(q);
        }
      }
    }
    count = next;
    return lab;
  }

  // Extracts the pixels of the given labels plus their antialiased edge (2 px dilation).
  static Piece Extract(byte[] px, int[] lab, int w, int h, HashSet<int> own) {
    var keep = new bool[w * h];
    for (int i = 0; i < w * h; i++) if (lab[i] != 0 && own.Contains(lab[i])) keep[i] = true;
    var grown = (bool[])keep.Clone();
    for (int pass = 0; pass < 2; pass++) {
      var cur = (bool[])grown.Clone();
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
        int i = y * w + x;
        if (cur[i]) continue;
        if (px[i * 4 + 3] == 0 || (lab[i] != 0 && !own.Contains(lab[i]))) continue;
        bool near = (x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w]);
        if (near) grown[i] = true;
      }
    }
    int x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (keep[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    int pw = x1 - x0 + 1, ph = y1 - y0 + 1;
    var rgba = new byte[pw * ph * 4];
    for (int y = 0; y < ph; y++) for (int x = 0; x < pw; x++) {
      int sx = x0 + x, sy = y0 + y, si = sy * w + sx;
      if (!grown[si]) continue;
      Buffer.BlockCopy(px, si * 4, rgba, (y * pw + x) * 4, 4);
    }
    return new Piece { Rgba = rgba, W = pw, H = ph, X0 = x0, Y0 = y0, X1 = x1, Y1 = y1 };
  }

  static Bitmap ToBitmap(byte[] rgba, int w, int h) {
    var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    for (int y = 0; y < h; y++) Marshal.Copy(rgba, y * w * 4, new IntPtr(data.Scan0.ToInt64() + y * data.Stride), w * 4);
    bmp.UnlockBits(data);
    return bmp;
  }

  static void Draw(Graphics g, Bitmap src, int dx, int dy, int dw, int dh) {
    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
    g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
    g.DrawImage(src, new Rectangle(dx, dy, dw, dh), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel);
  }

  // Six running frames from a 3x2 sheet. Each dog is assigned to a cell by its centroid so
  // neighbors that overlap in x are still separated. Frames are aligned by feet and center.
  public static string RunStrip(string sheet, string outPath, int frameH) {
    int w, h; var px = Read(sheet, out w, out h);
    int n; var lab = Label(px, w, h, out n);
    var sx = new long[n + 1]; var sy = new long[n + 1]; var cnt = new long[n + 1];
    for (int i = 0; i < w * h; i++) if (lab[i] != 0) { sx[lab[i]] += i % w; sy[lab[i]] += i / w; cnt[lab[i]]++; }
    int cw = w / 3, ch = h / 2;
    var cells = new HashSet<int>[6];
    for (int c = 0; c < 6; c++) cells[c] = new HashSet<int>();
    for (int l = 1; l <= n; l++) {
      if (cnt[l] < 40) continue;
      int cx = (int)(sx[l] / cnt[l]), cy = (int)(sy[l] / cnt[l]);
      cells[Math.Min(1, cy / ch) * 3 + Math.Min(2, cx / cw)].Add(l);
    }
    var pieces = new Piece[6];
    int maxW = 0, maxH = 0;
    for (int c = 0; c < 6; c++) {
      pieces[c] = Extract(px, lab, w, h, cells[c]);
      if (pieces[c].W > maxW) maxW = pieces[c].W;
      if (pieces[c].H > maxH) maxH = pieces[c].H;
    }
    double scale = (double)frameH / maxH;
    int fw = (int)Math.Ceiling(maxW * scale);
    using (var strip = new Bitmap(fw * 6, frameH, PixelFormat.Format32bppArgb))
    using (var g = Graphics.FromImage(strip)) {
      for (int c = 0; c < 6; c++) {
        using (var bmp = ToBitmap(pieces[c].Rgba, pieces[c].W, pieces[c].H)) {
          int dw = (int)Math.Round(pieces[c].W * scale), dh = (int)Math.Round(pieces[c].H * scale);
          Draw(g, bmp, c * fw + (fw - dw) / 2, frameH - dh, dw, dh);
        }
      }
      strip.Save(outPath, ImageFormat.Png);
    }
    return fw + "x" + frameH + " per frame, pieces " + string.Join(",", Array.ConvertAll(pieces, p => p.W + "x" + p.H));
  }

  // Sitting frames share one canvas so they overlay exactly; crop to the union box.
  public static string SitOne(string a, string outPath, int frameH) {
    string tmp = outPath + ".tmp";
    string r = SitFrames(a, a, outPath, tmp, frameH);
    System.IO.File.Delete(tmp);
    return r;
  }

  public static string SitFrames(string a, string b, string outA, string outB, int frameH) {
    int w, h; var pa = Read(a, out w, out h); var pb = Read(b, out w, out h);
    Piece[] pieces = new Piece[2];
    int[] ux = { w, h, -1, -1 };
    var srcs = new[] { pa, pb };
    var labs = new int[2][];
    for (int k = 0; k < 2; k++) {
      int n; labs[k] = Label(srcs[k], w, h, out n);
      var own = new HashSet<int>();
      var counts = new long[n + 1];
      for (int i = 0; i < w * h; i++) if (labs[k][i] != 0) counts[labs[k][i]]++;
      for (int l = 1; l <= n; l++) if (counts[l] >= 40) own.Add(l);
      pieces[k] = Extract(srcs[k], labs[k], w, h, own);
      if (pieces[k].X0 < ux[0]) ux[0] = pieces[k].X0; if (pieces[k].Y0 < ux[1]) ux[1] = pieces[k].Y0;
      if (pieces[k].X1 > ux[2]) ux[2] = pieces[k].X1; if (pieces[k].Y1 > ux[3]) ux[3] = pieces[k].Y1;
    }
    int uw = ux[2] - ux[0] + 1, uh = ux[3] - ux[1] + 1;
    double scale = (double)frameH / uh;
    int fw = (int)Math.Round(uw * scale);
    string[] outs = { outA, outB };
    for (int k = 0; k < 2; k++) {
      using (var canvas = new Bitmap(fw, frameH, PixelFormat.Format32bppArgb))
      using (var g = Graphics.FromImage(canvas))
      using (var bmp = ToBitmap(pieces[k].Rgba, pieces[k].W, pieces[k].H)) {
        int dx = (int)Math.Round((pieces[k].X0 - ux[0]) * scale), dy = (int)Math.Round((pieces[k].Y0 - ux[1]) * scale);
        Draw(g, bmp, dx, dy, (int)Math.Round(pieces[k].W * scale), (int)Math.Round(pieces[k].H * scale));
        canvas.Save(outs[k], ImageFormat.Png);
      }
    }
    return fw + "x" + frameH + " per sit frame";
  }
}
'@

Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
New-Item -ItemType Directory -Force $assets | Out-Null

$frameH = 96
[LunaSlicer]::RunStrip((Join-Path $root 'luna runnning.png'), (Join-Path $assets 'luna-run.png'), $frameH)
[LunaSlicer]::SitFrames(
  (Join-Path $root 'Luna Sitting(tail left).png'), (Join-Path $root 'Luna Sitting(tail right).png'),
  (Join-Path $assets 'luna-sit-1.png'), (Join-Path $assets 'luna-sit-2.png'), $frameH)
[LunaSlicer]::SitOne((Join-Path $root "Luna Sitting(tail left).png"), (Join-Path $assets "luna-about.png"), 360)
Get-ChildItem $assets -Filter 'luna-*' | ForEach-Object { '{0} {1} KB' -f $_.Name, [int]($_.Length / 1KB) }
