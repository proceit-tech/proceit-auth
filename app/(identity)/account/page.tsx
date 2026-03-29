"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  CheckCircle2,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  Mail,
  Network,
  RefreshCw,
  ShieldCheck,
  User2,
  Clock,
  Fingerprint,
} from "lucide-react";

type Lang = "es" | "pt";

type RuntimeContext = {
  authenticated: boolean;
  sessionId?: string | null;
  user?: {
    id: string;
    email?: string | null;
    displayName?: string | null;
    fullName?: string | null;
    documentNumber?: string | null;
  } | null;
  activeTenant?: {
    id: string;
    name?: string;
    code?: string | null;
  } | null;
  membership?: {
    roleCode?: string | null;
    status?: string;
  } | null;
  platformRoles?: string[];
  tenantRoles?: string[];
  permissions?: string[];
  modules?: string[];
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
  success?: boolean | null;
  userId?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
}) {
  try {
    const payload = {
      surface: "identity-account-page",
      eventName: input.eventName,
      occurredAt: new Date().toISOString(),
      lang: input.lang,
      detail: input.detail ?? null,
      success: input.success ?? null,
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? null,
      sessionId: input.sessionId ?? null,
      pathname:
        typeof window !== "undefined" ? window.location.pathname : "/account",
    };

    console.info("[identity/account-ui-event]", payload);
  } catch {
    /**
     * Não bloquear UX por telemetria.
     */
  }
}

