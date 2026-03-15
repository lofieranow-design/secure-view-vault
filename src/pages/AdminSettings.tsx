import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Shield, Bell, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  const sections = [
    {
      icon: User,
      title: "Account",
      description: "Manage your account details",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={user?.email || ""} disabled className="rounded-xl bg-muted/30" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">User ID</Label>
            <Input value={user?.id ? user.id.slice(0, 8) + "..." : ""} disabled className="rounded-xl bg-muted/30" />
          </div>
        </div>
      ),
    },
    {
      icon: Shield,
      title: "Security",
      description: "Update your password",
      content: (
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={changingPassword}
            className="gradient-gold text-primary-foreground border-0 hover:opacity-90"
          >
            {changingPassword ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Update Password
          </Button>
        </form>
      ),
    },
    {
      icon: Bell,
      title: "Preferences",
      description: "Configure application behavior",
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm text-foreground">Email notifications</p>
              <p className="text-xs text-muted-foreground">Get notified when a code is used</p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm text-foreground">Auto-expire sessions</p>
              <p className="text-xs text-muted-foreground">Automatically end idle sessions</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <p className="text-xs text-muted-foreground italic">Preference settings coming soon</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <div key={section.title}>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-foreground">{section.title}</h2>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>
              {section.content}
            </div>
            {i < sections.length - 1 && <Separator className="my-0 opacity-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}
