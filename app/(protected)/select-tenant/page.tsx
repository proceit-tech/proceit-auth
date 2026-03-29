"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Fingerprint,
  Loader2,
  LockKeyhole,
  Orbit,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";

type Lang = "es" | "pt";

type Membership = {
  membership_id: string;
  tenant_id: string;
  role_code: string | null;
  status?: string | null;
  is_default?: boolean | null;
  tenant_name?: string | null;
  tenant_code?: string | null;
  is_active?: boolean;
};

type MeResponse = {
  ok: boolean;
  code: string;
  message?: string;
  session?: {
    active_tenant_id: string | null;
  };
  memberships?: Membership[];
};

type RuntimeMembershipState = {
  memberships: Membership[];
  activeTenantId: string | null;
};

const INITIAL_STATE: RuntimeMembershipState = {
  memberships: [],
  activeTenantId: null,
};

function normalizeMemberships(input: unknown): Membership[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is Membership => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Membership).membership_id === "string" &&
      typeof (item as Membership).tenant_id === "string"
    );
  });
}

function getSafeRoleCode(roleCode: string | null | undefined, lang: Lang): string {
  if (typeof roleCode === "string" && roleCode.trim().length > 0) {
    return roleCode.trim();
  }

  return lang === "es" ? "Sin role visible" : "Sem role visível";
}

function ExecutiveCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
        <Icon className="h-5 w-5" />
      </div>

      <div className="text-base font-semibold text-white">{title}</div>

      <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
    </div>
  );
}

function LoadingState({ lang }: { lang: Lang }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-3 text-sm text-white/70">
        <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
        {lang === "es"
          ? "Cargando accesos disponibles..."
          : "Carregando acessos disponíveis..."}
      </div>
    </div>
  );
}

function EmptyState({ lang }: { lang: Lang }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
      {lang === "es"
        ? "No se encontraron tenants disponibles para esta identidad."
        : "Não foram encontrados tenants disponíveis para esta identidade."}
    </div>
  );
}

function ErrorState({
  error,
}: {
  error: string;
}) {
  if (!error) return null;

  return (
    <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-200">
      {error}
    </div>
  );
}

