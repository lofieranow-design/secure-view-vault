import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Shield, Bell, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); setNewPassword(""); setConfirmPassword(""); }
    setChangingPassword(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Account */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Account</h2>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Email</Label>
            <Input value={user?.email || ""} disabled className="h-8 text-[13px] bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">User ID</Label>
            <Input value={user?.id ? user.id.slice(0, 8) + "…" : ""} disabled className="h-8 text-[13px] bg-muted/50" />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Security</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[13px]">New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="h-8 text-[13px]" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-8 text-[13px]" required />
          </div>
          <Button type="submit" disabled={changingPassword} size="sm" className="gradient-gold text-primary-foreground border-0 hover:opacity-90">
            {changingPassword ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Update Password
          </Button>
        </form>
      </div>

      {/* Preferences */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Preferences</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-accent/50 transition-colors">
            <div>
              <p className="text-[13px] text-foreground">Email notifications</p>
              <p className="text-xs text-muted-foreground">Get notified when a code is used</p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-accent/50 transition-colors">
            <div>
              <p className="text-[13px] text-foreground">Auto-expire sessions</p>
              <p className="text-xs text-muted-foreground">Automatically end idle sessions</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <p className="px-3 text-xs text-muted-foreground italic">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
