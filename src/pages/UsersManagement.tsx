import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, UserCog, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionToggles } from "@/components/PermissionToggles";
import type { Tables, Enums } from "@/integrations/supabase/types";

type UserProfile = Tables<"users"> & { role?: Enums<"app_role"> };

export default function UsersManagement() {
  const { user, role: myRole } = useAuth();
  const { log } = useActivityLog();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "sub_admin" as Enums<"app_role"> });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-management"],
    queryFn: async () => {
      const { data: usersData, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: rolesData } = await supabase.from("user_roles").select("*");
      const rolesMap = new Map(rolesData?.map((r) => [r.user_id, r.role]));
      return (usersData as Tables<"users">[]).map((u) => ({
        ...u,
        role: rolesMap.get(u.auth_id),
      })) as UserProfile[];
    },
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.user_code.toLowerCase().includes(search.toLowerCase())
  );

  const createUserMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { name: values.name, email: values.email, phone: values.phone || null, password: values.password, role: values.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { ...values, user_id: data.user_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "User created", description: "The user can now log in immediately." });
      log("created", "user", result.user_id, { name: result.name, email: result.email, role: result.role });
      setDialogOpen(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active, user_name }: { id: string; is_active: boolean; user_name: string }) => {
      const { error } = await supabase.from("users").update({ is_active }).eq("id", id);
      if (error) throw error;
      return { id, is_active, user_name };
    },
    onSuccess: ({ id, is_active, user_name }) => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "User status updated" });
      log(is_active ? "activated" : "deactivated", "user", id, { name: user_name });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
    createUserMutation.mutate(form);
  };

  const roleLabel = (role?: string) => {
    switch (role) {
      case "main_admin": return "Admin";
      case "sub_admin": return "Sub Admin";
      case "moderator": return "Moderator";
      default: return "Unknown";
    }
  };

  const roleBadgeClass = (role?: string) => {
    switch (role) {
      case "main_admin": return "bg-secondary text-secondary-foreground";
      case "sub_admin": return "bg-accent text-accent-foreground";
      case "moderator": return "bg-muted text-foreground";
      default: return "";
    }
  };

  // Can toggle permissions for: moderators (any admin/sub_admin), sub_admins (only main_admin)
  const canToggle = (targetRole?: string) => {
    if (targetRole === "moderator") return myRole === "main_admin" || myRole === "sub_admin";
    if (targetRole === "sub_admin") return myRole === "main_admin";
    return false;
  };

  const toggleExpand = (authId: string) => {
    setExpandedUser((prev) => (prev === authId ? null : authId));
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">Manage team members and permissions</p>
        </div>
        <Button onClick={() => { setForm({ name: "", email: "", phone: "", password: "", role: "sub_admin" }); setDialogOpen(true); }} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background/50 border-border text-card-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UserCog className="mb-4 h-12 w-12" /><p>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <>
                      <TableRow key={u.id}>
                        <TableCell>
                          {canToggle(u.role) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(u.auth_id)}>
                              {expandedUser === u.auth_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{u.user_code}</TableCell>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell><Badge className={roleBadgeClass(u.role)}>{roleLabel(u.role)}</Badge></TableCell>
                        <TableCell>
                          {u.is_active ? <Badge className="bg-success text-success-foreground">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {u.role !== "main_admin" && (
                            <Switch
                              checked={u.is_active}
                              onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: u.id, is_active: checked, user_name: u.name })}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedUser === u.auth_id && canToggle(u.role) && (
                        <TableRow key={`${u.id}-perms`}>
                          <TableCell colSpan={7} className="bg-muted/30 px-8 py-4">
                            <p className="text-sm font-semibold mb-3">Permissions for {u.name}</p>
                            <PermissionToggles userId={u.auth_id} userRole={u.role || ""} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Enums<"app_role"> })}>
                <SelectTrigger className="bg-background/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub_admin">Sub Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
