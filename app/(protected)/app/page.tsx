import type { ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Blocks,
  Bot,
  Building2,
  CheckCircle2,
  Fingerprint,
  Gauge,
  Landmark,
  Layers3,
  LockKeyhole,
  Orbit,
  RadioTower,
  Rocket,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { withSqlAuthContext } from "@/lib/auth/server-context";
import { getDisplayName } from "@/lib/auth/user";

type Lang = "es" | "pt";

type RuntimeRow = {
  user_id: string | null;
  tenant_id: string | null;
};

type IconType = ComponentType<{ className?: string }>;

type HubMetricCard = {
  id: string;
  titleEs: string;
  titlePt: string;
  value: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
  tone?: "default" | "success" | "warning";
};

type ReadinessCard = {
  id: string;
  eyebrow: string;
  titleEs: string;
  titlePt: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
};

type ModuleLaunchCard = {
  id: string;
  title: string;
  subtitleEs: string;
  subtitlePt: string;
  statusEs: string;
  statusPt: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
};

type ControlTowerSignal = {
  id: string;
  titleEs: string;
  titlePt: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
};

function toneClasses(tone: HubMetricCard["tone"]) {
  if (tone === "success") {
    return {
      wrapper: "border-emerald-400/15 bg-emerald-500/5",
      icon: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      value: "text-emerald-200",
    };
  }

  if (tone === "warning") {
    return {
      wrapper: "border-amber-400/15 bg-amber-500/5",
      icon: "border-amber-400/20 bg-amber-400/10 text-amber-300",
      value: "text-amber-200",
    };
  }

  return {
    wrapper: "border-white/10 bg-white/5",
    icon: "border-white/10 bg-white/10 text-white/80",
    value: "text-white",
  };
}

function SectionFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur ${className}`}
    >
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />
      {children}
    </div>
  );
}

function ExecutiveBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
      {children}
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: IconType;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
        <Icon className="h-5 w-5 text-white/80" />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
      </div>
    </div>
  );
}

function MetricCard({
  card,
  lang,
}: {
  card: HubMetricCard;
  lang: Lang;
}) {
  const Icon = card.icon;
  const tone = toneClasses(card.tone);

  return (
    <div
      className={`rounded-3xl border p-5 backdrop-blur ${tone.wrapper}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
          {lang === "es" ? card.titleEs : card.titlePt}
        </p>

        <div className={`rounded-2xl border p-2 ${tone.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className={`mt-4 text-xl font-semibold ${tone.value}`}>
        {card.value}
      </p>

      <p className="mt-2 text-sm leading-6 text-white/58">
        {lang === "es" ? card.descriptionEs : card.descriptionPt}
      </p>
    </div>
  );
}

function ReadinessBlock({
  card,
  lang,
}: {
  card: ReadinessCard;
  lang: Lang;
}) {
  const Icon = card.icon;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
        <Icon className="h-5 w-5" />
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {card.eyebrow}
      </div>

      <div className="mt-3 text-lg font-bold text-white">
        {lang === "es" ? card.titleEs : card.titlePt}
      </div>

      <p className="mt-2 text-sm leading-6 text-white/55">
        {lang === "es" ? card.descriptionEs : card.descriptionPt}
      </p>
    </div>
  );
}

function LaunchModuleCard({
  module,
  lang,
}: {
  module: ModuleLaunchCard;
  lang: Lang;
}) {
  const Icon = module.icon;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <div className="text-base font-semibold text-white">
              {module.title}
            </div>
            <p className="mt-1 text-sm leading-6 text-white/55">
              {lang === "es" ? module.subtitleEs : module.subtitlePt}
            </p>
          </div>
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
      </div>

      <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">
        {lang === "es" ? module.statusEs : module.statusPt}
      </div>

      <p className="mt-4 text-sm leading-7 text-white/58">
        {lang === "es" ? module.descriptionEs : module.descriptionPt}
      </p>
    </div>
  );
}

function SignalCard({
  signal,
  lang,
}: {
  signal: ControlTowerSignal;
  lang: Lang;
}) {
  const Icon = signal.icon;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-medium text-white/92">
            {lang === "es" ? signal.titleEs : signal.titlePt}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/58">
            {lang === "es" ? signal.descriptionEs : signal.descriptionPt}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function ProtectedAppPage() {
  const lang: Lang = "es";

  const data = await withSqlAuthContext(async (tx, ctx) => {
    const runtime = await tx<RuntimeRow[]>`
      select
        core_identity.current_app_user_id()::text as user_id,
        core_identity.current_app_tenant_id()::text as tenant_id
    `;

    return {
      ctx,
      runtime: runtime[0] ?? {
        user_id: null,
        tenant_id: null,
      },
    };
  });

  const userName = getDisplayName(data.ctx);
  const userEmail = data.ctx.user?.email ?? null;
  const activeTenantId = data.ctx.session?.active_tenant_id ?? null;
  const runtimeUserId = data.runtime.user_id ?? null;
  const runtimeTenantId = data.runtime.tenant_id ?? null;

  const sessionValidated = Boolean(data.ctx.session?.id && runtimeUserId);
  const tenantValidated = Boolean(activeTenantId && runtimeTenantId);
  const runtimeConsistency =
    Boolean(activeTenantId) &&
    Boolean(runtimeTenantId) &&
    activeTenantId === runtimeTenantId;

  const postureLabel =
    sessionValidated && tenantValidated && runtimeConsistency
      ? lang === "es"
        ? "Postura operativa estable"
        : "Postura operacional estável"
      : lang === "es"
      ? "Postura en observación"
      : "Postura em observação";

  const postureDescription =
    sessionValidated && tenantValidated && runtimeConsistency
      ? lang === "es"
        ? "La identidad autenticada, el tenant activo y el contexto SQL ya están alineados para sostener la operación protegida del ecosistema."
        : "A identidade autenticada, o tenant ativo e o contexto SQL já estão alinhados para sustentar a operação protegida do ecossistema."
      : lang === "es"
      ? "La capa protegida fue cargada, pero aún requiere mayor endurecimiento visual y operativo en señales, autorizaciones y observabilidad."
      : "A camada protegida foi carregada, mas ainda requer maior endurecimento visual e operacional em sinais, autorizações e observabilidade.";

  const metrics: HubMetricCard[] = [
    {
      id: "session",
      titleEs: "Sesión protegida",
      titlePt: "Sessão protegida",
      value:
        sessionValidated
          ? lang === "es"
            ? "Validada"
            : "Validada"
          : lang === "es"
          ? "Pendiente"
          : "Pendente",
      descriptionEs:
        "Cookie httpOnly, validación contra Postgres y sesión viva dentro del runtime autenticado.",
      descriptionPt:
        "Cookie httpOnly, validação contra Postgres e sessão viva dentro do runtime autenticado.",
      icon: ShieldCheck,
      tone: sessionValidated ? "success" : "warning",
    },
    {
      id: "tenant",
      titleEs: "Tenant operativo",
      titlePt: "Tenant operacional",
      value:
        runtimeTenantId
          ? lang === "es"
            ? "En contexto"
            : "Em contexto"
          : lang === "es"
          ? "No definido"
          : "Não definido",
      descriptionEs:
        "Toda acción sensible debe operar condicionada por tenant activo, memberships y permisos posteriores.",
      descriptionPt:
        "Toda ação sensível deve operar condicionada por tenant ativo, memberships e permissões posteriores.",
      icon: Building2,
      tone: runtimeTenantId ? "success" : "warning",
    },
    {
      id: "authorization",
      titleEs: "Autorización",
      titlePt: "Autorização",
      value: lang === "es" ? "Próxima capa" : "Próxima camada",
      descriptionEs:
        "Lista para evolucionar hacia RBAC real, feature flags, navegación visible y restricción por módulo.",
      descriptionPt:
        "Pronta para evoluir para RBAC real, feature flags, navegação visível e restrição por módulo.",
      icon: LockKeyhole,
      tone: "warning",
    },
    {
      id: "tower",
      titleEs: "Control Tower",
      titlePt: "Control Tower",
      value: "Foundation ready",
      descriptionEs:
        "Base preparada para health, auditoría, eventos, jobs, incidentes e integraciones a nivel ecosistema.",
      descriptionPt:
        "Base preparada para health, auditoria, eventos, jobs, incidentes e integrações em nível de ecossistema.",
      icon: RadioTower,
      tone: "default",
    },
  ];

  const readinessCards: ReadinessCard[] = [
    {
      id: "identity-runtime",
      eyebrow: "AUTH RUNTIME",
      titleEs: "Identidad autenticada con contexto SQL aplicado",
      titlePt: "Identidade autenticada com contexto SQL aplicado",
      descriptionEs:
        "El hub protegido ya opera sobre identidad real y tenant activo resuelto desde el contexto server-side, evitando estados simulados o aislados por pantalla.",
      descriptionPt:
        "O hub protegido já opera sobre identidade real e tenant ativo resolvido a partir do contexto server-side, evitando estados simulados ou isolados por tela.",
      icon: Fingerprint,
    },
    {
      id: "navigation-governance",
      eyebrow: "NAVIGATION + GOVERNANCE",
      titleEs: "Base preparada para navegación visible por permisos y módulos",
      titlePt: "Base preparada para navegação visível por permissões e módulos",
      descriptionEs:
        "La siguiente expansión natural consiste en intersectar memberships, roles, módulos habilitados y feature flags para construir una navegación enterprise real.",
      descriptionPt:
        "A próxima expansão natural consiste em intersectar memberships, papéis, módulos habilitados e feature flags para construir uma navegação enterprise real.",
      icon: Layers3,
    },
    {
      id: "observability",
      eyebrow: "OBSERVABILITY",
      titleEs: "Puente estructural hacia auditoría y Control Tower",
      titlePt: "Ponte estrutural para auditoria e Control Tower",
      descriptionEs:
        "Cada login, logout, selección de tenant, acceso denegado, evento crítico o fallo de integración podrá correlacionarse por usuario, tenant y producto.",
      descriptionPt:
        "Cada login, logout, seleção de tenant, acesso negado, evento crítico ou falha de integração poderá ser correlacionado por usuário, tenant e produto.",
      icon: Activity,
    },
  ];

  const modules: ModuleLaunchCard[] = [
    {
      id: "crm",
      title: "CRM",
      subtitleEs: "Base comercial de clientes, leads y pipeline.",
      subtitlePt: "Base comercial de clientes, leads e pipeline.",
      statusEs: "Listo para estructuración premium",
      statusPt: "Pronto para estruturação premium",
      descriptionEs:
        "El hub ya puede evolucionar hacia registro de leads, cuentas, estados comerciales, responsables y lectura ejecutiva de oportunidades.",
      descriptionPt:
        "O hub já pode evoluir para registro de leads, contas, estados comerciais, responsáveis e leitura executiva de oportunidades.",
      icon: Landmark,
    },
    {
      id: "campaigns",
      title: "Campaigns",
      subtitleEs: "Operación masiva de e-mail y segmentación.",
      subtitlePt: "Operação massiva de e-mail e segmentação.",
      statusEs: "Prioridad operativa",
      statusPt: "Prioridade operacional",
      descriptionEs:
        "Preparado para listas, piezas, envíos, eventos de entrega, tracking, aperturas, rebotes y salud operacional de campañas.",
      descriptionPt:
        "Preparado para listas, peças, envios, eventos de entrega, tracking, aberturas, rejeições e saúde operacional de campanhas.",
      icon: BellRing,
    },
    {
      id: "proposals",
      title: "Proposals",
      subtitleEs: "Gestión premium de propuestas comerciales.",
      subtitlePt: "Gestão premium de propostas comerciais.",
      statusEs: "Próximo bloque ejecutivo",
      statusPt: "Próximo bloco executivo",
      descriptionEs:
        "La base ya soporta evolución hacia propuestas, estados, aprobaciones, versiones, responsables y trazabilidad comercial.",
      descriptionPt:
        "A base já suporta evolução para propostas, estados, aprovações, versões, responsáveis e rastreabilidade comercial.",
      icon: Workflow,
    },
    {
      id: "ecosystem",
      title: "Ecosystem",
      subtitleEs:
        "Base para productos propios y consumidores del auth central.",
      subtitlePt:
        "Base para produtos próprios e consumidores do auth central.",
      statusEs: "Arquitectura lista",
      statusPt: "Arquitetura pronta",
      descriptionEs:
        "Preparado para convivir con hub, paynex, signex y futuros productos con identidad unificada y contexto por tenant.",
      descriptionPt:
        "Preparado para conviver com hub, paynex, signex e futuros produtos com identidade unificada e contexto por tenant.",
      icon: Orbit,
    },
  ];

  const controlTowerSignals: ControlTowerSignal[] = [
    {
      id: "auth-events",
      titleEs: "Auth events",
      titlePt: "Auth events",
      descriptionEs:
        "Login, logout, refresh, selección de tenant, sesión inválida y accesos denegados.",
      descriptionPt:
        "Login, logout, refresh, seleção de tenant, sessão inválida e acessos negados.",
      icon: ShieldAlert,
    },
    {
      id: "health",
      titleEs: "Health base",
      titlePt: "Health base",
      descriptionEs:
        "Preparada para monitorear endpoints, integraciones, jobs y componentes críticos del ecosistema.",
      descriptionPt:
        "Preparada para monitorar endpoints, integrações, jobs e componentes críticos do ecossistema.",
      icon: Gauge,
    },
    {
      id: "audit",
      titleEs: "Auditoría crítica",
      titlePt: "Auditoria crítica",
      descriptionEs:
        "Lista para registrar acciones sensibles por usuario, tenant, módulo y producto consumidor.",
      descriptionPt:
        "Pronta para registrar ações sensíveis por usuário, tenant, módulo e produto consumidor.",
      icon: BadgeCheck,
    },
    {
      id: "automation",
      titleEs: "Jobs y automatizaciones",
      titlePt: "Jobs e automações",
      descriptionEs:
        "Diseñada para convivir con procesos asincrónicos, colas, sincronizaciones e integraciones empresariales.",
      descriptionPt:
        "Desenhada para conviver com processos assíncronos, filas, sincronizações e integrações empresariais.",
      icon: Bot,
    },
  ];

  const nextMandatoryStructure = [
    lang === "es"
      ? "Intersección real entre tenant, memberships, roles, módulos habilitados y navegación visible."
      : "Interseção real entre tenant, memberships, papéis, módulos habilitados e navegação visível.",
    lang === "es"
      ? "Base de eventos estructurados para Control Tower con correlación por usuario, tenant, producto e incidente."
      : "Base de eventos estruturados para Control Tower com correlação por usuário, tenant, produto e incidente.",
    lang === "es"
      ? "Protección consistente de cada query, action, endpoint y flujo sensible por contexto SQL real."
      : "Proteção consistente de cada query, action, endpoint e fluxo sensível por contexto SQL real.",
    lang === "es"
      ? "Preparación del hub para CRM, Campaigns, Proposals y futuros productos sin deuda arquitectónica temprana."
      : "Preparação do hub para CRM, Campaigns, Proposals e futuros produtos sem dívida arquitetônica precoce.",
  ];

  return (
    <section className="space-y-6">
      <SectionFrame className="shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="grid gap-8 p-6 xl:grid-cols-[1.15fr_0.85fr] xl:p-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <ExecutiveBadge>
                {lang === "es"
                  ? "Protected Executive Hub"
                  : "Protected Executive Hub"}
              </ExecutiveBadge>
              <ExecutiveBadge>Multi-tenant Runtime</ExecutiveBadge>
              <ExecutiveBadge>Control Tower Ready</ExecutiveBadge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-5xl text-3xl font-black leading-[0.95] tracking-[-0.04em] text-white md:text-5xl xl:text-6xl">
                {lang === "es"
                  ? `Bienvenido, ${userName}. El hub protegido del ecosistema ya opera con identidad y contexto real.`
                  : `Bem-vindo, ${userName}. O hub protegido do ecossistema já opera com identidade e contexto real.`}
              </h1>

              <p className="max-w-4xl text-sm leading-7 text-white/65 md:text-base">
                {lang === "es"
                  ? "A partir de este punto, cada módulo, consulta, endpoint, permiso, integración y evento crítico debe ejecutarse con sesión auténtica, tenant activo, contexto SQL aplicado y visibilidad estructural para la evolución del Control Tower central."
                  : "A partir deste ponto, cada módulo, consulta, endpoint, permissão, integração e evento crítico deve ser executado com sessão autêntica, tenant ativo, contexto SQL aplicado e visibilidade estrutural para a evolução do Control Tower central."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {readinessCards.map((card) => (
                <ReadinessBlock key={card.id} card={card} lang={lang} />
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-[#0b1220]/75 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {lang === "es"
                      ? "Lectura ejecutiva actual"
                      : "Leitura executiva atual"}
                  </div>

                  <div className="mt-2 text-xl font-bold text-white">
                    {postureLabel}
                  </div>

                  <p className="mt-3 text-sm leading-7 text-white/55">
                    {postureDescription}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es"
                    ? "Usuario de runtime"
                    : "Usuário de runtime"}
                </p>
                <p className="mt-3 break-all text-sm text-white/92">
                  {runtimeUserId ||
                    (lang === "es" ? "No disponible" : "Não disponível")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es"
                    ? "Tenant operativo"
                    : "Tenant operacional"}
                </p>
                <p className="mt-3 break-all text-sm text-white/92">
                  {runtimeTenantId ||
                    (lang === "es" ? "No definido" : "Não definido")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es"
                    ? "Usuario visible"
                    : "Usuário visível"}
                </p>
                <p className="mt-3 break-all text-sm text-white/92">
                  {userEmail ||
                    userName ||
                    (lang === "es" ? "No disponible" : "Não disponível")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es"
                    ? "Consistencia runtime"
                    : "Consistência runtime"}
                </p>
                <p className="mt-3 text-sm text-white/92">
                  {runtimeConsistency
                    ? lang === "es"
                      ? "Alineada"
                      : "Alinhada"
                    : lang === "es"
                    ? "En observación"
                    : "Em observação"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                    {lang === "es" ? "Estado del hub" : "Estado do hub"}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {lang === "es"
                      ? "Base protegida lista para crecimiento enterprise"
                      : "Base protegida pronta para crescimento enterprise"}
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300">
                  <Rocket className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-3 text-sm leading-7 text-white/55">
                {lang === "es"
                  ? "El siguiente salto natural es convertir este hub en la superficie operativa real de CRM, Campaigns, Proposals, autorizaciones, eventos y monitoreo transversal."
                  : "O próximo salto natural é converter este hub na superfície operacional real de CRM, Campaigns, Proposals, autorizações, eventos e monitoramento transversal."}
              </p>
            </div>
          </div>
        </div>
      </SectionFrame>

      <div className="grid gap-4 lg:grid-cols-4">
        {metrics.map((card) => (
          <MetricCard key={card.id} card={card} lang={lang} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionFrame>
          <div className="space-y-6 p-6">
            <SectionHeader
              icon={Blocks}
              eyebrow={
                lang === "es"
                  ? "Launchpad del ecosistema"
                  : "Launchpad do ecossistema"
              }
              title={
                lang === "es"
                  ? "Bloques de evolución inmediata dentro del hub protegido"
                  : "Blocos de evolução imediata dentro do hub protegido"
              }
            />

            <div className="grid gap-4 md:grid-cols-2">
              {modules.map((module) => (
                <LaunchModuleCard
                  key={module.id}
                  module={module}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        </SectionFrame>

        <SectionFrame>
          <div className="space-y-6 p-6">
            <SectionHeader
              icon={RadioTower}
              eyebrow="Control Tower"
              title={
                lang === "es"
                  ? "Presencia estructural inicial dentro del hub"
                  : "Presença estrutural inicial dentro do hub"
              }
            />

            <div className="space-y-3">
              {controlTowerSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} lang={lang} />
              ))}
            </div>

            <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                  <ServerCog className="h-4 w-4" />
                </div>

                <div>
                  <div className="text-sm font-semibold text-white/92">
                    {lang === "es"
                      ? "Lectura de arquitectura"
                      : "Leitura de arquitetura"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {lang === "es"
                      ? "Este hub ya no se presenta como una simple pantalla de bienvenida. Se comporta como la base operativa protegida del ecosistema PROCEIT, lista para absorber módulos, autorizaciones, señales y monitoreo de nivel enterprise."
                      : "Este hub já não se apresenta como uma simples tela de boas-vindas. Ele se comporta como a base operacional protegida do ecossistema PROCEIT, pronta para absorver módulos, autorizações, sinais e monitoramento de nível enterprise."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SectionFrame>
      </div>

      <SectionFrame>
        <div className="grid gap-4 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <SectionHeader
              icon={Workflow}
              eyebrow={
                lang === "es"
                  ? "Siguiente estructura obligatoria"
                  : "Próxima estrutura obrigatória"
              }
              title={
                lang === "es"
                  ? "Autorización, módulos activos y monitoreo transversal"
                  : "Autorização, módulos ativos e monitoramento transversal"
              }
            />

            <div className="grid gap-3">
              {nextMandatoryStructure.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-white/72"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {lang === "es"
                    ? "Conclusión operativa"
                    : "Conclusão operacional"}
                </div>

                <div className="mt-2 text-xl font-bold text-white">
                  {lang === "es"
                    ? "La base protegida ya está lista para convertirse en producto interno real"
                    : "A base protegida já está pronta para se tornar produto interno real"}
                </div>

                <p className="mt-3 text-sm leading-7 text-white/58">
                  {lang === "es"
                    ? "La estructura actual ya soporta el siguiente paso serio: abandonar la lógica de pantalla demostrativa y evolucionar hacia un hub operativo con datos reales, navegación por permisos y observabilidad centralizada para todo el ecosistema."
                    : "A estrutura atual já suporta o próximo passo sério: abandonar a lógica de tela demonstrativa e evoluir para um hub operacional com dados reais, navegação por permissões e observabilidade centralizada para todo o ecossistema."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionFrame>
    </section>
  );
}