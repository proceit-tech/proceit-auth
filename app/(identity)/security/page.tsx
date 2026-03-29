"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Loader2,
  Building2,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  ChevronRight,
  KeyRound,
  Fingerprint,
  ShieldAlert,
  Landmark,
  RefreshCw,
  Cpu,
  Orbit,
  ServerCog,
  FileClock,
  Activity,
  Network,
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

type SecurityRuntimeState = {
  userId: string;
  userEmail: string;
  userName: string;
  userDocument: string;
  tenants: TenantItem[];
  activeTenantId: string | null;
  sessionValidated: boolean;
  tenantValidated: boolean;
  membershipValidated: boolean;
  securityPosture: "healthy" | "warning" | "critical";
  runtimeLoadedAt: string | null;
};

type SecuritySignalTone = "success" | "warning" | "danger" | "neutral";

type SecuritySignal = {
  id: string;
  titleEs: string;
  titlePt: string;
  descriptionEs: string;
  descriptionPt: string;
  tone: SecuritySignalTone;
  icon: React.ComponentType<{ className?: string }>;
};

const INITIAL_RUNTIME_STATE: SecurityRuntimeState = {
  userId: "",
  userEmail: "",
  userName: "",
  userDocument: "",
  tenants: [],
  activeTenantId: null,
  sessionValidated: false,
  tenantValidated: false,
  membershipValidated: false,
  securityPosture: "warning",
  runtimeLoadedAt: null,
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
  posture?: SecurityRuntimeState["securityPosture"] | null;
}) {
  try {
    const payload = {
      surface: "identity-security-page",
      eventName: input.eventName,
      occurredAt: new Date().toISOString(),
      lang: input.lang,
      detail: input.detail ?? null,
      success: input.success ?? null,
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? null,
      posture: input.posture ?? null,
      pathname:
        typeof window !== "undefined" ? window.location.pathname : "/security",
    };

    console.info("[identity/security-ui-event]", payload);
  } catch {
    /**
     * Não bloquear UX por falha de telemetria.
     */
  }
}

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

function toneClasses(tone: SecuritySignalTone) {
  if (tone === "success") {
    return {
      wrapper: "border-emerald-400/15 bg-emerald-500/5",
      icon: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    };
  }

  if (tone === "warning") {
    return {
      wrapper: "border-amber-400/15 bg-amber-500/5",
      icon: "border-amber-400/20 bg-amber-400/10 text-amber-300",
      badge: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    };
  }

  if (tone === "danger") {
    return {
      wrapper: "border-red-400/15 bg-red-500/5",
      icon: "border-red-400/20 bg-red-500/10 text-red-300",
      badge: "border-red-400/20 bg-red-500/10 text-red-300",
    };
  }

  return {
    wrapper: "border-white/10 bg-white/[0.03]",
    icon: "border-white/10 bg-white/5 text-white/75",
    badge: "border-white/10 bg-white/5 text-white/70",
  };
}

