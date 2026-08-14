using System.Drawing;
using System.Drawing.Printing;
using System.Drawing.Text;
using TokyoSushi.PrintAgent.Models;

namespace TokyoSushi.PrintAgent.Services;

public sealed class PrinterService
{
    public IReadOnlyList<PrinterInfo> ListPrinters()
    {
        // PrinterSettings uses the Windows print registry and avoids touching
        // driver COM objects just to populate the screen. Some drivers can
        // terminate the process when System.Printing enumerates their queues.
        var defaultPrinter = new PrinterSettings().PrinterName;
        return PrinterSettings.InstalledPrinters.Cast<string>()
            .Select(name => new PrinterInfo(
                name,
                "Windows",
                name.Equals(defaultPrinter, StringComparison.OrdinalIgnoreCase) ? "Padrão" : "Instalada",
                name.Equals(defaultPrinter, StringComparison.OrdinalIgnoreCase)))
            .OrderByDescending(printer => printer.IsDefault)
            .ThenBy(printer => printer.Name)
            .ToList();
    }

    public void PrintTest(string printerName, string paperWidth, int fontSize, int marginLeft, int marginRight, int marginTop, int marginBottom)
    {
        var lines = new List<ReceiptLine>
        {
            new("TOKYO SUSHI", true, false, Size: 10),
            new("COMANDA DE TESTE", true, false, Size: 8),
            new(""),
            new("Impressão local configurada com sucesso."),
            new($"Papel configurado: {paperWidth} mm"),
            new($"Data: {DateTime.Now:dd/MM/yyyy HH:mm}"),
            new(""),
            new("Se esta comanda saiu completa, o agente está pronto.", false, false, Size: 9)
        };
        PrintLines(printerName, lines, fontSize, marginLeft, marginRight, marginTop, marginBottom, 1, "Tokyo Sushi · Comanda de teste");
    }

    public void PrintOrder(string printerName, PrintOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(printerName)) throw new ArgumentException("Impressora não informada.", nameof(printerName));
        if (request.Items.Count == 0) throw new InvalidOperationException("O pedido não possui itens para imprimir.");

