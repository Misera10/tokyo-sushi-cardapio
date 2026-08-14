namespace TokyoSushi.PrintAgent.Models;

public sealed class PrintOrderRequest
{
    public string OrderId { get; set; } = "";
    public string StorePhone { get; set; } = "";
    public string PrintMode { get; set; } = "customer";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string Payment { get; set; } = "";
    public string PaymentStatus { get; set; } = "Não informado";
    public decimal Total { get; set; }
    public decimal? Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal CouponDiscount { get; set; }
    public decimal Surcharge { get; set; }
    public decimal? AmountReceived { get; set; }
    public decimal Change { get; set; }
    public string Notes { get; set; } = "";
    public string PaperWidth { get; set; } = "80";
    public int Margin { get; set; } = 3;
    public int FontSize { get; set; } = 9;
    public int MarginLeft { get; set; } = 3;
    public int MarginRight { get; set; } = 3;
    public int MarginTop { get; set; } = 3;
    public int MarginBottom { get; set; } = 3;
    public int Copies { get; set; } = 1;
    public bool ShowCustomer { get; set; } = true;
    public bool ShowPhone { get; set; } = true;
    public bool ShowPayment { get; set; } = true;
    public bool ShowItemPrices { get; set; } = true;
    public bool ShowNotes { get; set; } = true;
    public bool ShowTotals { get; set; } = true;
    public List<PrintOrderItem> Items { get; set; } = new();
}

public sealed class PrintOrderItem
{
    public int Qty { get; set; } = 1;
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public decimal UnitExtra { get; set; }
    public List<PrintOrderOption> Options { get; set; } = new();
}

public sealed class PrintOrderOption
{
    public int Qty { get; set; } = 1;
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}
