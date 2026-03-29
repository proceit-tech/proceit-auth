import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  Fingerprint,
  Gauge,
  Globe2,
  HeartPulse,
  Layers3,
  LockKeyhole,
  Orbit,
  RadioTower,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  TimerReset,
  Waypoints,
  Workflow,
  Wrench,
  Blocks,
} from "lucide-react";

import { withSqlAuthContext } from "@/lib/auth/server-context";
import { getDisplayName } from "@/lib/auth/user";

type Lang = "es" | "pt";

type RuntimeRow = {
  user_id: string | null;
  tenant_id: string | null;
};

type StatusTone = "healthy" | "warning" | "critical" | "neutral";
type IconType = ComponentType<{ className?: string }>;

type ExecutiveMetric = {
  id: string;
  titleEs: string;
  titlePt: string;
  value: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
  tone: StatusTone;
};

type TowerDomainCard = {
  id: string;
  eyebrow: string;
  titleEs: string;
  titlePt: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
};

type SignalCard = {
  id: string;
  titleEs: string;
  titlePt: string;
  descriptionEs: string;
  descriptionPt: string;
  statusEs: string;
  statusPt: string;
  tone: StatusTone;
  icon: IconType;
};

type PipelineCard = {
  id: string;
  titleEs: string;
  titlePt: string;
  descriptionEs: string;
  descriptionPt: string;
  icon: IconType;
};

function toneClasses(tone: StatusTone) {
  if (tone === "healthy") {
    return {
      wrapper: "border-emerald-400/15 bg-emerald-500/5",
      icon: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      value: "text-emerald-200",
    };
  }

  if (tone === "warning") {
    return {
      wrapper: "border-amber-400/15 bg-amber-500/5",
      icon: "border-amber-400/20 bg-amber-400/10 text-amber-300",
      badge: "border-amber-400/20 bg-amber-400/10 text-amber-300",
      value: "text-amber-200",
    };
  }

  if (tone === "critical") {
    return {
      wrapper: "border-red-400/15 bg-red-500/5",
      icon: "border-red-400/20 bg-red-500/10 text-red-300",
      badge: "border-red-400/20 bg-red-500/10 text-red-300",
      value: "text-red-200",
    };
  }

  return {
    wrapper: "border-white/10 bg-white/5",
    icon: "border-white/10 bg-white/10 text-white/80",
    badge: "border-white/10 bg-white/10 text-white/70",
    value: "text-white",
  };
}