        PrintLines(
            printerName,
            BuildOrderLines(request),
            request.FontSize,
            request.MarginLeft,
            request.MarginRight,
            request.MarginTop,
            request.MarginBottom,
            Math.Clamp(request.Copies, 1, 3),
            $"Tokyo Sushi · Pedido {request.OrderId}");
    }

    private static IReadOnlyList<ReceiptLine> BuildOrderLines(PrintOrderRequest request)
    {
        var kitchen = string.Equals(request.PrintMode, "kitchen", StringComparison.OrdinalIgnoreCase);
        var customerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "NÃO INFORMADO" : request.CustomerName.Trim().ToUpperInvariant();
        var lines = new List<ReceiptLine>
        {
            new("TOKYO SUSHI", true, false, Size: 11),
            new(kitchen ? "COMANDA DE PRODUÇÃO" : "COMANDA DE RETIRADA", true, false, Size: 9),
            new(""),
            new($"PEDIDO #{request.OrderId}", true, false, Size: 13),
            new($"DATA: {request.CreatedAt:dd/MM/yyyy HH:mm}", Size: 9)
        };

        if (request.ShowCustomer)
            lines.Add(new($"CLIENTE: {customerName}", true, Center: true, Size: 10));
        if (!kitchen && request.ShowPhone && !string.IsNullOrWhiteSpace(request.CustomerPhone))
            lines.Add(new($"WHATSAPP: {request.CustomerPhone}"));
        if (!kitchen && request.ShowPayment)
        {
            var payment = string.IsNullOrWhiteSpace(request.Payment) ? "NÃO INFORMADO" : request.Payment.Trim().ToUpperInvariant();
            lines.Add(new($"PAGAMENTO: {payment}", true, Size: 9));
        }

        lines.Add(new("--------------------------------", true, true, Size: 8));
        for (var itemIndex = 0; itemIndex < request.Items.Count; itemIndex++)
        {
            var item = request.Items[itemIndex];
            var quantity = Math.Max(1, item.Qty);
            var itemTotal = (item.Price + item.UnitExtra) * quantity;
            lines.Add(new($"{quantity}x {item.Name.Trim().ToUpperInvariant()}", true, Size: 10));
            if (!kitchen && request.ShowItemPrices) lines.Add(new(FormatMoney(itemTotal), false, false, true, 9));
            foreach (var option in item.Options)
            {
                var optionQuantity = Math.Max(1, option.Qty);
                lines.Add(new($"  + {optionQuantity}x {option.Name.Trim().ToUpperInvariant()}", false, false, false, 9));
                if (!kitchen && request.ShowItemPrices) lines.Add(new(FormatMoney(option.Price * optionQuantity), false, false, true, 9));
            }
            if (itemIndex < request.Items.Count - 1) lines.Add(new(""));
        }

        if (!kitchen && request.ShowTotals)
        {
            lines.Add(new(""));
            lines.Add(new("--------------------------------", true, true, Size: 8));
            if (request.Subtotal is not null) lines.Add(new($"Subtotal: {FormatMoney(request.Subtotal.Value)}", Size: 9));
            if (request.Discount > 0) lines.Add(new($"Desconto: - {FormatMoney(request.Discount)}", Size: 9));
            if (request.CouponDiscount > 0) lines.Add(new($"Cupom: - {FormatMoney(request.CouponDiscount)}", Size: 9));
            if (request.Surcharge > 0) lines.Add(new($"Acréscimo: + {FormatMoney(request.Surcharge)}", Size: 9));
            lines.Add(new($"TOTAL: {FormatMoney(request.Total)}", true, false, false, 12));
            if (request.AmountReceived is not null) lines.Add(new($"Recebido: {FormatMoney(request.AmountReceived.Value)} · Troco: {FormatMoney(request.Change)}", Size: 9));
        }
        if (request.ShowNotes && !string.IsNullOrWhiteSpace(request.Notes))
        {
            lines.Add(new(""));
            lines.Add(new("*** OBSERVAÇÕES ***", true, true, Size: 8));
            lines.Add(new($"*** {request.Notes.ReplaceLineEndings(" ").Trim().ToUpperInvariant()} ***", true, false, false, 9));
        }
        lines.Add(new(""));
        lines.Add(new("--------------------------------", true, true, Size: 8));
        lines.Add(new(kitchen ? "PRODUÇÃO" : "OBRIGADO!", true, false, Size: 8));
        return lines;
    }

    private static void PrintLines(string printerName, IReadOnlyList<ReceiptLine> lines, int fontSize, int marginLeftMm, int marginRightMm, int marginTopMm, int marginBottomMm, int copies, string title)
    {
        using var document = new PrintDocument
        {
            DocumentName = title,
            PrintController = new StandardPrintController()
        };
        document.PrinterSettings.PrinterName = printerName;
        document.DefaultPageSettings.Margins = new Margins(0, 0, 0, 0);
        document.OriginAtMargins = false;

        var lineIndex = 0;
        void PrintPage(object? _, PrintPageEventArgs args)
        {
            var graphics = args.Graphics;
            if (graphics is null) { args.HasMorePages = false; return; }
            // Thermal printers reproduce crisp 1-bit glyphs better than
            // anti-aliased gray pixels. Keep receipt details solid black.
            graphics.TextRenderingHint = TextRenderingHint.SingleBitPerPixelGridFit;
            graphics.TextContrast = 0;
            var dpiX = graphics.DpiX <= 0 ? 96f : graphics.DpiX;
            var dpiY = graphics.DpiY <= 0 ? 96f : graphics.DpiY;
            var clip = graphics.VisibleClipBounds;
            var pageLeft = clip.Width > 0 ? clip.Left : 0;
            var pageTop = clip.Height > 0 ? clip.Top : 0;
            var pageWidth = clip.Width > 0 ? clip.Width : args.PageBounds.Width;
            var pageHeight = clip.Height > 0 ? clip.Height : args.PageBounds.Height;
            var leftMargin = Math.Clamp(marginLeftMm, 0, 16) / 25.4f * dpiX;
            var rightMargin = Math.Clamp(marginRightMm, 0, 16) / 25.4f * dpiX;
            var top = Math.Clamp(marginTopMm, 0, 16) / 25.4f * dpiY;
            var bottomMargin = Math.Clamp(marginBottomMm, 0, 16) / 25.4f * dpiY;
            // Some Windows drivers report a virtual page wider than the
            // physical printable area. Keep a conservative 46 mm column so
            // the last characters remain inside the print head on compact
            // rolls and on drivers with hidden right-side margins.
            var safeWidth = 46f / 25.4f * dpiX;
            var availableWidth = Math.Max(80f, pageWidth - leftMargin - rightMargin);
            var width = Math.Max(80f, Math.Min(availableWidth, safeWidth));
            var left = pageLeft + leftMargin;
            // Center the header/footer in the same conservative printable
            // column used by the items. Thermal drivers often expose a
            // virtual page wider than the actual print head; centering in
            // that virtual page is what pushed the header to the right.
            var centeredWidth = width;
            var centeredLeft = left;
            var y = pageTop + top;
            var bottom = pageTop + pageHeight - bottomMargin;
            var sizeScale = Math.Clamp(fontSize, 6, 14) / 9f;

            while (lineIndex < lines.Count)
            {
                var line = lines[lineIndex];
                var fontStyle = line.Bold ? FontStyle.Bold : FontStyle.Regular;
                using var font = new Font("Arial", Math.Clamp(line.Size * sizeScale, 6f, 18f), fontStyle, GraphicsUnit.Point);
                var lineHeight = Math.Max(font.GetHeight(graphics) + 4, 18f);
                var wrapped = WrapText(graphics, line.Text, font, width);
                foreach (var chunk in wrapped)
                {
                    if (y + lineHeight > bottom)
                    {
                        args.HasMorePages = true;
                        return;
                    }

                    var format = new StringFormat { Alignment = line.Center ? StringAlignment.Center : line.Right ? StringAlignment.Far : StringAlignment.Near, LineAlignment = StringAlignment.Near, Trimming = StringTrimming.None };
                    var drawLeft = line.Center ? centeredLeft : left;
                    var drawWidth = line.Center ? centeredWidth : width;
                    graphics.DrawString(chunk, font, Brushes.Black, new RectangleF(drawLeft, y, drawWidth, lineHeight + 2), format);
                    format.Dispose();
                    y += lineHeight;
                }
                lineIndex++;
            }
            args.HasMorePages = false;
        }

        document.PrintPage += PrintPage;
        try
        {
            for (var copy = 0; copy < Math.Clamp(copies, 1, 3); copy++)
            {
                lineIndex = 0;
                document.Print();
            }
        }
        finally
        {
            document.PrintPage -= PrintPage;
        }
    }

    private static IEnumerable<string> WrapText(Graphics graphics, string text, Font font, float maxWidth)
    {
        if (string.IsNullOrWhiteSpace(text)) return new[] { "" };
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var result = new List<string>();
        var current = "";
        foreach (var word in words)
        {
            var candidate = string.IsNullOrEmpty(current) ? word : $"{current} {word}";
            if (graphics.MeasureString(candidate, font).Width <= maxWidth)
            {
                current = candidate;
                continue;
            }
            if (string.IsNullOrEmpty(current))
            {
                foreach (var character in word)
                {
                    var piece = current + character;
                    if (!string.IsNullOrEmpty(current) && graphics.MeasureString(piece, font).Width > maxWidth)
                    {
                        result.Add(current);
                        current = character.ToString();
                    }
                    else current = piece;
                }
                continue;
            }
            result.Add(current);
            current = word;
        }
        if (!string.IsNullOrEmpty(current)) result.Add(current);
        return result;
    }

    private static string FormatMoney(decimal value) => value.ToString("C2", new System.Globalization.CultureInfo("pt-BR"));

    private sealed record ReceiptLine(string Text, bool Bold = false, bool Center = false, bool Right = false, float Size = 10);
}
