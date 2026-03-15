import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-14 flex items-center border-b border-border bg-background/80 glass px-6">
            <SidebarTrigger className="mr-4" />
            <div className="ml-auto flex items-center gap-3">
              <div className="h-8 w-8 rounded-full gradient-gold flex items-center justify-center text-xs font-bold text-primary-foreground">
                A
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 lg:p-8">
            <div className="mx-auto max-w-7xl animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
