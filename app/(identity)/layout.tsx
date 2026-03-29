"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  ChevronRight,
  Fingerprint,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Orbit,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User2,
  Landmark,
  Network,
  KeyRound,
  ServerCog,
} from "lucide-react";

type Lang = "es" | "pt";

type TenantItem = {
  tenant_id: string;
  role?: string | null;
  tenant_name?: string | null;
};

type MeResponse = {
  user?: {
    id: string;
    email?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    document_number?: string | null;
  } | null;
  tenants?: TenantItem[];
  activeTenantId?: string | null;
};

type IdentityNavItem = {
  href: string;
  labelEs: string;
  labelPt: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: React.ComponentType<{ className?: string }>;
};

type IdentityRuntimeState = {
  userId: string;
  userEmail: string;
  userName: string;
  userDocument: string;
  tenants: TenantItem[];
  activeTenantId: string | null;
  sessionValidated: boolean;
  tenantValidated: boolean;
  membershipValidated: boolean;
  runtimeLoadedAt: string | null;
};

const navItems: IdentityNavItem[] = [
  {
    href: "/access",
    labelEs: "Access Hub",
    labelPt: "Access Hub",
    descriptionEs: "Visión central del acceso autenticado.",
    descriptionPt: "Visão central do acesso autenticado.",
    icon: LayoutDashboard,
  },
  {
    href: "/account",
    labelEs: "Cuenta",
    labelPt: "Conta",
    descriptionEs: "Datos principales de identidad y contexto.",
    descriptionPt: "Dados principais de identidade e contexto.",
    icon: User2,
  },
  {
    href: "/security",
    labelEs: "Seguridad",
    labelPt: "Segurança",
    descriptionEs: "Postura actual de sesión, tenant y runtime.",
    descriptionPt: "Postura atual de sessão, tenant e runtime.",
    icon: LockKeyhole,
  },
];

const INITIAL_RUNTIME: IdentityRuntimeState = {
  userId: "",
  userEmail: "",
  userName: "",
  userDocument: "",
  tenants: [],
  activeTenantId: null,
  sessionValidated: false,
  tenantValidated: false,
  membershipValidated: false,
  runtimeLoadedAt: null,
};

