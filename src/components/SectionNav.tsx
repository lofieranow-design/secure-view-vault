import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Shield, Eye } from "lucide-react";

export function SectionNav() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="flex items-center justify-center gap-2">
      <Link
        to="/admin/login"
        className={cn(
          "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          isAdmin
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Shield className="h-3.5 w-3.5" />
        Admin
      </Link>
      <Link
        to="/view"
        className={cn(
          "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          !isAdmin
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <Eye className="h-3.5 w-3.5" />
        Viewer
      </Link>
    </div>
  );
}
