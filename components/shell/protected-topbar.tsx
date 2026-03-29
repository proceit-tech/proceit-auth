import {
  BadgeCheck,
  Fingerprint,
  Layers3,
  ShieldCheck,
  Sparkles,
  RadioTower,
  Crown,
  Building2,
} from "lucide-react";

import type { RuntimeContext } from "@/lib/auth/runtime-context";

type Lang = "pt" | "es";

type Props = {
  lang?: Lang;
  ctx: RuntimeContext;
};

function StatCard({
  label,
  value,
  icon: Icon,
  emphasis = "default",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  emphasis?: "default" | "accent";
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-4 backdrop-blur shadow-[0_18px_40px_rgba(0,0,0,0.22)]",
        emphasis === "accent"
          ? "border-sky-400/20 bg-sky-400/[0.08]"
          : "border-white/10 bg-white/[0.04]",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
            emphasis === "accent"
              ? "border-sky-400/20 bg-sky-400/10 text-sky-300"
              : "border-white/10 bg-white/10 text-white/75",
          ].join(" ")}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/38">
            {label}
          </div>
          <div className="mt-1 break-words text-sm font-medium text-white">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveUserName(ctx: RuntimeContext): string {
  return (
    ctx.user?.displayName ||
    ctx.user?.fullName ||
    ctx.user?.email ||
    "—"
  );
}

function resolveTenantName(ctx: RuntimeContext, lang: Lang): string {
  if (ctx.activeTenant?.name) {
    return ctx.activeTenant.name;
  }

  return lang === "es" ? "Sin tenant activo" : "Sem tenant ativo";
}

function resolveAccessBaseLabel(ctx: RuntimeContext, lang: Lang): string {
  if (ctx.hasMasterAccess) {
    return lang === "es"
      ? "Acceso maestro de plataforma"
      : "Acesso mestre de plataforma";
  }

  if (ctx.hasTenantScope) {
    return lang === "es"
      ? "Contexto autorizado por tenant"
      : "Contexto autorizado por tenant";
  }

  if (ctx.requiresTenantSelection) {
    return lang === "es"
      ? "Selección de tenant pendiente"
      : "Seleção de tenant pendente";
  }

  return lang === "es"
    ? "Contexto operativo parcial"
    : "Contexto operacional parcial";
}

function resolveRuntimeStatusLabel(ctx: RuntimeContext, lang: Lang): string {
  if (ctx.hasTenantScope) {
    return lang === "es"
      ? "Runtime resuelto"
      : "Runtime resolvido";
  }

  if (ctx.requiresTenantSelection) {
    return lang === "es"
      ? "Pendiente de selección"
      : "Pendente de seleção";
  }

  return lang === "es"
    ? "Lectura parcial"
    : "Leitura parcial";
}

function resolveRuntimeCopy(ctx: RuntimeContext, lang: Lang): string {
  if (ctx.hasTenantScope) {
    return lang === "es"
      ? "El shell está operando con sesión válida, tenant activo, membresía consistente, permisos efectivos, módulos habilitados y navegación dinámica resuelta desde base de datos."
      : "O shell está operando com sessão válida, tenant ativo, membership consistente, permissões efetivas, módulos habilitados e navegação dinâmica resolvida a partir do banco de dados.";
  }

  if (ctx.requiresTenantSelection) {
    return lang === "es"
      ? "La sesión fue validada, pero el contexto operativo aún requiere definición de tenant para consolidar permisos, navegación y superficie transaccional del sistema."
      : "A sessão foi validada, mas o contexto operacional ainda requer definição de tenant para consolidar permissões, navegação e superfície transacional do sistema.";
  }

  return lang === "es"
    ? "El runtime fue autenticado parcialmente y mantiene lectura estructural disponible, pero todavía no expone un contexto operativo completo."
    : "O runtime foi autenticado parcialmente e mantém leitura estrutural disponível, mas ainda não expõe um contexto operacional completo.";
}

