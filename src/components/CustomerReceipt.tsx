import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface ReceiptItem {
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CompanyInfo {
  name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

interface InvoiceColors {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  header_color: string;
  border_color: string;
  background_color: string;
}

interface CustomerReceiptData {
  invoice_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  order_value: number;
  advance: number;
  total_due: number;
  cod: number;
  note: string | null;
  status: string | null;
  created_at: string;
  items: ReceiptItem[];
  company: CompanyInfo;
  invoice_url?: string | null;
  colors?: InvoiceColors;
  use_background_image?: boolean;
}

// Default colors for backward compatibility
const defaultColors: InvoiceColors = {
  primary_color: "#3b6cf5",
  secondary_color: "#1a1a2e",
  accent_color: "#555555",
  text_color: "#1a1a2e",
  header_color: "#3b6cf5",
  border_color: "#dddddd",
  background_color: "#ffffff",
};

export const CustomerReceipt = forwardRef<HTMLDivElement, { data: CustomerReceiptData }>(
  ({ data }, ref) => {
    const { company, items } = data;
    const colors = data.colors || defaultColors;
    const use_background_image = data.use_background_image ?? false;
    
    const date = new Date(data.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const whatsappLink = company.phone
      ? `https://wa.me/${company.phone.replace(/[^0-9+]/g, "").replace(/^\+/, "")}`
      : null;

    const backgroundStyle = use_background_image && company.logo_url
      ? {
          backgroundImage: `url(${company.logo_url})`,
          backgroundSize: "200px",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.06,
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
        }
      : {};

    return (
      <div
        ref={ref}
        style={{
          width: "210mm",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "32px 40px",
          fontFamily: "'Noto Sans Bengali', 'Space Grotesk', 'Segoe UI', sans-serif",
          fontSize: "14px",
          color: colors.text_color,
          background: colors.background_color,
          lineHeight: 1.6,
          position: "relative",
        }}
      >
        {/* Background image overlay */}
        {use_background_image && company.logo_url && <div style={backgroundStyle} />}

        {/* Content wrapper */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", borderBottom: `3px solid ${colors.header_color}`, paddingBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {company.logo_url && (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  style={{ height: "64px", objectFit: "contain" }}
                />
              )}
              <div>
                <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "0.5px", color: colors.secondary_color }}>
                  {company.name || "Company Name"}
                </div>
                {company.address && (
                  <div style={{ fontSize: "12px", color: colors.accent_color, marginTop: "4px" }}>{company.address}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", fontSize: "12px", color: colors.accent_color }}>
                  {company.phone && whatsappLink && (
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#25D366", textDecoration: "none", fontWeight: 600 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      {company.phone}
                    </a>
                  )}
                  {company.phone && !whatsappLink && <span>{company.phone}</span>}
                  {company.email && <span>{company.email}</span>}
                  {company.website && <span>{company.website}</span>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "28px", fontWeight: 700, color: colors.primary_color, fontFamily: "'JetBrains Mono', monospace" }}>
                INVOICE
              </div>
              <div style={{ fontSize: "16px", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", marginTop: "4px", color: colors.text_color }}>
                #{data.invoice_code}
              </div>
              <div style={{ fontSize: "12px", color: colors.accent_color, marginTop: "4px" }}>{date}</div>
              <div style={{
                display: "inline-block",
                padding: "3px 14px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                marginTop: "8px",
                background: data.status === "Delivered" ? "#e8f5e9" : data.status === "Cancelled" ? "#ffebee" : "#e3f2fd",
                color: data.status === "Delivered" ? "#2e7d32" : data.status === "Cancelled" ? "#c62828" : "#1565c0",
              }}>
                {data.status || "Pending"}
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
            <div style={{ background: "#f8f9fa", borderRadius: "8px", padding: "16px 20px", flex: "1", maxWidth: "45%", border: `1px solid ${colors.border_color}` }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: colors.accent_color, marginBottom: "8px" }}>Bill To</div>
              <div style={{ fontWeight: 600, fontSize: "16px", color: colors.text_color }}>{data.customer_name}</div>
              <div style={{ color: colors.accent_color, marginTop: "4px" }}>{data.customer_phone}</div>
              {data.customer_address && <div style={{ color: colors.accent_color, marginTop: "2px" }}>{data.customer_address}</div>}
            </div>
            {data.invoice_url && (
              <div style={{ textAlign: "center" }}>
                <QRCodeSVG value={data.invoice_url} size={90} level="M" />
                <div style={{ fontSize: "9px", color: colors.accent_color, marginTop: "4px" }}>Scan for digital copy</div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
            <thead>
              <tr style={{ background: colors.header_color, color: "#fff" }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>#</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>Item</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>Code</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>Qty</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>Price</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.border_color}`, background: i % 2 === 0 ? "#fafbfc" : "#fff" }}>
                  <td style={{ padding: "10px 12px", fontSize: "12px", color: colors.accent_color }}>{i + 1}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: colors.text_color }}>{item.product_name}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: colors.accent_color }}>{item.product_code}</td>
                  <td style={{ textAlign: "center", padding: "10px 12px", color: colors.text_color }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", padding: "10px 12px", color: colors.text_color }}>{Number(item.unit_price).toLocaleString()}</td>
                  <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: colors.text_color }}>{Number(item.subtotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
            <div style={{ width: "280px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                <span style={{ color: colors.accent_color }}>Subtotal</span>
                <span style={{ color: colors.text_color }}>{Number(data.order_value).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                <span style={{ color: colors.accent_color }}>Advance Paid</span>
                <span style={{ color: colors.text_color }}>-{Number(data.advance).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 700, fontSize: "16px", borderTop: `2px solid ${colors.header_color}`, marginTop: "6px" }}>
                <span style={{ color: colors.text_color }}>Total Due</span>
                <span style={{ color: colors.text_color }}>{Number(data.total_due).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: colors.primary_color, fontWeight: 600 }}>
                <span>COD</span>
                <span>{Number(data.cod).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Note */}
          {data.note && (
            <div style={{ padding: "12px 16px", background: "#fffde7", borderRadius: "6px", fontSize: "13px", color: colors.accent_color, marginBottom: "20px", border: `1px solid ${colors.border_color}` }}>
              <strong>Note:</strong> {data.note}
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", paddingTop: "16px", borderTop: `2px dashed ${colors.border_color}`, fontSize: "12px", color: colors.accent_color }}>
            <div style={{ fontWeight: 600, color: colors.text_color }}>ধন্যবাদ। আবার কেনাকাটা করার জন্য আপনাকে আমন্ত্রণ জানাচ্ছি।</div>
            {company.website && <div style={{ marginTop: "4px" }}>{company.website}</div>}
            {company.phone && whatsappLink && (
              <div style={{ marginTop: "8px" }}>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#25D366", textDecoration: "none", fontWeight: 600, fontSize: "13px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Contact us on WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

CustomerReceipt.displayName = "CustomerReceipt";
