import { NavLink, Outlet } from "react-router-dom";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Menu } from "lucide-react";
import Brand from "@/components/brand.tsx";
import SignInScreen from "@/components/signin-screen.tsx";
import DeviceGuard from "@/components/device-guard.tsx";
import { NAV_ITEMS } from "@/lib/nav.ts";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useRole } from "@/hooks/use-role.ts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger } from
"@/components/ui/sheet.tsx";

function NavLinks({ onNavigate }: {onNavigate?: () => void;}) {
  const { role } = useRole();

  const visibleItems = NAV_ITEMS.filter((i) => !i.roles || role && i.roles.includes(role));

  const groups: Array<{label: string | null;items: typeof visibleItems;}> = [];
  const ungrouped = visibleItems.filter((i) => !i.group);
  if (ungrouped.length) groups.push({ label: null, items: ungrouped });
  const groupNames = [...new Set(visibleItems.filter((i) => i.group).map((i) => i.group!))];
  for (const g of groupNames) {
    groups.push({ label: g, items: visibleItems.filter((i) => i.group === g) });
  }

  return (
    <nav className="flex flex-col gap-1">
      {groups.map((group) =>
      <div key={group.label ?? "__main__"}>
          {group.label &&
        <div className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.label}
            </div>
        }
          {group.items.map((item) =>
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
          cn(
            "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActive ?
            "bg-sidebar-accent text-sidebar-accent-foreground font-medium" :
            "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )
          }>
          
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
        )}
        </div>
      )}
    </nav>);

}

/** Name displayed at sidebar footer */
function SidebarUserName() {
  const { user } = useAuth();
  return (
    <div className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
      {user?.profile.name ?? user?.profile.email ?? "Pengguna"}
    </div>);

}

function Shell() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Brand
          className="mb-6 text-sidebar-foreground"
          subtitleClassName="text-sidebar-foreground/60" />
        
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="mt-4 border-t border-sidebar-border pt-3">
          <SidebarUserName />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Buka menu">
                  
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 flex-col border-sidebar-border bg-sidebar p-4">
                
                <SheetHeader className="p-0">
                  <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
                </SheetHeader>
                <Brand
                  className="mb-4"
                  subtitleClassName="text-sidebar-foreground/60" />
                
                <div className="flex-1 overflow-y-auto">
                  <NavLinks />
                </div>
                <div className="mt-4 border-t border-sidebar-border pt-3">
                  <SidebarUserName />
                </div>
              </SheetContent>
            </Sheet>
            <div className="md:hidden">
              <Brand subtitleClassName="text-muted-foreground" />
            </div>
          </div>
          {/* Logout button: icon-only on mobile, with text on desktop */}
          <div className="flex items-center">
            <SignInButton size="icon" variant="secondary" signOutText="" signInText="" className="md:hidden" />
            <SignInButton size="sm" variant="secondary" signOutText="Keluar" className="hidden md:flex text-neutral-50 bg-red-800" />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>);

}

export default function AppLayout() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen space-y-4 p-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>
      <Authenticated>
        <DeviceGuard>
          <Shell />
        </DeviceGuard>
      </Authenticated>
    </>);

}