export default function ProtectedTopbar({
  lang = "es",
  ctx,
}: Props) {
  const userName = resolveUserName(ctx);
  const tenantName = resolveTenantName(ctx, lang);
  const membershipRole = ctx.membership?.roleCode || "—";

  const platformRoleCount = Array.isArray(ctx.platformRoles)
    ? ctx.platformRoles.length
    : 0;

  const accessBaseLabel = resolveAccessBaseLabel(ctx, lang);
  const runtimeStatusLabel = resolveRuntimeStatusLabel(ctx, lang);
  const runtimeCopy = resolveRuntimeCopy(ctx, lang);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6">
        <div className="flex min-h-[118px] flex-col justify-center gap-5 py-4 xl:flex-row xl:items-start xl:justify-between xl:py-5">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300">
              PROCEIT PROTECTED HUB
            </div>

            <div className="mt-4 text-[11px] uppercase tracking-[0.28em] text-white/40">
              {lang === "es" ? "Centro Operativo" : "Centro Operacional"}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-[-0.03em] text-white md:text-3xl">
                {tenantName}
              </h1>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/45">
                {lang === "es" ? "Runtime protegido" : "Runtime protegido"}
              </span>

              <span
                className={[
                  "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]",
                  ctx.hasTenantScope
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : "border-amber-400/20 bg-amber-500/10 text-amber-200",
                ].join(" ")}
              >
                {runtimeStatusLabel}
              </span>

              {ctx.hasMasterAccess ? (
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-sky-200">
                  {lang === "es" ? "Master access" : "Master access"}
                </span>
              ) : null}
            </div>

            <p className="mt-3 max-w-5xl text-sm leading-6 text-white/60">
              {runtimeCopy}
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75">
                    <Sparkles className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                      {lang === "es"
                        ? "Lectura estructural"
                        : "Leitura estrutural"}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {lang === "es"
                        ? "Centro ejecutivo del runtime protegido"
                        : "Centro executivo do runtime protegido"}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      {lang === "es"
                        ? "Esta barra consolida la lectura visible del tenant, del usuario, del alcance operativo actual y de la base autorizativa que sostiene el ecosistema."
                        : "Esta barra consolida a leitura visível do tenant, do usuário, do alcance operacional atual e da base autorizativa que sustenta o ecossistema."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75">
                    <RadioTower className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                      {lang === "es"
                        ? "Base autorizativa"
                        : "Base autorizativa"}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {accessBaseLabel}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      {lang === "es"
                        ? "La visibilidad operativa del shell depende de la sesión vigente, el tenant resuelto, la membresía aplicable y la capa efectiva de permisos y módulos."
                        : "A visibilidade operacional do shell depende da sessão vigente, do tenant resolvido, da membership aplicável e da camada efetiva de permissões e módulos."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[760px] xl:grid-cols-5">
            <StatCard
              label={lang === "es" ? "Usuario" : "Usuário"}
              value={userName}
              icon={Fingerprint}
            />
            <StatCard
              label={lang === "es" ? "Tenant" : "Tenant"}
              value={tenantName}
              icon={Building2}
              emphasis={ctx.hasTenantScope ? "accent" : "default"}
            />
            <StatCard
              label="Role"
              value={membershipRole}
              icon={BadgeCheck}
            />
            <StatCard
              label={lang === "es" ? "Permisos" : "Permissões"}
              value={String(ctx.permissions.length)}
              icon={ShieldCheck}
            />
            <StatCard
              label={lang === "es" ? "Módulos" : "Módulos"}
              value={
                ctx.hasMasterAccess
                  ? `${ctx.modules.length} · ${
                      lang === "es" ? "Master" : "Master"
                    }`
                  : String(ctx.modules.length)
              }
              icon={ctx.hasMasterAccess ? Crown : Layers3}
              emphasis={ctx.hasMasterAccess ? "accent" : "default"}
            />
          </div>
        </div>

        <div className="pb-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                {lang === "es" ? "Platform roles" : "Platform roles"}
              </div>
              <div className="mt-2 text-sm font-medium text-white">
                {platformRoleCount > 0 ? String(platformRoleCount) : "0"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                {lang === "es" ? "Tenant scope" : "Tenant scope"}
              </div>
              <div className="mt-2 text-sm font-medium text-white">
                {ctx.hasTenantScope
                  ? lang === "es"
                    ? "Resuelto"
                    : "Resolvido"
                  : lang === "es"
                  ? "No resuelto"
                  : "Não resolvido"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                {lang === "es" ? "Tenant selection" : "Tenant selection"}
              </div>
              <div className="mt-2 text-sm font-medium text-white">
                {ctx.requiresTenantSelection
                  ? lang === "es"
                    ? "Pendiente"
                    : "Pendente"
                  : lang === "es"
                  ? "Consolidada"
                  : "Consolidada"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}