import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Shield, Eye } from "lucide-react";

export function SectionNav() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="flex items-center justify-center gap-1.5">
      <Link
        to="/admin/login"
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
          isAdmin
            ? "gradient-gold text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}
      >
        <Shield className="h-3.5 w-3.5" />
        Admin
      </Link>
      <Link
        to="/view"
        className={cn(
          "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
          !isAdmin
            ? "gradient-gold text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}
      >
        <Eye className="h-3.5 w-3.5" />
        Viewer
      </Link>
    </div>
  );
}