function formatNullableValue(
  value: string | null | undefined,
  lang: Lang,
  fallbackEs = "No informado",
  fallbackPt = "Não informado",
) {
  const normalized = value?.trim();
  if (!normalized) {
    return lang === "es" ? fallbackEs : fallbackPt;
  }

  return normalized;
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

export default function AccountPage() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("es");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeContext | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const logoutAbortControllerRef = useRef<AbortController | null>(null);
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
          eventName: "IDENTITY_ACCOUNT_RUNTIME_LOAD_STARTED",
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
            eventName: "IDENTITY_ACCOUNT_RUNTIME_REDIRECT_LOGIN",
            lang,
            detail: `http_status_${response.status}`,
            success: false,
          });

          router.replace("/login");
          return;
        }

        if (!data?.data?.authenticated || !data?.data?.user?.id) {
          emitUiEvent({
            eventName: "IDENTITY_ACCOUNT_RUNTIME_REDIRECT_LOGIN",
            lang,
            detail: "runtime_not_authenticated",
            success: false,
          });

          router.replace("/login");
          return;
        }

        if (!data?.data?.activeTenant?.id) {
          emitUiEvent({
            eventName: "IDENTITY_ACCOUNT_RUNTIME_REDIRECT_SELECT_TENANT",
            lang,
            detail: "active_tenant_missing",
            userId: data?.data?.user?.id ?? null,
            sessionId: data?.data?.sessionId ?? null,
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
          eventName: "IDENTITY_ACCOUNT_RUNTIME_LOAD_SUCCEEDED",
          lang,
          userId: data.data.user.id,
          tenantId: data.data.activeTenant.id,
          sessionId: data.data.sessionId ?? null,
          success: true,
        });
      } catch (err) {
        const isAbortError =
          err instanceof DOMException && err.name === "AbortError";

        if (isAbortError) {
          return;
        }

        console.error("[account-page] runtime_error", err);

        if (!isMountedRef.current) {
          return;
        }

        const message =
          lang === "es"
            ? "No fue posible cargar el contexto de cuenta."
            : "Não foi possível carregar o contexto da conta.";

        setError(message);

        emitUiEvent({
          eventName: "IDENTITY_ACCOUNT_RUNTIME_LOAD_FAILED",
          lang,
          detail:
            err instanceof Error ? err.message : "unexpected_runtime_error",
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

      if (logoutAbortControllerRef.current) {
        logoutAbortControllerRef.current.abort();
      }
    };
  }, [loadRuntime]);

  const userDisplay = useMemo(() => {
    return (
      runtime?.user?.displayName ||
      runtime?.user?.fullName ||
      runtime?.user?.email ||
      runtime?.user?.id ||
      (lang === "es" ? "Usuario no identificado" : "Usuário não identificado")
    );
  }, [runtime, lang]);

  const tenantName = useMemo(() => {
    return (
      runtime?.activeTenant?.name ||
      runtime?.activeTenant?.code ||
      (lang === "es" ? "No definido" : "Não definido")
    );
  }, [runtime, lang]);

  const role = useMemo(() => {
    return (
      runtime?.membership?.roleCode ||
      (lang === "es" ? "No informado" : "Não informado")
    );
  }, [runtime, lang]);

  const membershipStatus = useMemo(() => {
    return (
      runtime?.membership?.status ||
      (lang === "es" ? "No informado" : "Não informado")
    );
  }, [runtime, lang]);

  const sessionId = useMemo(() => {
    return formatNullableValue(
      runtime?.sessionId,
      lang,
      "No emitida",
      "Não emitida",
    );
  }, [runtime, lang]);

  const userEmail = useMemo(() => {
    return formatNullableValue(
      runtime?.user?.email,
      lang,
      "Correo no informado",
      "E-mail não informado",
    );
  }, [runtime, lang]);

  const documentNumber = useMemo(() => {
    return formatNullableValue(
      runtime?.user?.documentNumber,
      lang,
      "Documento no informado",
      "Documento não informado",
    );
  }, [runtime, lang]);

  const platformRoles = useMemo(() => runtime?.platformRoles ?? [], [runtime]);
  const tenantRoles = useMemo(() => runtime?.tenantRoles ?? [], [runtime]);
  const permissions = useMemo(() => runtime?.permissions ?? [], [runtime]);
  const modules = useMemo(() => runtime?.modules ?? [], [runtime]);

  const summaryCards = useMemo(() => {
    return [
      {
        id: "identity",
        label: lang === "es" ? "Identidad activa" : "Identidade ativa",
        value: userDisplay,
        icon: User2,
      },
      {
        id: "tenant",
        label: lang === "es" ? "Tenant activo" : "Tenant ativo",
        value: tenantName,
        icon: Building2,
      },
      {
        id: "role",
        label: lang === "es" ? "Rol efectivo" : "Papel efetivo",
        value: role,
        icon: ShieldCheck,
      },
      {
        id: "modules",
        label: lang === "es" ? "Módulos visibles" : "Módulos visíveis",
        value: String(modules.length),
        icon: Layers3,
      },
    ];
  }, [lang, userDisplay, tenantName, role, modules.length]);

  async function handleLogout() {
    try {
      if (loggingOut) {
        return;
      }

      if (logoutAbortControllerRef.current) {
        logoutAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      logoutAbortControllerRef.current = controller;

      setLoggingOut(true);
      setError(null);

      emitUiEvent({
        eventName: "IDENTITY_ACCOUNT_LOGOUT_STARTED",
        lang,
        userId: runtime?.user?.id ?? null,
        tenantId: runtime?.activeTenant?.id ?? null,
        sessionId: runtime?.sessionId ?? null,
        success: null,
      });

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          lang === "es"
            ? "No fue posible cerrar la sesión."
            : "Não foi possível encerrar a sessão.",
        );
      }

      emitUiEvent({
        eventName: "IDENTITY_ACCOUNT_LOGOUT_SUCCEEDED",
        lang,
        userId: runtime?.user?.id ?? null,
        tenantId: runtime?.activeTenant?.id ?? null,
        sessionId: runtime?.sessionId ?? null,
        success: true,
      });

      router.push("/login");
      router.refresh();
    } catch (err) {
      const isAbortError =
        err instanceof DOMException && err.name === "AbortError";

      if (isAbortError) {
        return;
      }

      console.error("[account-page] logout_error", err);

      if (!isMountedRef.current) {
        return;
      }

      const message =
        err instanceof Error
          ? err.message
          : lang === "es"
            ? "Error inesperado al cerrar sesión."
            : "Erro inesperado ao encerrar sessão.";

      setError(message);

      emitUiEvent({
        eventName: "IDENTITY_ACCOUNT_LOGOUT_FAILED",
        lang,
        userId: runtime?.user?.id ?? null,
        tenantId: runtime?.activeTenant?.id ?? null,
        sessionId: runtime?.sessionId ?? null,
        detail:
          err instanceof Error ? err.message : "unexpected_logout_error",
        success: false,
      });
    } finally {
      if (isMountedRef.current) {
        setLoggingOut(false);
      }
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
                PROCEIT ACCOUNT CENTER
              </div>

              <h1 className="text-5xl font-black tracking-[-0.04em] xl:text-6xl">
                {lang === "es"
                  ? "Centro de sesión y control"
                  : "Centro de sessão e controle"}
                <span className="mt-2 block text-sky-400">
                  {lang === "es"
                    ? "Identidad, tenant y gobierno activo."
                    : "Identidade, tenant e governança ativa."}
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-white/68">
                {lang === "es"
                  ? "Este espacio centraliza la identidad operativa, el tenant activo, los roles efectivos, la sesión emitida y la lectura ejecutiva del contexto autenticado dentro del ecosistema PROCEIT."
                  : "Este espaço centraliza a identidade operacional, o tenant ativo, os papéis efetivos, a sessão emitida e a leitura executiva do contexto autenticado dentro do ecossistema PROCEIT."}
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">
                    {lang === "es"
                      ? "Identidad consolidada"
                      : "Identidade consolidada"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "La autoridad central ya resolvió usuario, tenant, membresía y estado de sesión para la operación actual."
                      : "A autoridade central já resolveu usuário, tenant, membership e estado de sessão para a operação atual."}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Network className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-base font-semibold text-white">
                    {lang === "es"
                      ? "Base para auditoría"
                      : "Base para auditoria"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "El centro de cuenta queda preparado para observabilidad, trazabilidad y evolución hacia Control Tower."
                      : "O centro de conta fica preparado para observabilidade, rastreabilidade e evolução para o Control Tower."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

              <div className="p-6 sm:p-8">
                <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
                      {lang === "es"
                        ? "Perfil operativo"
                        : "Perfil operacional"}
                    </div>

                    <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {lang === "es"
                        ? "Cuenta e identidad"
                        : "Conta e identidade"}
                    </h2>

                    <p className="mt-2 text-sm leading-7 text-white/60">
                      {lang === "es"
                        ? "Estado real de la sesión, del tenant en operación y de los permisos efectivos."
                        : "Estado real da sessão, do tenant em operação e das permissões efetivas."}
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
                      disabled={loading || reloading || loggingOut}
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
                  <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-white/10 bg-[#0b1220]/55 px-6 py-10">
                    <div className="flex items-center gap-3 text-sm text-white/65">
                      <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                      {lang === "es"
                        ? "Cargando contexto de cuenta..."
                        : "Carregando contexto da conta..."}
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

                    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                          {lang === "es"
                            ? "Identidad y sesión"
                            : "Identidade e sessão"}
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2 text-white/70">
                              <User2 className="h-4 w-4 text-sky-300" />
                              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                                {lang === "es" ? "Usuario" : "Usuário"}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-semibold text-white">
                              {userDisplay}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2 text-white/70">
                              <Mail className="h-4 w-4 text-sky-300" />
                              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                                {lang === "es" ? "Correo" : "E-mail"}
                              </span>
                            </div>
                            <div className="mt-3 break-words text-sm font-semibold text-white">
                              {userEmail}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2 text-white/70">
                              <KeyRound className="h-4 w-4 text-sky-300" />
                              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                                {lang === "es" ? "Documento" : "Documento"}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-semibold text-white">
                              {documentNumber}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex items-center gap-2 text-white/70">
                              <Clock className="h-4 w-4 text-sky-300" />
                              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                                {lang === "es" ? "Sesión" : "Sessão"}
                              </span>
                            </div>
                            <div className="mt-3 break-all text-sm font-semibold text-white">
                              {sessionId}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                          {lang === "es"
                            ? "Contexto operativo"
                            : "Contexto operacional"}
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                              {lang === "es" ? "Tenant" : "Tenant"}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {tenantName}
                            </div>
                            <div className="mt-1 break-all text-xs text-white/50">
                              {runtime.activeTenant?.id}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                              {lang === "es" ? "Rol efectivo" : "Papel efetivo"}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {role}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                              {lang === "es"
                                ? "Estado de membresía"
                                : "Estado da membership"}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {membershipStatus}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                          {lang === "es"
                            ? "Platform roles"
                            : "Platform roles"}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {platformRoles.length > 0 ? (
                            platformRoles.map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-white/50">
                              {lang === "es"
                                ? "Sin roles de plataforma"
                                : "Sem papéis de plataforma"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                          {lang === "es" ? "Tenant roles" : "Tenant roles"}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {tenantRoles.length > 0 ? (
                            tenantRoles.map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75"
                              >
                                {item}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-white/50">
                              {lang === "es"
                                ? "Sin roles por tenant"
                                : "Sem papéis por tenant"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/55 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                          {lang === "es"
                            ? "Permisos efectivos"
                            : "Permissões efetivas"}
                        </div>

                        <div className="mt-4">
                          <div className="text-2xl font-bold text-white">
                            {permissions.length}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-white/56">
                            {lang === "es"
                              ? "Cantidad total de permisos resueltos para la operación actual."
                              : "Quantidade total de permissões resolvidas para a operação atual."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <SectionHint tone="success" ariaLive="polite">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          {lang === "es"
                            ? "La cuenta operativa está cargada con contexto real de autenticación, tenant y membresía."
                            : "A conta operacional está carregada com contexto real de autenticação, tenant e membership."}
                        </div>
                      </div>
                    </SectionHint>

                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => router.push("/access")}
                        disabled={loggingOut}
                        className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-sky-400/30 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {lang === "es"
                              ? "Volver al Access Hub"
                              : "Voltar ao Access Hub"}
                          </div>
                          <div className="mt-1 text-sm text-white/50">
                            {lang === "es"
                              ? "Retornar a la superficie central de acceso operativo."
                              : "Retornar para a superfície central de acesso operacional."}
                          </div>
                        </div>

                        <ChevronRight className="h-5 w-5 text-white/35" />
                      </button>

                      <button
                        type="button"
                        disabled={loggingOut}
                        onClick={() => void handleLogout()}
                        className="inline-flex items-center justify-between rounded-2xl border border-red-400/20 bg-red-500/5 p-4 text-left transition hover:border-red-400/30 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {loggingOut
                              ? lang === "es"
                                ? "Cerrando sesión..."
                                : "Encerrando sessão..."
                              : lang === "es"
                                ? "Cerrar sesión"
                                : "Encerrar sessão"}
                          </div>
                          <div className="mt-1 text-sm text-white/50">
                            {lang === "es"
                              ? "Finalizar sesión emitida por la autoridad central."
                              : "Finalizar sessão emitida pela autoridade central."}
                          </div>
                        </div>

                        {loggingOut ? (
                          <Loader2 className="h-5 w-5 animate-spin text-red-300" />
                        ) : (
                          <LogOut className="h-5 w-5 text-red-300" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <SectionHint>
                    {lang === "es"
                      ? "No hay contexto de cuenta disponible para renderizar la superficie."
                      : "Não há contexto de conta disponível para renderizar a superfície."}
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