function SectionHint({
  children,
  tone = "default",
  ariaLive,
}: {
  children: React.ReactNode;
  tone?: "default" | "error" | "success";
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
      aria-live={ariaLive}
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${classes}`}
    >
      {children}
    </div>
  );
}

export default function SecurityPage() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("es");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] =
    useState<SecurityRuntimeState>(INITIAL_RUNTIME_STATE);

  const runtimeAbortControllerRef = useRef<AbortController | null>(null);
  const logoutAbortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const loadSecurityRuntime = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      try {
        if (runtimeAbortControllerRef.current) {
          runtimeAbortControllerRef.current.abort();
        }

        const controller = new AbortController();
        runtimeAbortControllerRef.current = controller;

        if (!silent) {
          setLoading(true);
        } else {
          setReloading(true);
        }

        setError(null);

        emitUiEvent({
          eventName: "IDENTITY_SECURITY_RUNTIME_LOAD_STARTED",
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
            eventName: "IDENTITY_SECURITY_RUNTIME_REDIRECT_LOGIN",
            lang,
            detail: `http_status_${response.status}`,
            success: false,
          });

          router.replace("/login");
          return;
        }

        if (!data?.user?.id) {
          emitUiEvent({
            eventName: "IDENTITY_SECURITY_RUNTIME_REDIRECT_LOGIN",
            lang,
            detail: "user_id_missing",
            success: false,
          });

          router.replace("/login");
          return;
        }

        const tenantItems = Array.isArray(data.tenants) ? data.tenants : [];
        const resolvedActiveTenantId =
          typeof data.activeTenantId === "string" && data.activeTenantId.trim()
            ? data.activeTenantId
            : null;

        if (!resolvedActiveTenantId) {
          emitUiEvent({
            eventName: "IDENTITY_SECURITY_RUNTIME_REDIRECT_SELECT_TENANT",
            lang,
            detail: "active_tenant_missing",
            userId: data.user.id ?? null,
            success: false,
          });

          router.replace("/select-tenant");
          return;
        }

        const activeMembership =
          tenantItems.find(
            (tenant) => tenant.tenant_id === resolvedActiveTenantId,
          ) ?? null;

        if (!activeMembership) {
          emitUiEvent({
            eventName: "IDENTITY_SECURITY_RUNTIME_REDIRECT_SELECT_TENANT",
            lang,
            detail: "membership_missing_for_active_tenant",
            userId: data.user.id ?? null,
            tenantId: resolvedActiveTenantId,
            success: false,
          });

          router.replace("/select-tenant");
          return;
        }

        const nextRuntime: SecurityRuntimeState = {
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
          tenantValidated: Boolean(resolvedActiveTenantId),
          membershipValidated: Boolean(activeMembership),
          securityPosture: "healthy",
          runtimeLoadedAt: new Date().toISOString(),
        };

        if (!isMountedRef.current) {
          return;
        }

        setRuntime(nextRuntime);

        emitUiEvent({
          eventName: "IDENTITY_SECURITY_RUNTIME_LOAD_SUCCEEDED",
          lang,
          userId: nextRuntime.userId,
          tenantId: nextRuntime.activeTenantId,
          posture: nextRuntime.securityPosture,
          success: true,
        });
      } catch (err) {
        const isAbortError =
          err instanceof DOMException && err.name === "AbortError";

        if (isAbortError) {
          return;
        }

        const message =
          lang === "es"
            ? "No fue posible cargar el centro de seguridad de la identidad activa."
            : "Não foi possível carregar o centro de segurança da identidade ativa.";

        if (!isMountedRef.current) {
          return;
        }

        setError(message);

        setRuntime((current) => ({
          ...current,
          sessionValidated: false,
          tenantValidated: false,
          membershipValidated: false,
          securityPosture: "warning",
        }));

        emitUiEvent({
          eventName: "IDENTITY_SECURITY_RUNTIME_LOAD_FAILED",
          lang,
          detail:
            err instanceof Error
              ? err.message
              : "unexpected_security_runtime_error",
          posture: "warning",
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
    void loadSecurityRuntime();

    return () => {
      isMountedRef.current = false;

      if (runtimeAbortControllerRef.current) {
        runtimeAbortControllerRef.current.abort();
      }

      if (logoutAbortControllerRef.current) {
        logoutAbortControllerRef.current.abort();
      }
    };
  }, [loadSecurityRuntime]);

  const activeTenant = useMemo(() => {
    return (
      runtime.tenants.find(
        (tenant) => tenant.tenant_id === runtime.activeTenantId,
      ) ?? null
    );
  }, [runtime.tenants, runtime.activeTenantId]);

  const tenantCount = runtime.tenants.length;

  const postureLabel = useMemo(() => {
    if (runtime.securityPosture === "healthy") {
      return lang === "es" ? "Postura estable" : "Postura estável";
    }

    if (runtime.securityPosture === "critical") {
      return lang === "es" ? "Postura crítica" : "Postura crítica";
    }

    return lang === "es" ? "Postura en observación" : "Postura em observação";
  }, [runtime.securityPosture, lang]);

  const postureDescription = useMemo(() => {
    if (runtime.securityPosture === "healthy") {
      return lang === "es"
        ? "La identidad, la sesión y el contexto empresarial activo fueron consistentes durante la verificación del runtime."
        : "A identidade, a sessão e o contexto empresarial ativo apresentaram consistência durante a verificação do runtime.";
    }

    if (runtime.securityPosture === "critical") {
      return lang === "es"
        ? "Se detectaron inconsistencias relevantes en el contexto de seguridad y la sesión requiere intervención."
        : "Foram detectadas inconsistências relevantes no contexto de segurança e a sessão requer intervenção.";
    }

    return lang === "es"
      ? "La estructura fue cargada, pero aún se recomienda profundizar señales, auditoría y endurecimiento operativo."
      : "A estrutura foi carregada, mas ainda se recomenda aprofundar sinais, auditoria e endurecimento operacional.";
  }, [runtime.securityPosture, lang]);

  const securitySignals = useMemo<SecuritySignal[]>(() => {
    return [
      {
        id: "session",
        titleEs: "Integridad de sesión",
        titlePt: "Integridade de sessão",
        descriptionEs: runtime.sessionValidated
          ? "La sesión central fue validada con éxito a partir del runtime autenticado."
          : "La sesión no pudo ser validada correctamente en esta carga.",
        descriptionPt: runtime.sessionValidated
          ? "A sessão central foi validada com sucesso a partir do runtime autenticado."
          : "A sessão não pôde ser validada corretamente nesta carga.",
        tone: runtime.sessionValidated ? "success" : "danger",
        icon: ShieldCheck,
      },
      {
        id: "tenant",
        titleEs: "Contexto empresarial activo",
        titlePt: "Contexto empresarial ativo",
        descriptionEs: runtime.tenantValidated
          ? "Existe un tenant activo cargado y listo para restringir permisos, navegación y contexto."
          : "No se detectó un tenant activo consistente para el usuario actual.",
        descriptionPt: runtime.tenantValidated
          ? "Existe um tenant ativo carregado e pronto para restringir permissões, navegação e contexto."
          : "Não foi detectado um tenant ativo consistente para o usuário atual.",
        tone: runtime.tenantValidated ? "success" : "danger",
        icon: Building2,
      },
      {
        id: "membership",
        titleEs: "Membresía validada",
        titlePt: "Membership validado",
        descriptionEs: runtime.membershipValidated
          ? "La pertenencia entre identidad y tenant activo fue verificada dentro de la sesión."
          : "La relación entre identidad y tenant activo presenta una inconsistencia.",
        descriptionPt: runtime.membershipValidated
          ? "O vínculo entre identidade e tenant ativo foi verificado dentro da sessão."
          : "A relação entre identidade e tenant ativo apresenta uma inconsistência.",
        tone: runtime.membershipValidated ? "success" : "danger",
        icon: Fingerprint,
      },
      {
        id: "evolution",
        titleEs: "Preparación para hardening",
        titlePt: "Preparação para hardening",
        descriptionEs:
          "La pantalla ya está lista para evolucionar hacia auditoría central, señales avanzadas, RBAC y observabilidad del ecosistema.",
        descriptionPt:
          "A tela já está pronta para evoluir para auditoria central, sinais avançados, RBAC e observabilidade do ecossistema.",
        tone: "warning",
        icon: ShieldAlert,
      },
    ];
  }, [
    runtime.sessionValidated,
    runtime.tenantValidated,
    runtime.membershipValidated,
  ]);

  const runtimeFacts = useMemo(() => {
    return [
      {
        id: "identity",
        labelEs: "Identidad autenticada",
        labelPt: "Identidade autenticada",
        value:
          runtime.userEmail ||
          runtime.userName ||
          runtime.userId ||
          (lang === "es" ? "No disponible" : "Não disponível"),
        icon: KeyRound,
      },
      {
        id: "document",
        labelEs: "Documento vinculado",
        labelPt: "Documento vinculado",
        value:
          runtime.userDocument ||
          (lang === "es" ? "No informado" : "Não informado"),
        icon: Fingerprint,
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
          (lang === "es" ? "Sin rol informado" : "Sem papel informado"),
        icon: LockKeyhole,
      },
      {
        id: "tenants",
        labelEs: "Tenants accesibles",
        labelPt: "Tenants acessíveis",
        value: String(tenantCount),
        icon: Orbit,
      },
      {
        id: "runtime",
        labelEs: "Última verificación",
        labelPt: "Última verificação",
        value: formatRuntimeTimestamp(runtime.runtimeLoadedAt, lang),
        icon: RefreshCw,
      },
    ];
  }, [
    runtime.userEmail,
    runtime.userName,
    runtime.userId,
    runtime.userDocument,
    runtime.runtimeLoadedAt,
    activeTenant,
    tenantCount,
    lang,
  ]);

  const strategicLayers = useMemo(() => {
    return [
      {
        id: "auth-core",
        titleEs: "Auth central unificado",
        titlePt: "Auth central unificado",
        descriptionEs:
          "Esta capa confirma que la identidad proviene del runtime central y no de un flujo aislado por pantalla.",
        descriptionPt:
          "Esta camada confirma que a identidade provém do runtime central e não de um fluxo isolado por tela.",
        icon: Network,
      },
      {
        id: "tenant-context",
        titleEs: "Contexto multi-tenant",
        titlePt: "Contexto multi-tenant",
        descriptionEs:
          "La navegación y los accesos futuros deben operar condicionados por tenant activo, memberships y permisos.",
        descriptionPt:
          "A navegação e os acessos futuros devem operar condicionados por tenant ativo, memberships e permissões.",
        icon: Building2,
      },
      {
        id: "observability",
        titleEs: "Observabilidad y auditoría",
        titlePt: "Observabilidade e auditoria",
        descriptionEs:
          "La estructura visual y funcional ya prepara el puente hacia Control Tower, eventos de seguridad y trazabilidad central.",
        descriptionPt:
          "A estrutura visual e funcional já prepara a ponte para o Control Tower, eventos de segurança e rastreabilidade central.",
        icon: Activity,
      },
      {
        id: "runtime-hardening",
        titleEs: "Hardening progresivo",
        titlePt: "Hardening progressivo",
        descriptionEs:
          "Permite evolucionar hacia refresh rotation, invalidación contextual, señales por dispositivo, IP y riesgo operativo.",
        descriptionPt:
          "Permite evoluir para refresh rotation, invalidação contextual, sinais por dispositivo, IP e risco operacional.",
        icon: ServerCog,
      },
    ];
  }, []);

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
        eventName: "IDENTITY_SECURITY_LOGOUT_STARTED",
        lang,
        userId: runtime.userId || null,
        tenantId: runtime.activeTenantId || null,
        posture: runtime.securityPosture,
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
            ? "No fue posible cerrar la sesión activa."
            : "Não foi possível encerrar a sessão ativa.",
        );
      }

      emitUiEvent({
        eventName: "IDENTITY_SECURITY_LOGOUT_SUCCEEDED",
        lang,
        userId: runtime.userId || null,
        tenantId: runtime.activeTenantId || null,
        posture: runtime.securityPosture,
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

      const message =
        err instanceof Error
          ? err.message
          : lang === "es"
            ? "Ocurrió un error inesperado al cerrar la sesión."
            : "Ocorreu um erro inesperado ao encerrar a sessão.";

      if (!isMountedRef.current) {
        return;
      }

      setError(message);

      emitUiEvent({
        eventName: "IDENTITY_SECURITY_LOGOUT_FAILED",
        lang,
        detail:
          err instanceof Error ? err.message : "unexpected_logout_error",
        userId: runtime.userId || null,
        tenantId: runtime.activeTenantId || null,
        posture: runtime.securityPosture,
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.10),_transparent_22%),radial-gradient(circle_at_20%_80%,_rgba(14,165,233,0.08),_transparent_20%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.10]" />
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent opacity-90" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300">
                    PROCEIT IDENTITY SECURITY
                  </div>

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
                </div>

                <div className="mt-6">
                  <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.04em] sm:text-5xl xl:text-6xl">
                    {lang === "es"
                      ? "Centro de seguridad de identidad"
                      : "Centro de segurança de identidade"}
                    <span className="block text-sky-400">
                      {lang === "es"
                        ? "para sesión, tenant y runtime activo."
                        : "para sessão, tenant e runtime ativo."}
                    </span>
                  </h1>

                  <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
                    {lang === "es"
                      ? "Esta capa consolida el estado estructural de la sesión autenticada, el tenant operativo, la consistencia del vínculo de acceso y la preparación del auth runtime para observabilidad, auditoría y evolución centralizada dentro del ecosistema PROCEIT."
                      : "Esta camada consolida o estado estrutural da sessão autenticada, o tenant operacional, a consistência do vínculo de acesso e a preparação do auth runtime para observabilidade, auditoria e evolução centralizada dentro do ecossistema PROCEIT."}
                  </p>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      {lang === "es" ? "Postura actual" : "Postura atual"}
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">
                      {postureLabel}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {postureDescription}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      {lang === "es"
                        ? "Runtime cargado"
                        : "Runtime carregado"}
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">
                      {runtime.runtimeLoadedAt
                        ? lang === "es"
                          ? "Verificado"
                          : "Verificado"
                        : lang === "es"
                          ? "Pendiente"
                          : "Pendente"}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {lang === "es"
                        ? "La información visible de seguridad proviene de la sesión viva y del contexto autenticado."
                        : "As informações visíveis de segurança provêm da sessão viva e do contexto autenticado."}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                      <FileClock className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      {lang === "es"
                        ? "Próxima evolución"
                        : "Próxima evolução"}
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">
                      {lang === "es"
                        ? "Auditoría + Control Tower"
                        : "Auditoria + Control Tower"}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {lang === "es"
                        ? "La estructura ya fue preparada para ampliar señales, eventos, permisos y trazabilidad central."
                        : "A estrutura já foi preparada para ampliar sinais, eventos, permissões e rastreabilidade central."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.03em]">
                      {lang === "es"
                        ? "Señales estructurales de seguridad"
                        : "Sinais estruturais de segurança"}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {lang === "es"
                        ? "Resumen ejecutivo del estado real que hoy sostiene la identidad activa."
                        : "Resumo executivo do estado real que hoje sustenta a identidade ativa."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {securitySignals.map((signal) => {
                    const Icon = signal.icon;
                    const classes = toneClasses(signal.tone);

                    return (
                      <div
                        key={signal.id}
                        className={`rounded-3xl border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.22)] ${classes.wrapper}`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${classes.icon}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-base font-semibold text-white">
                                {lang === "es"
                                  ? signal.titleEs
                                  : signal.titlePt}
                              </h3>

                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${classes.badge}`}
                              >
                                {signal.tone === "success"
                                  ? lang === "es"
                                    ? "Validado"
                                    : "Validado"
                                  : signal.tone === "warning"
                                    ? lang === "es"
                                      ? "En expansión"
                                      : "Em expansão"
                                    : signal.tone === "danger"
                                      ? lang === "es"
                                        ? "Atención"
                                        : "Atenção"
                                      : lang === "es"
                                        ? "Base"
                                        : "Base"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-white/60">
                              {lang === "es"
                                ? signal.descriptionEs
                                : signal.descriptionPt}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                      {lang === "es"
                        ? "Security runtime"
                        : "Security runtime"}
                    </div>

                    <h2 className="mt-4 text-3xl font-black tracking-[-0.03em]">
                      {lang === "es"
                        ? "Runtime operativo de la identidad"
                        : "Runtime operacional da identidade"}
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                      {lang === "es"
                        ? "Vista detallada del estado actual de la sesión, del tenant activo y de la estructura que servirá como base para permisos, módulos, auditoría y observabilidad transversal."
                        : "Visão detalhada do estado atual da sessão, do tenant ativo e da estrutura que servirá como base para permissões, módulos, auditoria e observabilidade transversal."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadSecurityRuntime({
                        silent: true,
                      })
                    }
                    disabled={loading || reloading || loggingOut}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-sky-400/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reloading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-sky-300" />
                    )}
                    {lang === "es" ? "Actualizar runtime" : "Atualizar runtime"}
                  </button>
                </div>

                {loading ? (
                  <div className="mt-6 flex min-h-[420px] items-center justify-center rounded-3xl border border-white/10 bg-[#0b1220]/60">
                    <div className="flex items-center gap-3 text-sm text-white/65">
                      <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                      {lang === "es"
                        ? "Cargando centro de seguridad..."
                        : "Carregando centro de segurança..."}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    {error ? (
                      <SectionHint tone="error" ariaLive="assertive">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div>{error}</div>
                        </div>
                      </SectionHint>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {runtimeFacts.map((fact) => {
                        const Icon = fact.icon;

                        return (
                          <div
                            key={fact.id}
                            className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                                <Icon className="h-5 w-5" />
                              </div>

                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                  {lang === "es"
                                    ? fact.labelEs
                                    : fact.labelPt}
                                </div>
                                <div className="mt-2 break-words text-base font-semibold text-white">
                                  {fact.value}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                            <AlertTriangle className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              {lang === "es"
                                ? "Evolución inmediata recomendada"
                                : "Evolução imediata recomendada"}
                            </div>
                            <div className="mt-2 text-lg font-bold text-white">
                              {lang === "es"
                                ? "RBAC, eventos y señales centralizadas"
                                : "RBAC, eventos e sinais centralizados"}
                            </div>
                            <p className="mt-3 text-sm leading-7 text-white/55">
                              {lang === "es"
                                ? "El siguiente salto natural para esta capa consiste en enriquecerla con permisos por módulo, historial de eventos de seguridad, expiración visible, rotación de sesión, invalidación contextual y telemetría centralizada hacia Control Tower."
                                : "O próximo salto natural para esta camada consiste em enriquecê-la com permissões por módulo, histórico de eventos de segurança, expiração visível, rotação de sessão, invalidação contextual e telemetria centralizada para o Control Tower."}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                              {lang === "es"
                                ? "Conclusión operativa"
                                : "Conclusão operacional"}
                            </div>
                            <div className="mt-2 text-lg font-bold text-white">
                              {lang === "es"
                                ? "Base apta para crecer"
                                : "Base apta para crescer"}
                            </div>
                            <p className="mt-3 text-sm leading-7 text-white/55">
                              {lang === "es"
                                ? "La sesión central ya sostiene un contexto válido para empezar a montar control de acceso premium a escala de ecosistema."
                                : "A sessão central já sustenta um contexto válido para começar a montar controle de acesso premium em escala de ecossistema."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => router.push("/account")}
                        disabled={loggingOut}
                        className="group w-full rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition hover:border-sky-400/30 hover:bg-[#10192b]/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                              <KeyRound className="h-5 w-5" />
                            </div>

                            <div>
                              <div className="text-base font-semibold text-white">
                                {lang === "es"
                                  ? "Ir al centro de cuenta"
                                  : "Ir para o centro da conta"}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-white/55">
                                {lang === "es"
                                  ? "Revise información de identidad, datos principales y consistencia del perfil actual."
                                  : "Revise informações de identidade, dados principais e consistência do perfil atual."}
                              </p>
                            </div>
                          </div>

                          <ChevronRight className="h-5 w-5 text-white/45 transition group-hover:text-sky-300" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={loggingOut}
                        className="group w-full rounded-3xl border border-red-500/15 bg-red-500/5 p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition hover:border-red-400/30 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-red-300">
                              {loggingOut ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <LogOut className="h-5 w-5" />
                              )}
                            </div>

                            <div>
                              <div className="text-base font-semibold text-white">
                                {lang === "es"
                                  ? "Cerrar sesión protegida"
                                  : "Encerrar sessão protegida"}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-white/55">
                                {lang === "es"
                                  ? "Finalice la sesión actual, cierre el contexto activo y fuerce una nueva autenticación."
                                  : "Finalize a sessão atual, encerre o contexto ativo e force uma nova autenticação."}
                              </p>
                            </div>
                          </div>

                          <ChevronRight className="h-5 w-5 text-white/45 transition group-hover:text-red-300" />
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <ServerCog className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-[-0.03em]">
                      {lang === "es"
                        ? "Capas estratégicas preparadas"
                        : "Camadas estratégicas preparadas"}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {lang === "es"
                        ? "Cómo esta pantalla se conecta con la arquitectura mayor del ecosistema."
                        : "Como esta tela se conecta com a arquitetura maior do ecossistema."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {strategicLayers.map((layer) => {
                    const Icon = layer.icon;

                    return (
                      <div
                        key={layer.id}
                        className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                            <Icon className="h-5 w-5" />
                          </div>

                          <div>
                            <div className="text-base font-semibold text-white">
                              {lang === "es" ? layer.titleEs : layer.titlePt}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/55">
                              {lang === "es"
                                ? layer.descriptionEs
                                : layer.descriptionPt}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {lang === "es"
                          ? "Lectura ejecutiva"
                          : "Leitura executiva"}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-white/55">
                        {lang === "es"
                          ? "Esta página ya no actúa como una simple vista informativa. Se comporta como una capa premium de lectura del runtime de identidad, preparada para conectarse con módulos, permisos, trazabilidad y monitoreo central del ecosistema PROCEIT."
                          : "Esta página já não atua como uma simples visualização informativa. Ela se comporta como uma camada premium de leitura do runtime de identidade, preparada para se conectar com módulos, permissões, rastreabilidade e monitoramento central do ecossistema PROCEIT."}
                      </p>
                    </div>
                  </div>
                </div>

                {!loading && !error && runtime.sessionValidated && runtime.tenantValidated && runtime.membershipValidated ? (
                  <div className="mt-5">
                    <SectionHint tone="success" ariaLive="polite">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          {lang === "es"
                            ? "La capa de seguridad quedó cargada con consistencia estructural suficiente para soportar evolución de permisos, auditoría y observabilidad."
                            : "A camada de segurança foi carregada com consistência estrutural suficiente para suportar evolução de permissões, auditoria e observabilidade."}
                        </div>
                      </div>
                    </SectionHint>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}