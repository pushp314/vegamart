import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Bell, Search, Menu, User, LogOut, ChevronDown } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NavItem {
  id?: string;
  title: string;
  url?: string;
  icon: React.ElementType;
  onClick?: () => void;
}

interface PortalLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  activeItemId?: string;
  portalName: string;
  userEmail?: string;
  onLogout?: () => void;
}

export function PortalLayout({ children, navItems, activeItemId, portalName, userEmail, onLogout }: PortalLayoutProps) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground font-sans selection:bg-primary/30">
        <Sidebar variant="inset" className="border-r border-border bg-card">
          <SidebarHeader className="flex h-16 items-center justify-center border-b border-border px-6 bg-card">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary font-display">
              <span className="bg-primary text-primary-foreground p-1 rounded-lg">
                V
              </span>
              egamart {portalName}
            </Link>
          </SidebarHeader>
          <SidebarContent className="bg-card">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = activeItemId 
                      ? activeItemId === item.id 
                      : (item.url && (location.pathname === item.url || (item.url !== '#' && location.pathname.startsWith(item.url + '?'))));
                    
                    return (
                      <SidebarMenuItem key={item.title} className="mb-1">
                        <SidebarMenuButton
                          asChild
                          isActive={!!isActive}
                          tooltip={item.title}
                          className={`transition-all duration-300 py-6 px-4 rounded-xl ${
                            isActive 
                              ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(16,185,129,0.05)] font-bold" 
                              : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent font-medium"
                          }`}
                        >
                          {item.onClick ? (
                            <button onClick={item.onClick} className="flex items-center w-full">
                              <item.icon className="h-4 w-4 mr-2" />
                              <span>{item.title}</span>
                            </button>
                          ) : (
                            <Link to={item.url as any} className="flex items-center w-full">
                              <item.icon className="h-4 w-4 mr-2" />
                              <span>{item.title}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4 bg-card">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-3 py-7 h-auto rounded-2xl hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-10 w-10 rounded-full bg-accent border border-border text-foreground flex items-center justify-center font-bold">
                      {userEmail ? userEmail.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col items-start flex-1 text-left overflow-hidden">
                      <span className="text-sm font-bold leading-none truncate w-full text-foreground">{userEmail || 'Account'}</span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1.5">{portalName}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border-border text-popover-foreground">
                <DropdownMenuLabel className="text-foreground">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="hover:bg-accent focus:bg-accent cursor-pointer">Profile Settings</DropdownMenuItem>
                <DropdownMenuItem className="hover:bg-accent focus:bg-accent cursor-pointer">Support</DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={onLogout} className="text-destructive font-bold hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
          {/* Subtle Background Gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
          
          <header className="sticky top-0 z-30 flex h-20 shrink-0 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-xl">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <div className="flex-1">
              <form className="hidden sm:flex items-center max-w-sm relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search ${portalName}...`}
                  className="w-full appearance-none bg-muted/50 border-border text-foreground pl-10 h-10 shadow-none rounded-2xl focus-visible:ring-primary/50 placeholder:text-muted-foreground"
                />
              </form>
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground hover:bg-accent rounded-full h-10 w-10">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary animate-pulse border border-background"></span>
                <span className="sr-only">Toggle notifications</span>
              </Button>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative z-10">
            <div className="mx-auto max-w-7xl space-y-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