function formatRuntimeTimestamp(value: string | null, lang: Lang) {
  if (!value) {
    return lang === "es" ? "No disponible" : "Não disponível";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "es" ? "es-PY" : "pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function IdentityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("es");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<IdentityRuntimeState>(INITIAL_RUNTIME);

  const loadIdentityRuntime = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (!silent) {
          setLoading(true);
        } else {
          setReloading(true);
        }

        setError(null);

        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const data: MeResponse = await response.json();

        if (!data?.user?.id) {
          router.replace("/login");
          return;
        }

        const tenantItems = Array.isArray(data.tenants) ? data.tenants : [];
        const resolvedActiveTenantId =
          typeof data.activeTenantId === "string" && data.activeTenantId.trim()
            ? data.activeTenantId
            : null;

        if (!resolvedActiveTenantId) {
          router.replace("/select-tenant");
          return;
        }

        const activeMembership =
          tenantItems.find(
            (tenant) => tenant.tenant_id === resolvedActiveTenantId
          ) ?? null;

        if (!activeMembership) {
          router.replace("/select-tenant");
          return;
        }

        setRuntime({
          userId: data.user.id ?? "",
          userEmail: data.user.email ?? "",
          userName:
            data.user.display_name ??
            data.user.full_name ??
            data.user.email ??
            data.user.id ??
            "",
          userDocument: data.user.document_number ?? "",
          tenants: tenantItems,
          activeTenantId: resolvedActiveTenantId,
          sessionValidated: true,
          tenantValidated: true,
          membershipValidated: true,
          runtimeLoadedAt: new Date().toISOString(),
        });
      } catch {
        setError(
          lang === "es"
            ? "No fue posible cargar la capa identity del runtime autenticado."
            : "Não foi possível carregar a camada identity do runtime autenticado."
        );

        setRuntime((current) => ({
          ...current,
          sessionValidated: false,
          tenantValidated: false,
          membershipValidated: false,
        }));
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [router, lang]
  );

  useEffect(() => {
    void loadIdentityRuntime();
  }, [loadIdentityRuntime]);

  const activeTenant = useMemo(() => {
    return (
      runtime.tenants.find(
        (tenant) => tenant.tenant_id === runtime.activeTenantId
      ) ?? null
    );
  }, [runtime.tenants, runtime.activeTenantId]);

  const tenantCount = runtime.tenants.length;

  const shellHighlights = useMemo(() => {
    return [
      {
        id: "identity",
        labelEs: "Identidad activa",
        labelPt: "Identidade ativa",
        value:
          runtime.userEmail ||
          runtime.userName ||
          runtime.userId ||
          (lang === "es" ? "No disponible" : "Não disponível"),
        icon: KeyRound,
      },
      {
        id: "tenant",
        labelEs: "Tenant operativo",
        labelPt: "Tenant operacional",
        value:
          activeTenant?.tenant_name ||
          activeTenant?.tenant_id ||
          (lang === "es" ? "No definido" : "Não definido"),
        icon: Landmark,
      },
      {
        id: "role",
        labelEs: "Rol actual",
        labelPt: "Papel atual",
        value:
          activeTenant?.role ||
          (lang === "es" ? "No informado" : "Não informado"),
        icon: LockKeyhole,
      },
      {
        id: "tenants",
        labelEs: "Tenants accesibles",
        labelPt: "Tenants acessíveis",
        value: String(tenantCount),
        icon: Orbit,
      },
    ];
  }, [runtime.userEmail, runtime.userName, runtime.userId, activeTenant, tenantCount, lang]);

  const architectureCards = useMemo(() => {
    return [
      {
        id: "session",
        titleEs: "Sesión central validada",
        titlePt: "Sessão central validada",
        descriptionEs:
          "La identity layer opera sobre el runtime autenticado real y no sobre estados aislados por pantalla.",
        descriptionPt:
          "A identity layer opera sobre o runtime autenticado real e não sobre estados isolados por tela.",
        icon: ShieldCheck,
      },
      {
        id: "tenant",
        titleEs: "Contexto multi-tenant activo",
        titlePt: "Contexto multi-tenant ativo",
        descriptionEs:
          "El tenant activo condiciona navegación, accesos, permisos y evolución del ecosistema.",
        descriptionPt:
          "O tenant ativo condiciona navegação, acessos, permissões e evolução do ecossistema.",
        icon: Building2,
      },
      {
        id: "hardening",
        titleEs: "Base lista para hardening",
        titlePt: "Base pronta para hardening",
        descriptionEs:
          "La capa ya está preparada para RBAC, auditoría, señales avanzadas y Control Tower.",
        descriptionPt:
          "A camada já está preparada para RBAC, auditoria, sinais avançados e Control Tower.",
        icon: ShieldAlert,
      },
    ];
  }, []);

  const strategicLayers = useMemo(() => {
    return [
      {
        id: "auth-core",
        titleEs: "Auth central",
        titlePt: "Auth central",
        icon: Network,
      },
      {
        id: "runtime",
        titleEs: "Runtime operativo",
        titlePt: "Runtime operacional",
        icon: ServerCog,
      },
      {
        id: "monitoring",
        titleEs: "Observabilidad futura",
        titlePt: "Observabilidade futura",
        icon: Activity,
      },
      {
        id: "identity",
        titleEs: "Identity shell",
        titlePt: "Identity shell",
        icon: Fingerprint,
      },
    ];
  }, []);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      setError(null);

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          lang === "es"
            ? "No fue posible cerrar la sesión protegida."
            : "Não foi possível encerrar a sessão protegida."
        );
      }

      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === "es"
            ? "Ocurrió un error inesperado al cerrar la sesión."
            : "Ocorreu um erro inesperado ao encerrar a sessão."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.10),_transparent_22%),radial-gradient(circle_at_20%_80%,_rgba(14,165,233,0.08),_transparent_20%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.10]" />
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent opacity-90" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

          <div className="p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
                  PROCEIT IDENTITY SHELL
                </div>

                <h1 className="mt-5 max-w-4xl text-3xl font-black leading-[0.95] tracking-[-0.04em] sm:text-4xl xl:text-5xl">
                  {lang === "es"
                    ? "Capa transversal de identidad, sesión y contexto"
                    : "Camada transversal de identidade, sessão e contexto"}
                  <span className="block text-sky-400">
                    {lang === "es"
                      ? "para access, account y security."
                      : "para access, account e security."}
                  </span>
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
                  {lang === "es"
                    ? "Este layout consolida la lectura ejecutiva del runtime autenticado, del tenant operativo y de la navegación identity como base premium para permisos, auditoría, observabilidad y evolución del ecosistema PROCEIT."
                    : "Este layout consolida a leitura executiva do runtime autenticado, do tenant operacional e da navegação identity como base premium para permissões, auditoria, observabilidade e evolução do ecossistema PROCEIT."}
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {architectureCards.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
                      >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="text-base font-bold text-white">
                          {lang === "es" ? item.titleEs : item.titlePt}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-white/55">
                          {lang === "es"
                            ? item.descriptionEs
                            : item.descriptionPt}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 xl:max-w-sm">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setLang("es")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        lang === "es"
                          ? "bg-sky-400/15 text-white"
                          : "text-white/55 hover:text-white"
                      }`}
                    >
                      ES
                    </button>

                    <button
                      type="button"
                      onClick={() => setLang("pt")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        lang === "pt"
                          ? "bg-sky-400/15 text-white"
                          : "text-white/55 hover:text-white"
                      }`}
                    >
                      PT
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadIdentityRuntime({ silent: true })}
                    disabled={loading || reloading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 transition hover:border-sky-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reloading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-sky-300" />
                    )}
                    {lang === "es" ? "Actualizar" : "Atualizar"}
                  </button>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {lang === "es"
                      ? "Última verificación"
                      : "Última verificação"}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">
                    {formatRuntimeTimestamp(runtime.runtimeLoadedAt, lang)}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {lang === "es"
                      ? "La capa identity se apoya en el runtime vivo de autenticación y contexto."
                      : "A camada identity se apoia no runtime vivo de autenticação e contexto."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/select-tenant")}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/85 transition hover:border-sky-400/30 hover:text-white"
                  >
                    {lang === "es" ? "Cambiar empresa" : "Alterar empresa"}
                  </button>

                  <button
                    type="button"
                    disabled={loggingOut}
                    onClick={handleLogout}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/15 bg-red-500/5 px-4 text-sm font-semibold text-white transition hover:border-red-400/30 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loggingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    {lang === "es"
                      ? "Cerrar sesión"
                      : "Encerrar sessão"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="flex items-center gap-3 text-sm text-white/65">
              <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
              {lang === "es"
                ? "Cargando identity shell..."
                : "Carregando identity shell..."}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            {error}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
            <aside className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

              <div className="p-5 sm:p-6">
                <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                        {lang === "es" ? "Tenant activo" : "Tenant ativo"}
                      </div>

                      <div className="mt-2 break-words text-base font-semibold text-white">
                        {activeTenant?.tenant_name ||
                          activeTenant?.tenant_id ||
                          (lang === "es" ? "No definido" : "Não definido")}
                      </div>

                      <div className="mt-2 break-words text-sm text-white/50">
                        {runtime.userEmail || runtime.userName || "—"}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                          {lang === "es" ? "Rol" : "Papel"}:{" "}
                          {activeTenant?.role ||
                            (lang === "es"
                              ? "No informado"
                              : "Não informado")}
                        </span>

                        <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                          {runtime.sessionValidated
                            ? lang === "es"
                              ? "Sesión validada"
                              : "Sessão validada"
                            : lang === "es"
                              ? "Sesión pendiente"
                              : "Sessão pendente"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {shellHighlights.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-300">
                            <Icon className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              {lang === "es" ? item.labelEs : item.labelPt}
                            </div>
                            <div className="mt-2 break-words text-sm font-semibold text-white">
                              {item.value}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {lang === "es"
                      ? "Navegación identity"
                      : "Navegação identity"}
                  </div>

                  <div className="space-y-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`group flex items-center justify-between rounded-2xl border px-4 py-4 transition ${
                            active
                              ? "border-sky-400/30 bg-sky-400/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-white/75 hover:border-sky-400/20 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border ${
                                active
                                  ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
                                  : "border-white/10 bg-white/[0.04] text-white/60"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>

                            <div>
                              <div className="text-sm font-semibold">
                                {lang === "es" ? item.labelEs : item.labelPt}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-white/45">
                                {lang === "es"
                                  ? item.descriptionEs
                                  : item.descriptionPt}
                              </div>
                            </div>
                          </div>

                          <ChevronRight
                            className={`h-4 w-4 shrink-0 transition ${
                              active
                                ? "text-sky-300"
                                : "text-white/35 group-hover:text-sky-300"
                            }`}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-300">
                      <ShieldCheck className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-white/85">
                        {lang === "es"
                          ? "Lectura estructural"
                          : "Leitura estrutural"}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-white/55">
                        {lang === "es"
                          ? "Este shell centraliza navegación, sesión, tenant activo y base visual de control para toda la capa identity del ecosistema."
                          : "Este shell centraliza navegação, sessão, tenant ativo e base visual de controle para toda a camada identity do ecossistema."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {strategicLayers.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-[#0b1220]/70 p-4"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-white">
                          {lang === "es" ? item.titleEs : item.titlePt}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                <div className="h-[2px] w-full rounded-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />
                <div className="min-w-0 p-2 sm:p-3">{children}</div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}