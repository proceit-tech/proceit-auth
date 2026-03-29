"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Layers3,
  LayoutDashboard,
  Loader2,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  User2,
} from "lucide-react";

type Lang = "es" | "pt";

type RuntimeModule = {
  code: string;
  name: string;
  href: string | null;
  external_url: string | null;
  product_code: string | null;
  enabled: boolean;
};

type RuntimeContext = {
  authenticated: boolean;
  user?: {
    id: string;
    email?: string;
    displayName?: string | null;
  } | null;
  activeTenant?: {
    id: string;
    name?: string;
    code?: string | null;
  } | null;
  membership?: {
    roleCode?: string | null;
  } | null;
  modules?: RuntimeModule[];
};

type MeResponse = {
  ok?: boolean;
  data?: RuntimeContext;
  message?: string;
};

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function emitUiEvent(input: {
  eventName: string;
  lang: Lang;
  detail?: string | null;
  moduleCode?: string | null;
  moduleTarget?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  success?: boolean | null;
}) {
  try {
    const payload = {
      surface: "identity-access-page",
      eventName: input.eventName,
      occurredAt: new Date().toISOString(),
      lang: input.lang,
      detail: input.detail ?? null,
      moduleCode: input.moduleCode ?? null,
      moduleTarget: input.moduleTarget ?? null,
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      success: input.success ?? null,
      pathname:
        typeof window !== "undefined" ? window.location.pathname : "/access",
    };

    console.info("[identity/access-ui-event]", payload);
  } catch {
    /**
     * Não bloquear a UX por falha de telemetria.
     */
  }
}

function resolveModuleIcon(productCode: string | null | undefined) {
  const normalized = (productCode ?? "").trim().toLowerCase();

  if (normalized === "hub" || normalized === "app" || normalized === "core") {
    return LayoutDashboard;
  }

  if (normalized === "control_tower" || normalized === "control-tower") {
    return RadioTower;
  }

  return Layers3;
}

