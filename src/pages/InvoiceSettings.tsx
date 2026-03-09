import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInvoiceSettings, defaultInvoiceSettings, InvoiceSettingsHistory } from "@/hooks/useInvoiceSettings";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InvoicePreview } from "@/components/InvoicePreview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Save,
  X,
  RotateCcw,
  History,
  Palette,
  ImageIcon,
  ArrowUpDown,
  Loader2,
} from "lucide-react";

// Predefined theme colors
const THEME_COLORS = [
  { name: "Blue", value: "#3b6cf5" },
  { name: "Navy", value: "#1a1a2e" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Teal", value: "#14b8a6" },
];

const COLOR_FIELDS = [
  { key: "primary_color", label: "Primary Color", description: "Invoice code, COD amount, main accents" },
  { key: "secondary_color", label: "Secondary Color", description: "Company name, headings" },
  { key: "accent_color", label: "Accent Color", description: "Labels, muted text" },
  { key: "text_color", label: "Text Color", description: "Main body text" },
  { key: "header_color", label: "Header Color", description: "Header border, section dividers" },
  { key: "border_color", label: "Border Color", description: "Table borders, separators" },
  { key: "background_color", label: "Background Color", description: "Invoice background" },
] as const;

// Sample data for preview
const sampleInvoiceData = {
  invoice_code: "A0042",
  customer_name: "রফিকুল ইসলাম",
  customer_phone: "+880 1712-345678",
  customer_address: "ঢাকা, বাংলাদেশ",
  order_value: 2500,
  advance: 500,
  total_due: 2000,
  cod: 2000,
  note: "ধন্যবাদ। আবার কেনাকাটা করার জন্য আপনাকে আমন্ত্রণ জানাচ্ছি।",
  status: "Pending",
  created_at: new Date().toISOString(),
  items: [
    { product_name: "বাংলা পণ্যের নাম", product_code: "A0001", quantity: 2, unit_price: 1000, subtotal: 2000 },
    { product_name: "Premium Widget", product_code: "A0002", quantity: 1, unit_price: 500, subtotal: 500 },
  ],
  invoice_url: null,
};

export default function InvoiceSettings() {
  const { role } = useAuth();
  const { toast } = useToast();
  const { settings, isLoading, history, save, isSaving, restoreVersion, isRestoring } = useInvoiceSettings();
  const { settings: companySettings } = useCompanySettings();
  
  const canEdit = role === "main_admin" || role === "sub_admin";

  // Form state
  const [useBackgroundImage, setUseBackgroundImage] = useState(defaultInvoiceSettings.use_background_image);
  const [primaryColor, setPrimaryColor] = useState(defaultInvoiceSettings.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(defaultInvoiceSettings.secondary_color);
  const [accentColor, setAccentColor] = useState(defaultInvoiceSettings.accent_color);
  const [textColor, setTextColor] = useState(defaultInvoiceSettings.text_color);
  const [headerColor, setHeaderColor] = useState(defaultInvoiceSettings.header_color);
  const [borderColor, setBorderColor] = useState(defaultInvoiceSettings.border_color);
  const [backgroundColor, setBackgroundColor] = useState(defaultInvoiceSettings.background_color);
  
  const [initialized, setInitialized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Initialize form from settings
  useEffect(() => {
    if (settings && !initialized) {
      setUseBackgroundImage(settings.use_background_image);
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
      setAccentColor(settings.accent_color);
      setTextColor(settings.text_color);
      setHeaderColor(settings.header_color);
      setBorderColor(settings.border_color);
      setBackgroundColor(settings.background_color);
      setInitialized(true);
    }
  }, [settings, initialized]);

  // Color state setters map
  const colorSetters: Record<string, (v: string) => void> = {
    primary_color: setPrimaryColor,
    secondary_color: setSecondaryColor,
    accent_color: setAccentColor,
    text_color: setTextColor,
    header_color: setHeaderColor,
    border_color: setBorderColor,
    background_color: setBackgroundColor,
  };

  const colorValues: Record<string, string> = {
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    accent_color: accentColor,
    text_color: textColor,
    header_color: headerColor,
    border_color: borderColor,
    background_color: backgroundColor,
  };

  // Preview data
  const previewData = useMemo(() => ({
    ...sampleInvoiceData,
    company: {
      name: companySettings?.name || "Your Company",
      logo_url: companySettings?.logo_url || "",
      address: companySettings?.address || "123 Business St, City",
      phone: companySettings?.phone || "+880 1700-000000",
      email: companySettings?.email || "info@company.com",
      website: companySettings?.website || "www.company.com",
    },
    colors: {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      text_color: textColor,
      header_color: headerColor,
      border_color: borderColor,
      background_color: backgroundColor,
    },
    use_background_image: useBackgroundImage,
  }), [companySettings, primaryColor, secondaryColor, accentColor, textColor, headerColor, borderColor, backgroundColor, useBackgroundImage]);

  // Check if there are unsaved changes
  const hasChanges = settings && (
    settings.use_background_image !== useBackgroundImage ||
    settings.primary_color !== primaryColor ||
    settings.secondary_color !== secondaryColor ||
    settings.accent_color !== accentColor ||
    settings.text_color !== textColor ||
    settings.header_color !== headerColor ||
    settings.border_color !== borderColor ||
    settings.background_color !== backgroundColor
  );

  const handleSave = async () => {
    try {
      await save({
        id: settings?.id,
        use_background_image: useBackgroundImage,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        text_color: textColor,
        header_color: headerColor,
        border_color: borderColor,
        background_color: backgroundColor,
      });
      toast({ title: "Invoice settings saved!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = () => {
    if (settings) {
      setUseBackgroundImage(settings.use_background_image);
      setPrimaryColor(settings.primary_color);
      setSecondaryColor(settings.secondary_color);
      setAccentColor(settings.accent_color);
      setTextColor(settings.text_color);
      setHeaderColor(settings.header_color);
      setBorderColor(settings.border_color);
      setBackgroundColor(settings.background_color);
      toast({ title: "Changes discarded" });
    }
  };

  const handleResetToDefault = () => {
    setUseBackgroundImage(defaultInvoiceSettings.use_background_image);
    setPrimaryColor(defaultInvoiceSettings.primary_color);
    setSecondaryColor(defaultInvoiceSettings.secondary_color);
    setAccentColor(defaultInvoiceSettings.accent_color);
    setTextColor(defaultInvoiceSettings.text_color);
    setHeaderColor(defaultInvoiceSettings.header_color);
    setBorderColor(defaultInvoiceSettings.border_color);
    setBackgroundColor(defaultInvoiceSettings.background_color);
    toast({ title: "Reset to default values", description: "Click Save to apply changes" });
  };

  const handleRestoreVersion = async (hist: InvoiceSettingsHistory) => {
    if (!settings) return;
    try {
      await restoreVersion({ settingsId: settings.id, history: hist });
      // Update local state
      setUseBackgroundImage(hist.use_background_image);
      setPrimaryColor(hist.primary_color);
      setSecondaryColor(hist.secondary_color);
      setAccentColor(hist.accent_color);
      setTextColor(hist.text_color);
      setHeaderColor(hist.header_color);
      setBorderColor(hist.border_color);
      setBackgroundColor(hist.background_color);
      toast({ title: `Restored version ${hist.version_number}` });
      setHistoryOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => 
      sortOrder === "desc" 
        ? b.version_number - a.version_number 
        : a.version_number - b.version_number
    );
  }, [history, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6" /> Invoice Settings
        </h1>
        <p className="text-muted-foreground">Customize invoice appearance and colors</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Background Image Card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5" /> Background Image
              </CardTitle>
              <CardDescription>Use company logo as invoice background</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="bg-toggle">Enable Background</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {useBackgroundImage ? "Company logo will appear as watermark" : "Default plain background"}
                  </p>
                </div>
                <Switch
                  id="bg-toggle"
                  checked={useBackgroundImage}
                  onCheckedChange={setUseBackgroundImage}
                  disabled={!canEdit}
                />
              </div>
              {useBackgroundImage && !companySettings?.logo_url && (
                <p className="text-xs text-warning mt-2">
                  ⚠️ No company logo uploaded. Go to Settings → Company to add one.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Color Customization Card */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5" /> Color Customization
              </CardTitle>
              <CardDescription>Select from 7 theme colors for each element</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {COLOR_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">{field.label}</Label>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-6 w-6 rounded border border-border" 
                        style={{ backgroundColor: colorValues[field.key] }} 
                      />
                      <Select
                        value={colorValues[field.key]}
                        onValueChange={(v) => colorSetters[field.key](v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {THEME_COLORS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="h-3 w-3 rounded-full border" 
                                  style={{ backgroundColor: color.value }} 
                                />
                                {color.name}
                              </div>
                            </SelectItem>
                          ))}
                          <SelectItem value="#ffffff">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full border bg-white" />
                              White
                            </div>
                          </SelectItem>
                          <SelectItem value="#dddddd">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full border bg-gray-300" />
                              Gray
                            </div>
                          </SelectItem>
                          <SelectItem value="#555555">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full border bg-gray-600" />
                              Dark Gray
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!canEdit || isSaving}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={!canEdit || !hasChanges}
                >
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetToDefault}
                  disabled={!canEdit}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset to Default
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setHistoryOpen(true)}
                  disabled={history.length === 0}
                >
                  <History className="mr-2 h-4 w-4" /> History ({history.length})
                </Button>
              </div>
              {hasChanges && (
                <p className="text-xs text-warning mt-3">
                  ⚠️ You have unsaved changes
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Live Preview</CardTitle>
              <CardDescription>Real-time preview with Bangla text support</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <InvoicePreview data={previewData} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <History className="h-5 w-5" /> Version History
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Max 5 versions stored permanently
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            >
              <ArrowUpDown className="mr-1 h-4 w-4" />
              {sortOrder === "desc" ? "Newest First" : "Oldest First"}
            </Button>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {sortedHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No history yet</p>
              ) : (
                sortedHistory.map((hist) => (
                  <div
                    key={hist.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">v{hist.version_number}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(hist.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {[hist.primary_color, hist.secondary_color, hist.header_color].map((c, i) => (
                          <div
                            key={i}
                            className="h-3 w-3 rounded-full border"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestoreVersion(hist)}
                      disabled={isRestoring}
                    >
                      {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore"}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