function Frame({
  children,
  className = "",
}: {
  children: ReactNode;
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

function Chip({ children }: { children: ReactNode }) {
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

function DomainBlock({
  domain,
  lang,
}: {
  domain: TowerDomainCard;
  lang: Lang;
}) {
  const Icon = domain.icon;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b1220]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
        <Icon className="h-5 w-5" />
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {domain.eyebrow}
      </div>

      <div className="mt-3 text-lg font-bold text-white">
        {lang === "es" ? domain.titleEs : domain.titlePt}
      </div>

      <p className="mt-2 text-sm leading-6 text-white/55">
        {lang === "es" ? domain.descriptionEs : domain.descriptionPt}
      </p>
    </div>
  );
}

function ExecutiveMetricCard({
  metric,
  lang,
}: {
  metric: ExecutiveMetric;
  lang: Lang;
}) {
  const Icon = metric.icon;
  const tone = toneClasses(metric.tone);

  return (
    <div className={`rounded-3xl border p-5 backdrop-blur ${tone.wrapper}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
          {lang === "es" ? metric.titleEs : metric.titlePt}
        </p>

        <div className={`rounded-2xl border p-2 ${tone.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className={`mt-4 text-xl font-semibold ${tone.value}`}>
        {metric.value}
      </p>

      <p className="mt-2 text-sm leading-6 text-white/58">
        {lang === "es" ? metric.descriptionEs : metric.descriptionPt}
      </p>
    </div>
  );
}

function SignalBlock({
  signal,
  lang,
}: {
  signal: SignalCard;
  lang: Lang;
}) {
  const Icon = signal.icon;
  const tone = toneClasses(signal.tone);

  return (
    <div
      className={`rounded-3xl border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] ${tone.wrapper}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${tone.icon}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <div className="text-base font-semibold text-white">
              {lang === "es" ? signal.titleEs : signal.titlePt}
            </div>
            <p className="mt-2 text-sm leading-6 text-white/58">
              {lang === "es"
                ? signal.descriptionEs
                : signal.descriptionPt}
            </p>
          </div>
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
      </div>

      <div
        className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}
      >
        {lang === "es" ? signal.statusEs : signal.statusPt}
      </div>
    </div>
  );
}

function PipelineBlock({
  pipeline,
  lang,
}: {
  pipeline: PipelineCard;
  lang: Lang;
}) {
  const Icon = pipeline.icon;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75">
          <Icon className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-medium text-white/92">
            {lang === "es" ? pipeline.titleEs : pipeline.titlePt}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/58">
            {lang === "es"
              ? pipeline.descriptionEs
              : pipeline.descriptionPt}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function ControlTowerPage() {
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
  const runtimeUserId = data.runtime.user_id ?? null;
  const runtimeTenantId = data.runtime.tenant_id ?? null;
  const activeTenantId = data.ctx.session?.active_tenant_id ?? null;

  const runtimeIntegrity =
    Boolean(runtimeUserId) &&
    Boolean(runtimeTenantId) &&
    Boolean(activeTenantId) &&
    runtimeTenantId === activeTenantId;

  const globalPostureTone: StatusTone = runtimeIntegrity
    ? "healthy"
    : "warning";

  const globalPostureLabel = runtimeIntegrity
    ? lang === "es"
      ? "Visibilidad estructural inicial activa"
      : "Visibilidade estrutural inicial ativa"
    : lang === "es"
      ? "Base de monitoreo en observación"
      : "Base de monitoramento em observação";

  const globalPostureCopy = runtimeIntegrity
    ? lang === "es"
      ? "El Control Tower ya nace conectado al runtime autenticado, al tenant operativo y a la base estructural necesaria para expandirse hacia salud, auditoría, eventos y telemetría transversal."
      : "O Control Tower já nasce conectado ao runtime autenticado, ao tenant operacional e à base estrutural necessária para expandir-se para saúde, auditoria, eventos e telemetria transversal."
    : lang === "es"
      ? "La capa visual ya está creada, pero todavía debe enriquecerse con señales reales, jobs, integraciones, trazabilidad y alertamiento operativo."
      : "A camada visual já está criada, mas ainda deve ser enriquecida com sinais reais, jobs, integrações, rastreabilidade e alertamento operacional.";

  const executiveMetrics: ExecutiveMetric[] = [
    {
      id: "runtime",
      titleEs: "Runtime autenticado",
      titlePt: "Runtime autenticado",
      value: runtimeIntegrity
        ? lang === "es"
          ? "Alineado"
          : "Alinhado"
        : lang === "es"
          ? "En observación"
          : "Em observação",
      descriptionEs:
        "La torre ya se apoya en identidad real, sesión viva y tenant activo resuelto desde contexto server-side.",
      descriptionPt:
        "A torre já se apoia em identidade real, sessão viva e tenant ativo resolvido a partir de contexto server-side.",
      icon: ShieldCheck,
      tone: runtimeIntegrity ? "healthy" : "warning",
    },
    {
      id: "health",
      titleEs: "Health base",
      titlePt: "Health base",
      value: lang === "es" ? "Preparado" : "Preparado",
      descriptionEs:
        "Lista para monitorear endpoints, integraciones, servicios internos, colas, jobs y consumo operativo.",
      descriptionPt:
        "Pronta para monitorar endpoints, integrações, serviços internos, filas, jobs e consumo operacional.",
      icon: HeartPulse,
      tone: "neutral",
    },
    {
      id: "auditing",
      titleEs: "Auditoría crítica",
      titlePt: "Auditoria crítica",
      value: lang === "es" ? "Base lista" : "Base pronta",
      descriptionEs:
        "Preparada para correlacionar acciones sensibles por usuario, tenant, módulo, producto y severidad.",
      descriptionPt:
        "Preparada para correlacionar ações sensíveis por usuário, tenant, módulo, produto e severidade.",
      icon: BadgeCheck,
      tone: "neutral",
    },
    {
      id: "alerts",
      titleEs: "Alertamiento",
      titlePt: "Alertamento",
      value: lang === "es" ? "Próxima capa" : "Próxima camada",
      descriptionEs:
        "Diseñada para crecer hacia incidentes, degradación de servicios, auth anomalies y fallas de sincronización.",
      descriptionPt:
        "Desenhada para crescer para incidentes, degradação de serviços, auth anomalies e falhas de sincronização.",
      icon: Siren,
      tone: "warning",
    },
  ];

  const domains: TowerDomainCard[] = [
    {
      id: "ecosystem-observability",
      eyebrow: "ECOSYSTEM OBSERVABILITY",
      titleEs:
        "Monitoreo transversal del ecosistema y no de una pantalla aislada",
      titlePt:
        "Monitoramento transversal do ecossistema e não de uma tela isolada",
      descriptionEs:
        "El Control Tower fue concebido como la capa central que en el futuro consolidará eventos, servicios, productos, tenants, logs, alertas y operaciones críticas dentro del hub principal.",
      descriptionPt:
        "O Control Tower foi concebido como a camada central que no futuro consolidará eventos, serviços, produtos, tenants, logs, alertas e operações críticas dentro do hub principal.",
      icon: RadioTower,
    },
    {
      id: "multi-tenant-context",
      eyebrow: "MULTI-TENANT CONTEXT",
      titleEs:
        "Lectura con contexto real por tenant, usuario y producto consumidor",
      titlePt:
        "Leitura com contexto real por tenant, usuário e produto consumidor",
      descriptionEs:
        "Toda señal relevante podrá correlacionarse por identidad, tenant activo, producto origen, módulo, endpoint y severidad operacional.",
      descriptionPt:
        "Todo sinal relevante poderá ser correlacionado por identidade, tenant ativo, produto de origem, módulo, endpoint e severidade operacional.",
      icon: Orbit,
    },
    {
      id: "governance-audit",
      eyebrow: "GOVERNANCE + AUDIT",
      titleEs:
        "Base ejecutiva para auditoría, salud y control estructural",
      titlePt:
        "Base executiva para auditoria, saúde e controle estrutural",
      descriptionEs:
        "Esta primera versión ya debe sentirse como una torre premium de gobernanza, no como un bloque decorativo. Su función es absorber complejidad futura sin rehacer la arquitectura.",
      descriptionPt:
        "Esta primeira versão já deve parecer uma torre premium de governança, não como um bloco decorativo. Sua função é absorver complexidade futura sem refazer a arquitetura.",
      icon: Layers3,
    },
  ];

  const liveSignals: SignalCard[] = [
    {
      id: "auth-events",
      titleEs: "Eventos de autenticación",
      titlePt: "Eventos de autenticação",
      descriptionEs:
        "Login, logout, refresh, selección de tenant, sesión inválida, contexto inconsistente y accesos denegados.",
      descriptionPt:
        "Login, logout, refresh, seleção de tenant, sessão inválida, contexto inconsistente e acessos negados.",
      statusEs: "Base estructural definida",
      statusPt: "Base estrutural definida",
      tone: "healthy",
      icon: Fingerprint,
    },
    {
      id: "services-health",
      titleEs: "Salud de servicios e integraciones",
      titlePt: "Saúde de serviços e integrações",
      descriptionEs:
        "Monitoreo futuro de API gateway, auth, jobs, providers externos, correo, colas, cron y servicios consumidores.",
      descriptionPt:
        "Monitoramento futuro de API gateway, auth, jobs, providers externos, e-mail, filas, cron e serviços consumidores.",
      statusEs: "Listo para evolución",
      statusPt: "Pronto para evolução",
      tone: "warning",
      icon: Globe2,
    },
    {
      id: "jobs-queues",
      titleEs: "Jobs, colas y automatizaciones",
      titlePt: "Jobs, filas e automações",
      descriptionEs:
        "Visibilidad futura para tareas asincrónicas, sincronizaciones, reintentos, fallas silenciosas y throughput operativo.",
      descriptionPt:
        "Visibilidade futura para tarefas assíncronas, sincronizações, reintentos, falhas silenciosas e throughput operacional.",
      statusEs: "Próximo bloque",
      statusPt: "Próximo bloco",
      tone: "warning",
      icon: Bot,
    },
    {
      id: "critical-audit",
      titleEs: "Auditoría de acciones críticas",
      titlePt: "Auditoria de ações críticas",
      descriptionEs:
        "Creación, edición, eliminación, cambios de permisos, operaciones sensibles y acciones con impacto empresarial.",
      descriptionPt:
        "Criação, edição, exclusão, mudanças de permissões, operações sensíveis e ações com impacto empresarial.",
      statusEs: "Arquitectura preparada",
      statusPt: "Arquitetura preparada",
      tone: "healthy",
      icon: LockKeyhole,
    },
  ];

  const pipelines: PipelineCard[] = [
    {
      id: "products",
      titleEs: "Productos y consumidores",
      titlePt: "Produtos e consumidores",
      descriptionEs:
        "Preparado para consolidar señales de app.proceit.net, auth.proceit.net, paynex, signex y futuros productos bajo lectura unificada.",
      descriptionPt:
        "Preparado para consolidar sinais de app.proceit.net, auth.proceit.net, paynex, signex e futuros produtos sob leitura unificada.",
      icon: Blocks,
    },
    {
      id: "database-runtime",
      titleEs: "Runtime y base de datos",
      titlePt: "Runtime e base de dados",
      descriptionEs:
        "Debe evolucionar hacia métricas de consultas críticas, errores, latencia, saturación lógica y consistencia de contexto SQL.",
      descriptionPt:
        "Deve evoluir para métricas de consultas críticas, erros, latência, saturação lógica e consistência de contexto SQL.",
      icon: Database,
    },
    {
      id: "incidents",
      titleEs: "Incidentes y degradación",
      titlePt: "Incidentes e degradação",
      descriptionEs:
        "Preparado para clasificar incidentes por severidad, impacto, tenant afectado, producto, origen y tiempo de respuesta.",
      descriptionPt:
        "Preparado para classificar incidentes por severidade, impacto, tenant afetado, produto, origem e tempo de resposta.",
      icon: AlertTriangle,
    },
    {
      id: "flows",
      titleEs: "Flujos operativos y trazabilidad",
      titlePt: "Fluxos operacionais e rastreabilidade",
      descriptionEs:
        "Listo para correlacionar operaciones de negocio, automatizaciones, aprobaciones y rutas críticas de la plataforma.",
      descriptionPt:
        "Pronto para correlacionar operações de negócio, automações, aprovações e rotas críticas da plataforma.",
      icon: Workflow,
    },
  ];

  const nextEvolution = [
    lang === "es"
      ? "Incorporar eventos reales de autenticación, selección de tenant, permisos y accesos denegados."
      : "Incorporar eventos reais de autenticação, seleção de tenant, permissões e acessos negados.",
    lang === "es"
      ? "Agregar health por producto, integración, endpoint, job y servicio crítico."
      : "Adicionar health por produto, integração, endpoint, job e serviço crítico.",
    lang === "es"
      ? "Definir severidades, reglas de alertamiento, correlación de incidentes y priorización operativa."
      : "Definir severidades, regras de alertamento, correlação de incidentes e priorização operacional.",
    lang === "es"
      ? "Consolidar trazabilidad premium para que la equipe pueda entender causa, impacto y respuesta."
      : "Consolidar rastreabilidade premium para que a equipe possa entender causa, impacto e resposta.",
  ];

  return (
    <section className="space-y-6">
      <Frame className="shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
        <div className="grid gap-8 p-6 xl:grid-cols-[1.15fr_0.85fr] xl:p-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>Control Tower</Chip>
              <Chip>Ecosystem Visibility</Chip>
              <Chip>Multi-tenant Monitoring</Chip>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-5xl text-3xl font-black leading-[0.95] tracking-[-0.04em] text-white md:text-5xl xl:text-6xl">
                {lang === "es"
                  ? `Control Tower central: visibilidad estructural inicial para todo el ecosistema, ${userName}.`
                  : `Control Tower central: visibilidade estrutural inicial para todo o ecossistema, ${userName}.`}
              </h1>

              <p className="max-w-4xl text-sm leading-7 text-white/65 md:text-base">
                {lang === "es"
                  ? "Esta capa no existe como panel aislado ni como futuro subdominio separado. Nace dentro del hub principal para consolidar, en una sola superficie ejecutiva, la salud operativa, la auditoría, los eventos, las señales de riesgo, las integraciones y la trazabilidad transversal del ecosistema PROCEIT."
                  : "Esta camada não existe como painel isolado nem como futuro subdomínio separado. Ela nasce dentro do hub principal para consolidar, em uma única superfície executiva, a saúde operacional, a auditoria, os eventos, os sinais de risco, as integrações e a rastreabilidade transversal do ecossistema PROCEIT."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {domains.map((domain) => (
                <DomainBlock key={domain.id} domain={domain} lang={lang} />
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div
              className={`rounded-3xl border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] ${toneClasses(globalPostureTone).wrapper}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClasses(globalPostureTone).icon}`}
                >
                  <RadioTower className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {lang === "es"
                      ? "Postura actual de la torre"
                      : "Postura atual da torre"}
                  </div>

                  <div className="mt-2 text-xl font-bold text-white">
                    {globalPostureLabel}
                  </div>

                  <p className="mt-3 text-sm leading-7 text-white/55">
                    {globalPostureCopy}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es" ? "Usuario runtime" : "Usuário runtime"}
                </p>
                <p className="mt-3 break-all text-sm text-white/92">
                  {runtimeUserId ||
                    (lang === "es" ? "No disponible" : "Não disponível")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es" ? "Tenant runtime" : "Tenant runtime"}
                </p>
                <p className="mt-3 break-all text-sm text-white/92">
                  {runtimeTenantId ||
                    (lang === "es" ? "No definido" : "Não definido")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es"
                    ? "Tenant activo sesión"
                    : "Tenant ativo sessão"}
                </p>
                <p className="mt-3 break-all text-sm text-white/92">
                  {activeTenantId ||
                    (lang === "es" ? "No definido" : "Não definido")}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {lang === "es"
                    ? "Integridad contextual"
                    : "Integridade contextual"}
                </p>
                <p className="mt-3 text-sm text-white/92">
                  {runtimeIntegrity
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
                    {lang === "es"
                      ? "Mandato estructural"
                      : "Mandato estrutural"}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {lang === "es"
                      ? "Una sola torre para productos, tenants, eventos y salud operacional"
                      : "Uma única torre para produtos, tenants, eventos e saúde operacional"}
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300">
                  <Waypoints className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-3 text-sm leading-7 text-white/55">
                {lang === "es"
                  ? "La función de esta pantalla es convertirse en la superficie premium donde el equipo podrá entender qué está ocurriendo, dónde ocurre, a quién impacta y cómo reaccionar con velocidad."
                  : "A função desta tela é tornar-se a superfície premium onde a equipe poderá entender o que está acontecendo, onde acontece, a quem impacta e como reagir com velocidade."}
              </p>
            </div>
          </div>
        </div>
      </Frame>

      <div className="grid gap-4 lg:grid-cols-4">
        {executiveMetrics.map((metric) => (
          <ExecutiveMetricCard key={metric.id} metric={metric} lang={lang} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Frame>
          <div className="space-y-6 p-6">
            <SectionHeader
              icon={Activity}
              eyebrow={
                lang === "es" ? "Señales estratégicas" : "Sinais estratégicos"
              }
              title={
                lang === "es"
                  ? "Bloques que esta torre debe absorber y correlacionar"
                  : "Blocos que esta torre deve absorver e correlacionar"
              }
            />

            <div className="grid gap-4 md:grid-cols-2">
              {liveSignals.map((signal) => (
                <SignalBlock key={signal.id} signal={signal} lang={lang} />
              ))}
            </div>
          </div>
        </Frame>

        <Frame>
          <div className="space-y-6 p-6">
            <SectionHeader
              icon={ServerCog}
              eyebrow={
                lang === "es"
                  ? "Pipelines de observación"
                  : "Pipelines de observação"
              }
              title={
                lang === "es"
                  ? "Superficies operativas que el equipo podrá monitorear"
                  : "Superfícies operacionais que a equipe poderá monitorar"
              }
            />

            <div className="space-y-3">
              {pipelines.map((pipeline) => (
                <PipelineBlock key={pipeline.id} pipeline={pipeline} lang={lang} />
              ))}
            </div>

            <div className="rounded-2xl border border-sky-400/15 bg-sky-400/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                  <TimerReset className="h-4 w-4" />
                </div>

                <div>
                  <div className="text-sm font-semibold text-white/92">
                    {lang === "es"
                      ? "Lectura ejecutiva"
                      : "Leitura executiva"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {lang === "es"
                      ? "Esta versión ya define la postura correcta: Control Tower no será una página vacía de monitoreo futurista, sino la columna vertebral de lectura operativa del ecosistema PROCEIT."
                      : "Esta versão já define a postura correta: o Control Tower não será uma página vazia de monitoramento futurista, mas sim a coluna vertebral de leitura operacional do ecossistema PROCEIT."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Frame>
      </div>

      <Frame>
        <div className="grid gap-4 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <SectionHeader
              icon={Gauge}
              eyebrow={
                lang === "es"
                  ? "Siguiente evolución obligatoria"
                  : "Próxima evolução obrigatória"
              }
              title={
                lang === "es"
                  ? "Conectar señales reales, severidades, alertas e histórico"
                  : "Conectar sinais reais, severidades, alertas e histórico"
              }
            />

            <div className="grid gap-3">
              {nextEvolution.map((item) => (
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
                    ? "Conclusión estructural"
                    : "Conclusão estrutural"}
                </div>

                <div className="mt-2 text-xl font-bold text-white">
                  {lang === "es"
                    ? "La torre ya nace con posicionamiento correcto dentro del ecosistema"
                    : "A torre já nasce com posicionamento correto dentro do ecossistema"}
                </div>

                <p className="mt-3 text-sm leading-7 text-white/58">
                  {lang === "es"
                    ? "No estamos creando una página vacía para “ver después”. Estamos estableciendo desde ahora la base visual, ejecutiva y arquitectónica del centro de monitoreo que acompañará todo el crecimiento de PROCEIT."
                    : "Não estamos criando uma página vazia para “ver depois”. Estamos estabelecendo desde agora a base visual, executiva e arquitetônica do centro de monitoramento que acompanhará todo o crescimento da PROCEIT."}
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75">
                      <Wrench className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        {lang === "es"
                          ? "Punto de partida correcto"
                          : "Ponto de partida correto"}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/58">
                        {lang === "es"
                          ? "El próximo paso ya no es rediseñar esta pantalla, sino conectarla con eventos, métricas, health, jobs y alertas reales."
                          : "O próximo passo já não é redesenhar esta tela, mas conectá-la com eventos, métricas, health, jobs e alertas reais."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Frame>
    </section>
  );
}