import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, UserCog, ChevronDown, ChevronRight, Copy, Link as LinkIcon, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionToggles } from "@/components/PermissionToggles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { format } from "date-fns";

type UserProfile = Tables<"users"> & { role?: Enums<"app_role"> };
type Invitation = Tables<"invitations">;

export default function UsersManagement() {
  const { user, role: myRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<Enums<"app_role">>("sub_admin");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

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

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ["invitations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invitations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Invitation[];
    },
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.user_code.toLowerCase().includes(search.toLowerCase())
  );

  const createInviteMutation = useMutation({
    mutationFn: async (role: Enums<"app_role">) => {
      const { data: orgData } = await supabase.from("users").select("organization_id").eq("auth_id", user!.id).single();
      const { data, error } = await supabase
        .from("invitations")
        .insert({ role, created_by: user!.id, organization_id: orgData?.organization_id } as any)
        .select("token")
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: (token) => {
      const link = `${window.location.origin}/signup?invite=${token}`;
      setGeneratedLink(link);
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast({ title: "Invite link generated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean; user_name: string }) => {
      const { error } = await supabase.from("users").update({ is_active }).eq("id", id);
      if (error) throw error;
      return { id, is_active };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-management"] });
      toast({ title: "User status updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleGenerateInvite = () => {
    setGeneratedLink(null);
    createInviteMutation.mutate(inviteRole);
  };

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast({ title: "Copied to clipboard" });
    }
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

  const canManagePermissions = myRole === "main_admin";

  const canViewPermissions = (targetRole?: string) => {
    return targetRole === "sub_admin" || targetRole === "moderator";
  };

  const toggleExpand = (authId: string) => {
    setExpandedUser((prev) => (prev === authId ? null : authId));
  };

  const getInviteStatus = (inv: Invitation) => {
    if (inv.used_by) return "used";
    if (new Date(inv.expires_at) < new Date()) return "expired";
    return "pending";
  };

  const inviteStatusBadge = (status: string) => {
    switch (status) {
      case "used": return <Badge className="bg-success text-success-foreground"><CheckCircle className="mr-1 h-3 w-3" />Used</Badge>;
      case "expired": return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Expired</Badge>;
      case "pending": return <Badge className="bg-accent text-accent-foreground"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      default: return null;
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text-primary">Users</h1>
          <p className="text-nexus-text-secondary">Manage team members and permissions</p>
        </div>
        <Button onClick={() => { setGeneratedLink(null); setInviteRole("sub_admin"); setDialogOpen(true); }} className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90">
          <Plus className="mr-2 h-4 w-4" /> Generate Invite Link
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-nexus-background border border-nexus-border">
          <TabsTrigger value="users" className="data-[state=active]:bg-nexus-accent data-[state=active]:text-white">Team Members</TabsTrigger>
          <TabsTrigger value="invitations" className="data-[state=active]:bg-nexus-accent data-[state=active]:text-white">Invitation History</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="bg-nexus-card rounded-2xl border border-nexus-border hover:shadow-lg transition-shadow">
            <div className="p-5 sm:p-6">
              <div className="relative max-w-sm mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-nexus-text-secondary" />
                <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-nexus-background border-nexus-border text-nexus-text-primary focus:ring-2 focus:ring-nexus-accent" />
              </div>
              {isLoading ? (
                <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-accent border-t-transparent" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-nexus-text-secondary">
                  <UserCog className="mb-4 h-12 w-12" /><p>No users found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-nexus-border">
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold w-8"></TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Code</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Name</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Email</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Role</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Status</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold text-right">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((u) => (
                        <>
                          <TableRow key={u.id} className="border-nexus-border hover:bg-nexus-background/50">
                            <TableCell>
                              {canViewPermissions(u.role) && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-nexus-background" onClick={() => toggleExpand(u.auth_id)} disabled={!canManagePermissions}>
                                  {expandedUser === u.auth_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-nexus-text-primary">{u.user_code}</TableCell>
                            <TableCell className="font-medium text-nexus-text-primary">{u.name}</TableCell>
                            <TableCell className="text-nexus-text-primary">{u.email}</TableCell>
                            <TableCell><Badge className={roleBadgeClass(u.role)}>{roleLabel(u.role)}</Badge></TableCell>
                            <TableCell>
                              {u.is_active ? <Badge className="bg-nexus-success/10 text-nexus-success border border-nexus-success/20">Active</Badge> : <Badge className="bg-nexus-danger/10 text-nexus-danger border border-nexus-danger/20">Inactive</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              {u.role !== "main_admin" && (
                                <Switch checked={u.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: u.id, is_active: checked, user_name: u.name })} />
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedUser === u.auth_id && canViewPermissions(u.role) && (
                            <TableRow key={`${u.id}-perms`} className="border-nexus-border">
                              <TableCell colSpan={7} className="bg-nexus-background/50 px-8 py-4">
                                <p className="text-sm font-semibold mb-3 text-nexus-text-primary">Permissions for {u.name}</p>
                                <PermissionToggles userId={u.auth_id} userRole={u.role || ""} readOnly={!canManagePermissions} />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="invitations">
          <div className="bg-nexus-card rounded-2xl border border-nexus-border hover:shadow-lg transition-shadow">
            <div className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-nexus-text-primary mb-4">Invitation History</h2>
              {invitationsLoading ? (
                <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-accent border-t-transparent" /></div>
              ) : invitations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-nexus-text-secondary">
                  <LinkIcon className="mb-4 h-12 w-12" /><p>No invitations generated yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-nexus-border">
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Role</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Status</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Created</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Expires</TableHead>
                        <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Invite Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((inv) => {
                        const status = getInviteStatus(inv);
                        const link = `${window.location.origin}/signup?invite=${inv.token}`;
                        return (
                          <TableRow key={inv.id} className="border-nexus-border hover:bg-nexus-background/50">
                            <TableCell><Badge className={roleBadgeClass(inv.role)}>{roleLabel(inv.role)}</Badge></TableCell>
                            <TableCell>{inviteStatusBadge(status)}</TableCell>
                            <TableCell className="text-sm text-nexus-text-secondary">{format(new Date(inv.created_at), "dd MMM yyyy, hh:mm a")}</TableCell>
                            <TableCell className="text-sm text-nexus-text-secondary">{format(new Date(inv.expires_at), "dd MMM yyyy, hh:mm a")}</TableCell>
                            <TableCell>
                              {status === "pending" ? (
                                <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Link copied" }); }} className="hover:bg-nexus-background">
                                  <Copy className="mr-1 h-3 w-3" /> Copy
                                </Button>
                              ) : (
                                <span className="text-xs text-nexus-text-secondary">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-nexus-card border-nexus-border">
          <DialogHeader><DialogTitle className="text-nexus-text-primary">Generate Invite Link</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-nexus-text-primary">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => { setInviteRole(v as Enums<"app_role">); setGeneratedLink(null); }}>
                <SelectTrigger className="bg-nexus-background border-nexus-border text-nexus-text-primary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub_admin">Sub Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-nexus-text-secondary">The user who signs up with this link will automatically be assigned this role.</p>
            </div>

            {generatedLink && (
              <div className="space-y-2">
                <Label className="text-nexus-text-primary">Invite Link</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="bg-nexus-background border-nexus-border text-nexus-text-primary text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={copyLink} className="border-nexus-border hover:bg-nexus-background">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-nexus-text-secondary">This link expires in 7 days. Share it with the user to invite them.</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-nexus-border hover:bg-nexus-background text-nexus-text-secondary">Close</Button>
              <Button
                type="button"
                className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90"
                disabled={createInviteMutation.isPending}
                onClick={handleGenerateInvite}
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                {createInviteMutation.isPending ? "Generating..." : "Generate Link"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