function getSafeExternalUrl(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function SectionHint({
  children,
  tone = "default",
  id,
  ariaLive,
}: {
  children: React.ReactNode;
  tone?: "default" | "error" | "success";
  id?: string;
  ariaLive?: "polite" | "assertive" | "off";
}) {
  const classes =
    tone === "error"
      ? "border-red-400/20 bg-red-500/10 text-red-200"
      : tone === "success"
        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/5 text-white/62";

  return (
    <div
      id={id}
      aria-live={ariaLive}
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${classes}`}
    >
      {children}
    </div>
  );
}

export default function AccessPage() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("es");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeContext | null>(null);
  const [navigatingModule, setNavigatingModule] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const loadRuntime = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        if (silent) {
          setReloading(true);
        } else {
          setLoading(true);
        }

        setError(null);

        emitUiEvent({
          eventName: "IDENTITY_ACCESS_RUNTIME_LOAD_STARTED",
          lang,
          success: null,
        });

        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await parseJsonSafely<MeResponse>(response);

        if (!response.ok) {
          emitUiEvent({
            eventName: "IDENTITY_ACCESS_RUNTIME_LOAD_REDIRECT_LOGIN",
            lang,
            detail: `http_status_${response.status}`,
            success: false,
          });

          router.replace("/login");
          return;
        }

        if (!data?.data?.authenticated || !data?.data?.user?.id) {
          emitUiEvent({
            eventName: "IDENTITY_ACCESS_RUNTIME_LOAD_REDIRECT_LOGIN",
            lang,
            detail: "runtime_not_authenticated",
            success: false,
          });

          router.replace("/login");
          return;
        }

        if (!data?.data?.activeTenant?.id) {
          emitUiEvent({
            eventName: "IDENTITY_ACCESS_RUNTIME_LOAD_REDIRECT_SELECT_TENANT",
            lang,
            detail: "active_tenant_missing",
            userId: data?.data?.user?.id ?? null,
            success: false,
          });

          router.replace("/select-tenant");
          return;
        }

        if (!isMountedRef.current) {
          return;
        }

        setRuntime(data.data);

        emitUiEvent({
          eventName: "IDENTITY_ACCESS_RUNTIME_LOAD_SUCCEEDED",
          lang,
          tenantId: data.data.activeTenant.id,
          userId: data.data.user.id,
          success: true,
        });
      } catch (err) {
        const isAbortError =
          err instanceof DOMException && err.name === "AbortError";

        if (isAbortError) {
          return;
        }

        console.error("[access-page] runtime_load_error", err);

        if (!isMountedRef.current) {
          return;
        }

        const message =
          lang === "es"
            ? "No fue posible cargar el contexto operativo."
            : "Não foi possível carregar o contexto operacional.";

        setError(message);

        emitUiEvent({
          eventName: "IDENTITY_ACCESS_RUNTIME_LOAD_FAILED",
          lang,
          detail:
            err instanceof Error
              ? err.message
              : "unexpected_runtime_load_error",
          success: false,
        });
      } finally {
        if (!isMountedRef.current) {
          return;
        }

        setLoading(false);
        setReloading(false);
      }
    },
    [router, lang],
  );

  useEffect(() => {
    isMountedRef.current = true;
    void loadRuntime();

    return () => {
      isMountedRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadRuntime]);

  const activeTenantName = useMemo(() => {
    return (
      runtime?.activeTenant?.name ||
      runtime?.activeTenant?.code ||
      (lang === "es" ? "No definido" : "Não definido")
    );
  }, [runtime, lang]);

  const activeRole = useMemo(() => {
    return (
      runtime?.membership?.roleCode ||
      (lang === "es" ? "No informado" : "Não informado")
    );
  }, [runtime, lang]);

  const modules = useMemo(() => {
    if (!runtime?.modules) return [];
    return runtime.modules.filter((module) => module.enabled);
  }, [runtime]);

  const modulesCount = modules.length;

  const userDisplayName = useMemo(() => {
    return (
      runtime?.user?.displayName ||
      runtime?.user?.email ||
      runtime?.user?.id ||
      (lang === "es" ? "Usuario no identificado" : "Usuário não identificado")
    );
  }, [runtime, lang]);

  const summaryCards = useMemo(() => {
    return [
      {
        id: "tenant",
        label: lang === "es" ? "Tenant activo" : "Tenant ativo",
        value: activeTenantName,
        icon: Building2,
      },
      {
        id: "role",
        label: lang === "es" ? "Rol operativo" : "Papel operacional",
        value: activeRole,
        icon: ShieldCheck,
      },
      {
        id: "modules",
        label: lang === "es" ? "Módulos habilitados" : "Módulos habilitados",
        value: String(modulesCount),
        icon: Layers3,
      },
      {
        id: "identity",
        label: lang === "es" ? "Identidad activa" : "Identidade ativa",
        value: userDisplayName,
        icon: User2,
      },
    ];
  }, [lang, activeTenantName, activeRole, modulesCount, userDisplayName]);

  async function handleNavigate(module: RuntimeModule) {
    try {
      setNavigatingModule(module.code);

      const externalUrl = getSafeExternalUrl(module.external_url);

      emitUiEvent({
        eventName: "IDENTITY_ACCESS_MODULE_NAVIGATION_STARTED",
        lang,
        moduleCode: module.code,
        moduleTarget: externalUrl || module.href || null,
        tenantId: runtime?.activeTenant?.id ?? null,
        userId: runtime?.user?.id ?? null,
        success: null,
      });

      if (externalUrl) {
        emitUiEvent({
          eventName: "IDENTITY_ACCESS_MODULE_NAVIGATION_EXTERNAL",
          lang,
          moduleCode: module.code,
          moduleTarget: externalUrl,
          tenantId: runtime?.activeTenant?.id ?? null,
          userId: runtime?.user?.id ?? null,
          success: true,
        });

        window.location.assign(externalUrl);
        return;
      }

      if (module.href) {
        emitUiEvent({
          eventName: "IDENTITY_ACCESS_MODULE_NAVIGATION_INTERNAL",
          lang,
          moduleCode: module.code,
          moduleTarget: module.href,
          tenantId: runtime?.activeTenant?.id ?? null,
          userId: runtime?.user?.id ?? null,
          success: true,
        });

        router.push(module.href);
        return;
      }

      emitUiEvent({
        eventName: "IDENTITY_ACCESS_MODULE_NAVIGATION_MISSING_TARGET",
        lang,
        moduleCode: module.code,
        tenantId: runtime?.activeTenant?.id ?? null,
        userId: runtime?.user?.id ?? null,
        detail: "module_without_href_or_external_url",
        success: false,
      });

      console.warn("[access-page] module_without_route", module);
    } finally {
      setNavigatingModule(null);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.10),_transparent_22%),radial-gradient(circle_at_20%_80%,_rgba(14,165,233,0.08),_transparent_18%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.10]" />
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent opacity-90" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6">
        <div className="grid w-full gap-8 xl:grid-cols-[1fr_1.15fr]">
          <section className="hidden xl:flex xl:flex-col xl:justify-center">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300 backdrop-blur">
                PROCEIT ACCESS AUTHORITY
              </div>

              <h1 className="text-5xl font-black tracking-[-0.04em] xl:text-6xl">
                {lang === "es" ? "Contexto resuelto." : "Contexto resolvido."}
                <span className="mt-2 block text-sky-400">
                  {lang === "es"
                    ? "Acceso operativo real por tenant."
                    : "Acesso operacional real por tenant."}
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-white/68">
                {lang === "es"
                  ? "La identidad, la empresa activa y los permisos ya fueron definidos. Este punto organiza la entrada autorizada a productos, módulos y superficies operativas del ecosistema PROCEIT."
                  : "A identidade, a empresa ativa e as permissões já foram definidas. Este ponto organiza a entrada autorizada para produtos, módulos e superfícies operacionais do ecossistema PROCEIT."}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">
                    {lang === "es"
                      ? "Governanza resuelta"
                      : "Governança resolvida"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "Los módulos visibles dependen del tenant activo, del rol vigente y del runtime autenticado."
                      : "Os módulos visíveis dependem do tenant ativo, do papel vigente e do runtime autenticado."}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <RadioTower className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">
                    Control Tower Ready
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "La navegación ya queda preparada para observabilidad, trazabilidad y eventos operativos estructurados."
                      : "A navegação já fica preparada para observabilidade, rastreabilidade e eventos operacionais estruturados."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

              <div className="p-6 sm:p-8">
                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
                      {lang === "es"
                        ? "Runtime operativo"
                        : "Runtime operacional"}
                    </div>

                    <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {lang === "es"
                        ? "Acceso operativo"
                        : "Acesso operacional"}
                    </h2>

                    <p className="mt-2 text-sm leading-7 text-white/60">
                      {lang === "es"
                        ? "Módulos habilitados por tenant, rol y contexto autenticado real."
                        : "Módulos habilitados por tenant, papel e contexto autenticado real."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
                      <button
                        type="button"
                        onClick={() => setLang("es")}
                        aria-pressed={lang === "es"}
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
                        aria-pressed={lang === "pt"}
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
                      onClick={() => void loadRuntime({ silent: true })}
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
                </div>

                {loading ? (
                  <div className="flex min-h-[380px] items-center justify-center rounded-3xl border border-white/10 bg-[#0b1220]/55 px-6 py-10">
                    <div className="flex items-center gap-3 text-sm text-white/65">
                      <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                      {lang === "es"
                        ? "Resolviendo contexto operativo..."
                        : "Resolvendo contexto operacional..."}
                    </div>
                  </div>
                ) : error ? (
                  <SectionHint tone="error" ariaLive="assertive">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>{error}</div>
                    </div>
                  </SectionHint>
                ) : runtime ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {summaryCards.map((card) => {
                        const Icon = card.icon;

                        return (
                          <div
                            key={card.id}
                            className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                          >
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              {card.label}
                            </div>

                            <div className="mt-2 break-words text-sm font-semibold text-white">
                              {card.value}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#0b1220]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                            {lang === "es"
                              ? "Lectura ejecutiva"
                              : "Leitura executiva"}
                          </div>

                          <div className="mt-2 text-base font-semibold text-white">
                            {lang === "es"
                              ? "Superficies autorizadas para el tenant activo"
                              : "Superfícies autorizadas para o tenant ativo"}
                          </div>
                        </div>

                        <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                          {lang === "es"
                            ? `${modulesCount} módulo${modulesCount === 1 ? "" : "s"}`
                            : `${modulesCount} módulo${modulesCount === 1 ? "" : "s"}`}
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-7 text-white/56">
                        {lang === "es"
                          ? "Los accesos visibles se resuelven de forma dinámica y dependen del runtime autenticado, del tenant en operación y del rol vigente dentro del ecosistema."
                          : "Os acessos visíveis são resolvidos de forma dinâmica e dependem do runtime autenticado, do tenant em operação e do papel vigente dentro do ecossistema."}
                      </p>
                    </div>

                    {modulesCount === 0 ? (
                      <SectionHint>
                        {lang === "es"
                          ? "No existen módulos habilitados para el contexto actual. Revise licenciamiento, activación por tenant y permisos asociados al usuario."
                          : "Não existem módulos habilitados para o contexto atual. Revise licenciamento, ativação por tenant e permissões associadas ao usuário."}
                      </SectionHint>
                    ) : (
                      <div className="grid gap-4">
                        {modules.map((module) => {
                          const Icon = resolveModuleIcon(module.product_code);
                          const safeExternalUrl = getSafeExternalUrl(
                            module.external_url,
                          );
                          const isNavigating = navigatingModule === module.code;

                          return (
                            <button
                              key={module.code}
                              type="button"
                              onClick={() => void handleNavigate(module)}
                              disabled={Boolean(navigatingModule)}
                              className="group w-full rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-sky-400/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-70"
                              aria-busy={isNavigating}
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                                    <Icon className="h-5 w-5" />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-base font-semibold text-white">
                                        {module.name}
                                      </div>

                                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                                        {module.product_code || "core"}
                                      </span>

                                      {safeExternalUrl ? (
                                        <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                                          {lang === "es" ? "Externo" : "Externo"}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                                          {lang === "es" ? "Interno" : "Interno"}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2 text-sm leading-6 text-white/50">
                                      {module.code}
                                    </div>

                                    <div className="mt-2 text-sm leading-6 text-white/60">
                                      {safeExternalUrl ||
                                        module.href ||
                                        (lang === "es"
                                          ? "Destino no informado"
                                          : "Destino não informado")}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-3">
                                  {isNavigating ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                                  ) : safeExternalUrl ? (
                                    <ArrowUpRight className="h-5 w-5 text-white/35 transition group-hover:text-sky-300" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 text-white/35 transition group-hover:text-sky-300" />
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <SectionHint>
                    {lang === "es"
                      ? "No hay contexto disponible para renderizar la superficie de acceso."
                      : "Não há contexto disponível para renderizar a superfície de acesso."}
                  </SectionHint>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}