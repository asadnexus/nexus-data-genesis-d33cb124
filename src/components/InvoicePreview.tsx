import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface InvoiceItem {
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

interface InvoicePreviewData {
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
  items: InvoiceItem[];
  company: CompanyInfo;
  invoice_url?: string | null;
  colors: InvoiceColors;
  use_background_image: boolean;
}

export const InvoicePreview = forwardRef<HTMLDivElement, { data: InvoicePreviewData }>(
  ({ data }, ref) => {
    const { company, items, colors, use_background_image } = data;
    const date = new Date(data.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const backgroundStyle = use_background_image && company.logo_url
      ? {
          backgroundImage: `url(${company.logo_url})`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.08,
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
          width: "80mm",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "16px",
          fontFamily: "'Noto Sans Bengali', 'Space Grotesk', 'Segoe UI', sans-serif",
          fontSize: "12px",
          color: colors.text_color,
          background: colors.background_color,
          lineHeight: 1.5,
          position: "relative",
        }}
      >
        {/* Background image overlay */}
        {use_background_image && company.logo_url && <div style={backgroundStyle} />}

        {/* Content wrapper */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "12px", borderBottom: `2px solid ${colors.header_color}`, paddingBottom: "12px" }}>
            {company.logo_url && (
              <img
                src={company.logo_url}
                alt={company.name}
                style={{ height: "48px", margin: "0 auto 8px", display: "block", objectFit: "contain" }}
              />
            )}
            <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "0.5px", color: colors.secondary_color }}>
              {company.name || "Company Name"}
            </div>
            {company.address && (
              <div style={{ fontSize: "10px", color: colors.accent_color, marginTop: "2px" }}>{company.address}</div>
            )}
            <div style={{ fontSize: "10px", color: colors.accent_color, marginTop: "2px" }}>
              {[company.phone, company.email, company.website].filter(Boolean).join(" · ")}
            </div>
          </div>

          {/* Invoice Meta */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "11px" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", color: colors.primary_color }}>
                #{data.invoice_code}
              </div>
              <div style={{ color: colors.accent_color, marginTop: "2px" }}>{date}</div>
            </div>
            <div style={{
              padding: "2px 10px",
              borderRadius: "12px",
              fontSize: "10px",
              fontWeight: 600,
              background: data.status === "Delivered" ? "#e8f5e9" : data.status === "Cancelled" ? "#ffebee" : "#e3f2fd",
              color: data.status === "Delivered" ? "#2e7d32" : data.status === "Cancelled" ? "#c62828" : "#1565c0",
              alignSelf: "flex-start",
            }}>
              {data.status || "Pending"}
            </div>
          </div>

          {/* Customer */}
          <div style={{ background: "#f8f9fa", borderRadius: "6px", padding: "8px 10px", marginBottom: "10px", fontSize: "11px", border: `1px solid ${colors.border_color}` }}>
            <div style={{ fontWeight: 600, color: colors.text_color }}>{data.customer_name}</div>
            <div style={{ color: colors.accent_color }}>{data.customer_phone}</div>
            {data.customer_address && <div style={{ color: colors.accent_color }}>{data.customer_address}</div>}
          </div>

          {/* Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${colors.border_color}` }}>
                <th style={{ textAlign: "left", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: colors.accent_color }}>Item</th>
                <th style={{ textAlign: "center", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: colors.accent_color }}>Qty</th>
                <th style={{ textAlign: "right", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: colors.accent_color }}>Price</th>
                <th style={{ textAlign: "right", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: colors.accent_color }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.border_color}` }}>
                  <td style={{ padding: "5px 2px" }}>
                    <div style={{ fontWeight: 500, color: colors.text_color }}>{item.product_name}</div>
                    <div style={{ fontSize: "9px", color: colors.accent_color, fontFamily: "'JetBrains Mono', monospace" }}>{item.product_code}</div>
                  </td>
                  <td style={{ textAlign: "center", padding: "5px 2px", color: colors.text_color }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", padding: "5px 2px", color: colors.text_color }}>{Number(item.unit_price).toLocaleString()}</td>
                  <td style={{ textAlign: "right", padding: "5px 2px", fontWeight: 500, color: colors.text_color }}>{Number(item.subtotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop: `2px solid ${colors.header_color}`, paddingTop: "8px", fontSize: "11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: colors.accent_color }}>Subtotal</span>
              <span style={{ color: colors.text_color }}>{Number(data.order_value).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span style={{ color: colors.accent_color }}>Advance</span>
              <span style={{ color: colors.text_color }}>-{Number(data.advance).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, fontSize: "13px", borderTop: `1px solid ${colors.border_color}`, marginTop: "4px" }}>
              <span style={{ color: colors.text_color }}>Total Due</span>
              <span style={{ color: colors.text_color }}>{Number(data.total_due).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: colors.primary_color, fontWeight: 600 }}>
              <span>COD</span>
              <span>{Number(data.cod).toLocaleString()}</span>
            </div>
          </div>

          {/* Note */}
          {data.note && (
            <div style={{ marginTop: "8px", padding: "6px 8px", background: "#fffde7", borderRadius: "4px", fontSize: "10px", color: colors.accent_color, border: `1px solid ${colors.border_color}` }}>
              <strong>Note:</strong> {data.note}
            </div>
          )}

          {/* QR Code */}
          {data.invoice_url && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <QRCodeSVG value={data.invoice_url} size={64} level="M" />
              <div style={{ fontSize: "8px", color: colors.accent_color, marginTop: "2px" }}>Scan for digital copy</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "14px", paddingTop: "8px", borderTop: `1px dashed ${colors.border_color}`, fontSize: "9px", color: colors.accent_color }}>
            ধন্যবাদ। আবার কেনাকাটা করার জন্য আপনাকে আমন্ত্রণ জানাচ্ছি।
            {company.website && <div>{company.website}</div>}
          </div>
        </div>
      </div>
    );
  }
);

InvoicePreview.displayName = "InvoicePreview";
