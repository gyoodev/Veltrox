"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  Compass,
  Disc3,
  FileClock,
  FolderLock,
  LayoutDashboard,
  type LucideIcon,
  LogOut,
  Megaphone,
  PieChart,
  Send,
  Settings,
  Shield,
  Sliders,
  UserCircle2,
  Users,
  UserSquare2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BulgariaFuelPricesWidget } from "@/components/profile/bulgaria-fuel-prices-widget";
import { useAuth } from "@/components/providers/auth-provider";
import { AnnouncementBanner } from "@/components/shared/announcement-banner";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/shared/logo";
import { NotificationBell } from "@/components/shared/notification-bell";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";
import type { UserProfile } from "@/types/domain";

interface DashboardShellProps {
  profile: UserProfile;
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
  mobilePrimary?: boolean;
}

export function DashboardShell({
  profile: serverProfile,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const { profile: clientProfile, signOut } = useAuth();
  const tShell = useTranslations("shell");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboards");

  const activeProfile = clientProfile ?? serverProfile;

  const isAdminSection =
    pathname === "/admin" || pathname.startsWith("/admin/");

  const isPendingGarage =
    activeProfile.role === "GARAGE_OWNER" &&
    activeProfile.garageStatus !== "approved";

  const isStaffMember =
    activeProfile.role === "GARAGE_OWNER" && Boolean(activeProfile.isStaff);

  const homeHref =
    activeProfile.role === "ADMIN"
      ? isAdminSection
        ? "/admin"
        : "/app"
      : activeProfile.role === "GARAGE_OWNER"
        ? isPendingGarage
          ? "/garage/pending"
          : "/garage"
        : "/app";

  const profileHref =
    activeProfile.role === "ADMIN"
      ? isAdminSection
        ? "/admin/profile"
        : "/app/profile"
      : activeProfile.role === "GARAGE_OWNER"
        ? "/garage/profile"
        : "/app/profile";

  const roleLabel =
    activeProfile.role === "ADMIN"
      ? tShell("adminRole")
      : activeProfile.role === "GARAGE_OWNER"
        ? isStaffMember
          ? activeProfile.staffRole === "receptionist"
            ? tShell("staffRoleReceptionist")
            : tShell("staffRoleMechanic")
          : tShell("garageRole")
        : tShell("ownerRole");

  const buildGarageNavLinks = (): NavItem[] => {
    if (isPendingGarage) {
      return [
        {
          href: "/garage/pending",
          label: tShell("pendingStatus"),
          icon: Clock,
          mobilePrimary: true,
        },
        {
          href: "/garage/profile",
          label: tShell("profile"),
          icon: UserCircle2,
          mobilePrimary: true,
        },
      ];
    }

    const items: NavItem[] = [
      {
        href: "/garage",
        label: tShell("overview"),
        icon: LayoutDashboard,
        mobilePrimary: true,
      },
      {
        href: "/garage/work-orders",
        label: tShell("workOrdersNav"),
        icon: Wrench,
        mobilePrimary: true,
      },
      {
        href: "/garage/customers",
        label: tShell("customersNav"),
        icon: Users,
        mobilePrimary: true,
      },
      {
        href: "/garage/appointments",
        label: tShell("calendarNav"),
        icon: CalendarDays,
        mobilePrimary: true,
      },
      {
        href: "/garage/tyres",
        label: tShell("tyresNav"),
        icon: Disc3,
        mobilePrimary: true,
      },
      {
        href: "/garage/analytics",
        label: tShell("analyticsNav"),
        icon: BarChart3,
        mobilePrimary: false,
      },
    ];

    if (!isStaffMember) {
      items.push(
        {
          href: "/garage/staff",
          label: tShell("staffNav"),
          icon: UserSquare2,
          mobilePrimary: false,
        },
        {
          href: "/garage/settings",
          label: tShell("garageSettingsNav"),
          icon: Settings,
          mobilePrimary: false,
        }
      );
    }

    items.push({
      href: "/garage/profile",
      label: tShell("profile"),
      icon: UserCircle2,
      mobilePrimary: false,
    });

    return items;
  };

  const userNavLinks: NavItem[] = [
    {
      href: "/app",
      label: tShell("overview"),
      icon: LayoutDashboard,
      mobilePrimary: true,
    },
    {
      href: "/app/cars",
      label: tShell("carsNav"),
      icon: Car,
      mobilePrimary: true,
    },
    {
      href: "/app/expenses",
      label: tShell("expensesNav"),
      icon: PieChart,
      mobilePrimary: true,
    },
    {
      href: "/app/reminders",
      label: tShell("remindersNav"),
      icon: BellRing,
      mobilePrimary: true,
    },
    {
      href: "/app/documents",
      label: tShell("documentsNav"),
      icon: FolderLock,
      mobilePrimary: false,
    },
    {
      href: "/app/garages",
      label: tShell("findGarageNav"),
      icon: Compass,
      mobilePrimary: true,
    },
    {
      href: "/app/profile",
      label: tShell("profile"),
      icon: UserCircle2,
      mobilePrimary: false,
    },
  ];

  const adminNavLinks: NavItem[] = [
    {
      href: "/admin",
      label: tShell("overview"),
      icon: Shield,
      mobilePrimary: true,
    },
    {
      href: "/admin/garages",
      label: tShell("garagesNav"),
      icon: Wrench,
      mobilePrimary: true,
    },
    {
      href: "/admin/approvals",
      label: tShell("approvalsNav"),
      icon: Building2,
      mobilePrimary: false,
    },
    {
      href: "/admin/operations",
      label: tShell("operationsNav"),
      icon: ClipboardList,
      mobilePrimary: true,
    },
    {
      href: "/admin/users",
      label: tShell("usersNav"),
      icon: Users,
      mobilePrimary: true,
    },
    {
      href: "/admin/vehicles",
      label: tShell("vehiclesNav"),
      icon: Car,
      mobilePrimary: true,
    },
    {
      href: "/admin/broadcast",
      label: tShell("broadcastNav"),
      icon: Send,
      mobilePrimary: false,
    },
    {
      href: "/admin/settings",
      label: tShell("platformSettingsNav"),
      icon: Sliders,
      mobilePrimary: false,
    },
    {
      href: "/admin/system",
      label: tShell("systemNav"),
      icon: Activity,
      mobilePrimary: true,
    },
    {
      href: "/admin/analytics",
      label: tShell("analyticsNav"),
      icon: BarChart3,
      mobilePrimary: false,
    },
    {
      href: "/admin/content",
      label: tShell("cmsNav"),
      icon: Megaphone,
      mobilePrimary: false,
    },
    {
      href: "/admin/audit-logs",
      label: tShell("auditNav"),
      icon: FileClock,
      mobilePrimary: false,
    },
    {
      href: "/admin/profile",
      label: tShell("profile"),
      icon: UserCircle2,
      mobilePrimary: false,
    },
  ];

  const navLinks: NavItem[] =
    activeProfile.role === "GARAGE_OWNER"
      ? buildGarageNavLinks()
      : activeProfile.role === "ADMIN" && isAdminSection
        ? adminNavLinks
        : userNavLinks;

  const mobileLinks = navLinks.filter((i) => i.mobilePrimary);

  const isNavItemActive = (href: string): boolean => {
    if (href === "/app" || href === "/garage" || href === "/admin") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row print:block print:bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        {tShell("skipToContent")}
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-xl md:flex print:hidden">
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Logo href={homeHref} />
        </div>

        <div className="px-4 py-4">
          <div className="rounded-2xl border border-border bg-secondary/40 p-3.5">
            <p className="truncate text-sm font-semibold text-foreground">
              {activeProfile.displayName}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant={isStaffMember ? "violet" : "default"}>
                {roleLabel}
              </Badge>
              {activeProfile.role === "GARAGE_OWNER" && !isStaffMember ? (
                <Badge
                  variant={
                    activeProfile.garageStatus === "approved"
                      ? "success"
                      : "warning"
                  }
                >
                  {activeProfile.garageStatus === "approved"
                    ? tCommon("statusApproved")
                    : activeProfile.garageStatus === "rejected"
                      ? tCommon("statusRejected")
                      : tCommon("statusPending")}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Workspace">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = !item.disabled && isNavItemActive(item.href);

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="flex min-h-11 items-center justify-between rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground/60"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.badge ? (
                    <Badge variant="outline" className="text-[10px]">
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-veltrox-gradient text-white shadow-glow-blue"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {activeProfile.role === "ADMIN" ? (
          <div className="px-3 pb-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(
                "w-full justify-start h-9 gap-2 text-xs font-semibold rounded-xl transition-all shadow-sm",
                isAdminSection
                  ? "border-primary/45 text-primary bg-primary/[0.08] hover:bg-primary/15"
                  : "border-amber-500/50 text-amber-400 bg-amber-500/[0.08] hover:bg-amber-500/15"
              )}
            >
              <Link href={isAdminSection ? "/app" : "/admin"}>
                {isAdminSection ? (
                  <>
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tShell("userPanelBtn")}</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 shrink-0 text-amber-400" />
                    <span className="truncate">{tShell("adminPanelBtn")}</span>
                  </>
                )}
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="border-t border-border p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4" />
            {tCommon("signOut")}
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col pb-20 md:pb-0 print:pb-0">
        {/* Top Bar */}
        <header className="glass-panel sticky top-0 z-20 flex h-16 items-center justify-between px-4 sm:px-8 print:hidden">
          <div className="flex items-center gap-3 md:hidden">
            <Logo href={homeHref} />
          </div>
          <div className="hidden md:block">
            <Badge variant="outline" className="font-mono text-xs">
              {activeProfile.email}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {activeProfile.role === "ADMIN" ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(
                  "hidden md:inline-flex h-8 gap-1.5 px-2.5 text-xs font-semibold mr-1 shadow-sm transition-all rounded-xl",
                  isAdminSection
                    ? "border-primary/45 text-primary bg-primary/[0.08] hover:bg-primary/15"
                    : "border-amber-500/50 text-amber-400 bg-amber-500/[0.08] hover:bg-amber-500/15"
                )}
              >
                <Link href={isAdminSection ? "/app" : "/admin"}>
                  {isAdminSection ? (
                    <>
                      <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                      <span>{tShell("userPanelBtn")}</span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span>{tShell("adminPanelBtn")}</span>
                    </>
                  )}
                </Link>
              </Button>
            ) : null}

            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={activeProfile.displayName}
                  className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar className="h-10 w-10">
                    {activeProfile.avatarUrl ? (
                      <AvatarImage
                        src={activeProfile.avatarUrl}
                        alt={activeProfile.displayName}
                      />
                    ) : null}
                    <AvatarFallback>
                      {getInitials(activeProfile.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="normal-case">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {activeProfile.displayName}
                  </p>
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {activeProfile.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activeProfile.role === "USER" ? (
                  <DropdownMenuItem asChild>
                    <Link href="/app/documents">
                      <FolderLock className="h-4 w-4" />
                      {tShell("documentsNav")}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {activeProfile.role === "GARAGE_OWNER" && !isPendingGarage ? (
                  <DropdownMenuItem asChild>
                    <Link href="/garage/analytics">
                      <BarChart3 className="h-4 w-4" />
                      {tShell("analyticsNav")}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {activeProfile.role === "GARAGE_OWNER" &&
                !isPendingGarage &&
                !isStaffMember ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/garage/staff">
                        <UserSquare2 className="h-4 w-4" />
                        {tShell("staffNav")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/garage/settings">
                        <Settings className="h-4 w-4" />
                        {tShell("garageSettingsNav")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                {activeProfile.role === "ADMIN" ? (
                  <div className="p-1 mb-1">
                    <Link
                      href={isAdminSection ? "/app" : "/admin"}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-all shadow-sm",
                        isAdminSection
                          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {isAdminSection ? (
                          <>
                            <LayoutDashboard className="h-4 w-4 text-primary" />
                            <span>{tShell("userPanelBtn")}</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 text-amber-400" />
                            <span>{tShell("adminPanelBtn")}</span>
                          </>
                        )}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 font-mono font-bold",
                          isAdminSection
                            ? "border-primary/40 text-primary"
                            : "border-amber-500/40 text-amber-400"
                        )}
                      >
                        {isAdminSection ? "USER" : "ADMIN"}
                      </Badge>
                    </Link>
                  </div>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href={profileHref}>
                    <UserCircle2 className="h-4 w-4" />
                    {tShell("profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void signOut()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  {tCommon("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile-only Admin Quick-Switch Strip */}
        {activeProfile.role === "ADMIN" ? (
          <div className="md:hidden border-b border-border/70 bg-secondary/40 backdrop-blur px-4 py-2 flex items-center justify-between text-xs print:hidden">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isAdminSection ? "bg-amber-400 animate-pulse" : "bg-primary"
                )}
              />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {isAdminSection ? "Админ режим" : "Потребителски"}
              </span>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className={cn(
                "h-7 text-xs px-2.5 py-0 rounded-lg font-semibold gap-1.5 shadow-sm transition-all",
                isAdminSection
                  ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
                  : "border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
              )}
            >
              <Link href={isAdminSection ? "/app" : "/admin"}>
                {isAdminSection ? (
                  <>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>Към Потребителски</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                    <span>Към Админ панел</span>
                  </>
                )}
              </Link>
            </Button>
          </div>
        ) : null}

        <AnnouncementBanner />

        {/* Email Verification Reminder Banner */}
        {!activeProfile.emailVerified ? (
          <div className="border-b border-orange-500/30 bg-orange-500/10 px-4 py-3 sm:px-8 print:hidden">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <div>
                  <span className="font-semibold text-foreground">
                    {tDash("unverifiedBannerTitle")}:{" "}
                  </span>
                  <span className="text-muted-foreground">
                    {tDash("unverifiedBannerDesc")}
                  </span>
                </div>
              </div>
              <Button asChild variant="warning" size="sm">
                <Link href="/verify-email">{tCommon("verifyNow")}</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-3.5 pt-6 pb-24 sm:px-8 sm:py-8 md:pb-8 print:max-w-none print:p-0"
        >
          {children}

          {/* Global Bulgaria Fuel Prices Widget for All Authenticated Users */}
          <section aria-label="Bulgaria Fuel Prices" className="print:hidden pt-2">
            <BulgariaFuelPricesWidget />
          </section>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Large >=48px Tap Targets) */}
      <nav
        aria-label="Mobile workspace navigation"
        className="glass-panel fixed inset-x-0 bottom-0 z-30 border-t border-border md:hidden print:hidden"
      >
        <div
          className="grid gap-1 px-2 py-1.5 w-full"
          style={{
            gridTemplateColumns: `repeat(${mobileLinks.length}, minmax(0, 1fr))`,
          }}
        >
          {mobileLinks.map((item) => {
            const Icon = item.icon;
            const isActive = !item.disabled && isNavItemActive(item.href);

            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className="flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] text-muted-foreground/50"
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-0.5 truncate">{item.label}</span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="mt-0.5 max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