function TenantCard({
  item,
  lang,
  isSubmitting,
  onSelect,
}: {
  item: Membership;
  lang: Lang;
  isSubmitting: boolean;
  onSelect: (tenantId: string) => void;
}) {
  const tenantTitle = item.tenant_name || item.tenant_code || item.tenant_id;
  const roleCode = getSafeRoleCode(item.role_code, lang);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.tenant_id)}
      disabled={isSubmitting}
      className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left backdrop-blur transition hover:border-sky-400/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="p-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">
                {lang === "es" ? "Entorno operativo" : "Ambiente operacional"}
              </p>

              <p className="mt-2 break-all text-sm font-semibold text-white/92">
                {tenantTitle}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  <Fingerprint className="mr-1.5 h-3.5 w-3.5" />
                  {roleCode}
                </span>

                <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                  <Waypoints className="mr-1.5 h-3.5 w-3.5" />
                  {lang === "es" ? "Contexto multi-tenant" : "Contexto multi-tenant"}
                </span>

                {item.is_active ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {lang === "es" ? "Activo" : "Ativo"}
                  </span>
                ) : null}

                {item.is_default ? (
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
                    {lang === "es" ? "Default" : "Default"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {lang === "es" ? "Impacto estructural" : "Impacto estrutural"}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/58">
                {lang === "es"
                  ? "Aplicará el tenant activo al runtime protegido y condicionará navegación, permisos y datos."
                  : "Aplicará o tenant ativo ao runtime protegido e condicionará navegação, permissões e dados."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {lang === "es" ? "Correlación futura" : "Correlação futura"}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/58">
                {lang === "es"
                  ? "Los eventos y señales de Control Tower deberán interpretarse en función de este contexto."
                  : "Os eventos e sinais do Control Tower deverão ser interpretados em função deste contexto."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <p className="text-sm text-white/62">
              {lang === "es"
                ? "Aplicar este contexto al runtime protegido"
                : "Aplicar este contexto ao runtime protegido"}
            </p>

            <span className="inline-flex items-center gap-2 text-sm font-medium text-white/90">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {lang === "es" ? "Definiendo..." : "Definindo..."}
                </>
              ) : (
                <>
                  {lang === "es" ? "Ingresar" : "Entrar"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SelectTenantPage() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("es");
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [runtime, setRuntime] = useState<RuntimeMembershipState>(INITIAL_STATE);

  const loadMemberships = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    try {
      if (!silent) {
        setLoading(true);
      } else {
        setReloading(true);
      }

      setError("");

      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data: MeResponse = await res.json();

      if (!res.ok || !data?.ok) {
        router.replace("/login");
        return;
      }

      if (data.session?.active_tenant_id) {
        router.replace("/app");
        return;
      }

      const items = normalizeMemberships(data.memberships);

      setRuntime({
        memberships: items,
        activeTenantId: data.session?.active_tenant_id ?? null,
      });

      if (items.length !== 1) {
        return;
      }

      const onlyTenant = items[0]?.tenant_id;

      if (!onlyTenant) {
        return;
      }

      setAutoSelecting(true);

      const autoRes = await fetch("/api/auth/select-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ tenantId: onlyTenant }),
      });

      const autoData = await autoRes.json();

      if (!autoRes.ok || !autoData?.ok) {
        setError(
          autoData?.message ||
            "No fue posible definir automáticamente el tenant activo."
        );
        return;
      }

      router.replace("/app");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(
        lang === "es"
          ? "No fue posible cargar los entornos operativos disponibles."
          : "Não foi possível carregar os ambientes operacionais disponíveis."
      );
    } finally {
      setLoading(false);
      setReloading(false);
      setAutoSelecting(false);
    }
  }, [router, lang]);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const memberships = runtime.memberships;
  const hasItems = memberships.length > 0;

  const executiveCards = useMemo(() => {
    return [
      {
        id: "context",
        title:
          lang === "es" ? "Contexto operacional" : "Contexto operacional",
        description:
          lang === "es"
            ? "Cada tenant redefine datos visibles, navegación, restricciones y superficie operativa."
            : "Cada tenant redefine dados visíveis, navegação, restrições e superfície operacional.",
        icon: Building2,
      },
      {
        id: "access",
        title:
          lang === "es" ? "Acceso aplicado" : "Acesso aplicado",
        description:
          lang === "es"
            ? "Las capacidades reales del usuario dependen del membership seleccionado para la sesión."
            : "As capacidades reais do usuário dependem do membership selecionado para a sessão.",
        icon: ShieldCheck,
      },
      {
        id: "governance",
        title:
          lang === "es" ? "Gobernanza y permisos" : "Governança e permissões",
        description:
          lang === "es"
            ? "El tenant activo condicionará roles, módulos visibles y crecimiento hacia RBAC enterprise."
            : "O tenant ativo condicionará papéis, módulos visíveis e crescimento para RBAC enterprise.",
        icon: LockKeyhole,
      },
      {
        id: "tower",
        title:
          lang === "es" ? "Correlación Tower" : "Correlação Tower",
        description:
          lang === "es"
            ? "La observabilidad futura se estructurará por tenant, usuario, producto y severidad operativa."
            : "A observabilidade futura será estruturada por tenant, usuário, produto e severidade operacional.",
        icon: RadioTower,
      },
    ];
  }, [lang]);

  async function handleSelectTenant(tenantId: string) {
    try {
      setSubmittingId(tenantId);
      setError("");

      const res = await fetch("/api/auth/select-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ tenantId }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(
          data?.message ||
            (lang === "es"
              ? "No fue posible definir el tenant activo."
              : "Não foi possível definir o tenant ativo.")
        );
        return;
      }

      router.replace("/app");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(
        lang === "es"
          ? "Ocurrió un error al seleccionar el tenant operativo."
          : "Ocorreu um erro ao selecionar o tenant operacional."
      );
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.10),_transparent_22%),radial-gradient(circle_at_20%_80%,_rgba(14,165,233,0.08),_transparent_20%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.10]" />
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent opacity-90" />

      <div className="relative mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent,199_89%_48%))] to-transparent" />

          <div className="grid gap-8 p-6 xl:grid-cols-[1.05fr_0.95fr] xl:p-8">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    Multi-tenant Runtime
                  </span>
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    Identity Context
                  </span>
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    PROCEIT
                  </span>
                </div>

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
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-3xl font-black leading-[0.95] tracking-[-0.04em] text-white md:text-5xl xl:text-6xl">
                  {lang === "es"
                    ? "Defina el entorno operativo que gobernará la sesión protegida."
                    : "Defina o ambiente operacional que governará a sessão protegida."}
                </h1>

                <p className="max-w-3xl text-sm leading-7 text-white/65 md:text-base">
                  {lang === "es"
                    ? "Su identidad posee más de un acceso habilitado. Antes de continuar, el sistema debe establecer el tenant activo que condicionará permisos, datos, módulos visibles, navegación, integraciones y correlación futura de eventos dentro del Control Tower."
                    : "Sua identidade possui mais de um acesso habilitado. Antes de continuar, o sistema deve estabelecer o tenant ativo que condicionará permissões, dados, módulos visíveis, navegação, integrações e correlação futura de eventos dentro do Control Tower."}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {executiveCards.map((card) => (
                  <ExecutiveCard
                    key={card.id}
                    title={card.title}
                    description={card.description}
                    icon={card.icon}
                  />
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      {lang === "es" ? "Lectura ejecutiva" : "Leitura executiva"}
                    </div>

                    <div className="mt-2 text-xl font-bold text-white">
                      {lang === "es"
                        ? "La selección de tenant no es una formalidad visual"
                        : "A seleção de tenant não é uma formalidade visual"}
                    </div>

                    <p className="mt-3 text-sm leading-7 text-white/58">
                      {lang === "es"
                        ? "Esta decisión define el marco operativo real de la sesión. A partir de aquí, todo acceso, navegación, permiso, auditoría y observabilidad debe quedar condicionado por el contexto elegido."
                        : "Esta decisão define o marco operacional real da sessão. A partir daqui, todo acesso, navegação, permissão, auditoria e observabilidade deve ficar condicionado pelo contexto escolhido."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                    {lang === "es"
                      ? "Entornos disponibles"
                      : "Ambientes disponíveis"}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {memberships.length}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadMemberships({ silent: true })}
                  disabled={loading || reloading || autoSelecting}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 transition hover:border-sky-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reloading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                  ) : (
                    <Orbit className="h-4 w-4 text-sky-300" />
                  )}
                  {lang === "es" ? "Actualizar" : "Atualizar"}
                </button>
              </div>

              {autoSelecting ? (
                <div className="rounded-3xl border border-sky-400/20 bg-sky-400/10 p-5 text-sm text-sky-100">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                    {lang === "es"
                      ? "Aplicando automáticamente el único tenant disponible..."
                      : "Aplicando automaticamente o único tenant disponível..."}
                  </div>
                </div>
              ) : null}

              {loading ? <LoadingState lang={lang} /> : null}

              <ErrorState error={error} />

              {!loading && !hasItems ? <EmptyState lang={lang} /> : null}

              {!loading && hasItems ? (
                <div className="grid gap-4">
                  {memberships.map((item) => (
                    <TenantCard
                      key={item.membership_id}
                      item={item}
                      lang={lang}
                      isSubmitting={submittingId === item.tenant_id}
                      onSelect={handleSelectTenant}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}