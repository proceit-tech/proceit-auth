"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  RadioTower,
  Building2,
  LockKeyhole,
  Network,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type Lang = "es" | "pt";

type LoginApiResponse = {
  ok?: boolean;
  message?: string;
  requires_tenant_selection?: boolean;
  redirect_to?: string | null;
  session?: {
    id?: string;
    status?: string;
  } | null;
  user?: {
    id?: string;
    display_name?: string | null;
    full_name?: string | null;
  } | null;
  runtime?: {
    authenticated?: boolean;
    sessionId?: string | null;
    activeTenant?: {
      id?: string;
      name?: string;
      code?: string | null;
    } | null;
  } | null;
};

const ALLOWED_RETURN_TO_ORIGINS = new Set<string>([
  "https://auth.proceit.net",
  "https://app.proceit.net",
  "https://paynex.proceit.net",
  "https://signex.proceit.net",
  "https://www.proceit.net",
  "https://proceit.net",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
]);

function normalizeDocument(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "").trim();
}

function sanitizeReturnTo(value: string | null) {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return null;
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (!ALLOWED_RETURN_TO_ORIGINS.has(url.origin)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildNextUrl(
  requiresTenantSelection: boolean,
  apiRedirectTo: string | null | undefined,
  returnTo: string | null,
) {
  const safeApiRedirectTo = sanitizeReturnTo(apiRedirectTo ?? null);

  if (safeApiRedirectTo) {
    return safeApiRedirectTo;
  }

  if (requiresTenantSelection) {
    if (returnTo) {
      const encoded = encodeURIComponent(returnTo);
      return `/select-tenant?return_to=${encoded}`;
    }

    return "/select-tenant";
  }

  if (returnTo) {
    return returnTo;
  }

  return "/app";
}

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

function buildUiEventPayload(input: {
  eventName: string;
  lang: Lang;
  clientApp: string | null;
  tenantHint: string | null;
  returnTo: string | null;
  pathname: string;
  success?: boolean;
  detail?: string | null;
}) {
  return {
    eventName: input.eventName,
    occurredAt: new Date().toISOString(),
    lang: input.lang,
    clientApp: input.clientApp,
    tenantHint: input.tenantHint,
    returnTo: input.returnTo,
    pathname: input.pathname,
    success: input.success ?? null,
    detail: input.detail ?? null,
    surface: "auth-login-page",
  };
}

function emitUiEvent(input: {
  eventName: string;
  lang: Lang;
  clientApp: string | null;
  tenantHint: string | null;
  returnTo: string | null;
  success?: boolean;
  detail?: string | null;
}) {
  try {
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : "/login";

    const payload = buildUiEventPayload({
      eventName: input.eventName,
      lang: input.lang,
      clientApp: input.clientApp,
      tenantHint: input.tenantHint,
      returnTo: input.returnTo,
      pathname,
      success: input.success,
      detail: input.detail ?? null,
    });

    console.info("[auth/login-ui-event]", payload);
  } catch {
    /**
     * Não bloquear a UX por falha de telemetria client-side.
     */
  }
}

function FieldHint({
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
        : "border-white/10 bg-white/5 text-white/58";

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

function CapabilityCard({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

      <div className="space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
            {icon}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
              {eyebrow}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
          </div>
        </div>

        <p className="text-sm leading-7 text-white/62">{description}</p>
      </div>
    </div>
  );
}

function SignalCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="w-fit rounded-2xl border border-white/10 bg-white/10 p-3">
        {icon}
      </div>

      <p className="mt-4 text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/58">{description}</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<Lang>("es");

  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [documentTouched, setDocumentTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const returnTo = useMemo(
    () => sanitizeReturnTo(searchParams.get("return_to")),
    [searchParams],
  );

  const clientApp = useMemo(
    () => searchParams.get("client_app")?.trim() || null,
    [searchParams],
  );

  const tenantHint = useMemo(
    () => searchParams.get("tenant_hint")?.trim() || null,
    [searchParams],
  );

  const langHint = useMemo(() => {
    const value = searchParams.get("lang");
    return value === "pt" ? "pt" : "es";
  }, [searchParams]);

  useEffect(() => {
    setLang(langHint);
  }, [langHint]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const normalizedDocument = useMemo(
    () => normalizeDocument(document),
    [document],
  );

  const documentInputId = "login-document";
  const passwordInputId = "login-password";
  const documentHelpId = "login-document-help";
  const documentErrorId = "login-document-error";
  const passwordHelpId = "login-password-help";
  const passwordErrorId = "login-password-error";
  const formErrorId = "login-form-error";
  const formSuccessId = "login-form-success";

  const documentError = useMemo(() => {
    if (!documentTouched) return "";

    if (!normalizedDocument) {
      return lang === "es"
        ? "Debe informar su documento para continuar."
        : "Você deve informar seu documento para continuar.";
    }

    if (normalizedDocument.length < 5) {
      return lang === "es"
        ? "El documento informado parece incompleto."
        : "O documento informado parece incompleto.";
    }

    return "";
  }, [documentTouched, normalizedDocument, lang]);

  const passwordError = useMemo(() => {
    if (!passwordTouched) return "";

    if (!password.trim()) {
      return lang === "es"
        ? "Debe informar su contraseña."
        : "Você deve informar sua senha.";
    }

    if (password.trim().length < 6) {
      return lang === "es"
        ? "La contraseña informada parece demasiado corta."
        : "A senha informada parece curta demais.";
    }

    return "";
  }, [passwordTouched, password, lang]);

  const formIsInvalid =
    !normalizedDocument ||
    !password.trim() ||
    Boolean(documentError) ||
    Boolean(passwordError);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (submitting) {
      return;
    }

    setDocumentTouched(true);
    setPasswordTouched(true);
    setError("");
    setSuccessMessage("");

    if (!normalizedDocument || !password.trim()) {
      const message =
        lang === "es"
          ? "Complete los campos obligatorios antes de continuar."
          : "Preencha os campos obrigatórios antes de continuar.";

      setError(message);

      emitUiEvent({
        eventName: "AUTH_LOGIN_UI_VALIDATION_FAILED",
        lang,
        clientApp,
        tenantHint,
        returnTo,
        success: false,
        detail: "missing_required_fields",
      });

      return;
    }

    if (documentError || passwordError) {
      const message =
        lang === "es"
          ? "Revise los datos informados antes de intentar nuevamente."
          : "Revise os dados informados antes de tentar novamente.";

      setError(message);

      emitUiEvent({
        eventName: "AUTH_LOGIN_UI_VALIDATION_FAILED",
        lang,
        clientApp,
        tenantHint,
        returnTo,
        success: false,
        detail: "field_validation_error",
      });

      return;
    }

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setSubmitting(true);

      emitUiEvent({
        eventName: "AUTH_LOGIN_UI_SUBMIT_STARTED",
        lang,
        clientApp,
        tenantHint,
        returnTo,
        success: null as never,
        detail: null,
      });

      const payload = {
        document: normalizedDocument,
        password,
        return_to: returnTo,
        client_app: clientApp,
        tenant_hint: tenantHint,
        requested_lang: lang,
        login_context: {
          authority: "auth.proceit.net",
          channel: "web",
          surface: "login-page",
          user_agent:
            typeof window !== "undefined" ? window.navigator.userAgent : null,
          pathname:
            typeof window !== "undefined" ? window.location.pathname : "/login",
          origin:
            typeof window !== "undefined" ? window.location.origin : null,
          return_to: returnTo,
          client_app: clientApp,
          tenant_hint: tenantHint,
        },
      };

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await parseJsonSafely<LoginApiResponse>(response);

      if (!response.ok || !data?.ok) {
        const failureMessage =
          data?.message ||
          (lang === "es"
            ? "No fue posible iniciar sesión con los datos informados."
            : "Não foi possível iniciar sessão com os dados informados.");

        if (!isMountedRef.current) {
          return;
        }

        setError(failureMessage);

        emitUiEvent({
          eventName: "AUTH_LOGIN_UI_SUBMIT_FAILED",
          lang,
          clientApp,
          tenantHint,
          returnTo,
          success: false,
          detail: failureMessage,
        });

        return;
      }

      const successText =
        lang === "es"
          ? "Acceso validado correctamente. Redirigiendo al entorno autorizado..."
          : "Acesso validado com sucesso. Redirecionando para o ambiente autorizado...";

      if (!isMountedRef.current) {
        return;
      }

      setSuccessMessage(successText);

      const nextUrl = buildNextUrl(
        Boolean(data.requires_tenant_selection),
        data.redirect_to,
        returnTo,
      );

      emitUiEvent({
        eventName: "AUTH_LOGIN_UI_SUBMIT_SUCCEEDED",
        lang,
        clientApp,
        tenantHint,
        returnTo,
        success: true,
        detail: nextUrl,
      });

      router.replace(nextUrl);
      router.refresh();
    } catch (err) {
      const isAbortError =
        err instanceof DOMException && err.name === "AbortError";

      if (isAbortError) {
        return;
      }

      console.error("[auth/login-page] unexpected_error", err);

      const unexpectedMessage =
        lang === "es"
          ? "Ocurrió un error inesperado al intentar iniciar sesión. Intente nuevamente en unos instantes."
          : "Ocorreu um erro inesperado ao tentar iniciar sessão. Tente novamente em alguns instantes.";

      if (!isMountedRef.current) {
        return;
      }

      setError(unexpectedMessage);

      emitUiEvent({
        eventName: "AUTH_LOGIN_UI_NETWORK_OR_RUNTIME_ERROR",
        lang,
        clientApp,
        tenantHint,
        returnTo,
        success: false,
        detail:
          err instanceof Error
            ? err.message
            : "unexpected_unknown_runtime_error",
      });
    } finally {
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent opacity-90" />

      <div className="mx-auto grid min-h-screen max-w-7xl px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-10">
        <div className="flex items-center py-10">
          <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur">
            <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

            <div className="space-y-8 p-8 lg:p-10">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    PROCEIT Auth
                  </span>

                  <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    Multi-tenant
                  </span>

                  <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                    Control Tower Ready
                  </span>

                  {clientApp ? (
                    <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
                      {clientApp}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
                    {lang === "es"
                      ? "Acceso premium a la autoridad central del ecosistema"
                      : "Acesso premium à autoridade central do ecossistema"}
                  </h1>

                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setLang("es")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        lang === "es"
                          ? "bg-white/10 text-white"
                          : "text-white/55 hover:text-white"
                      }`}
                      aria-pressed={lang === "es"}
                    >
                      ES
                    </button>

                    <button
                      type="button"
                      onClick={() => setLang("pt")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        lang === "pt"
                          ? "bg-white/10 text-white"
                          : "text-white/55 hover:text-white"
                      }`}
                      aria-pressed={lang === "pt"}
                    >
                      PT
                    </button>
                  </div>
                </div>

                <p className="max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                  {lang === "es"
                    ? "Ingrese con su documento y contraseña para habilitar identidad real, sesión unificada, resolución de tenant, trazabilidad operativa y acceso autorizado a múltiples productos y subdominios del ecosistema PROCEIT."
                    : "Entre com seu documento e senha para habilitar identidade real, sessão unificada, resolução de tenant, rastreabilidade operacional e acesso autorizado a múltiplos produtos e subdomínios do ecossistema PROCEIT."}
                </p>
              </div>

              {returnTo || clientApp || tenantHint ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                      {lang === "es" ? "Producto destino" : "Produto de destino"}
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {clientApp ||
                        (lang === "es" ? "No informado" : "Não informado")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                      {lang === "es" ? "Tenant sugerido" : "Tenant sugerido"}
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {tenantHint ||
                        (lang === "es" ? "Sin preferencia" : "Sem preferência")}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                      {lang === "es" ? "Retorno autorizado" : "Retorno autorizado"}
                    </div>
                    <div className="mt-2 truncate text-sm font-medium text-white">
                      {returnTo ||
                        (lang === "es"
                          ? "Aplicación interna"
                          : "Aplicação interna")}
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <FieldHint
                  tone="error"
                  id={formErrorId}
                  ariaLive="assertive"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>{error}</div>
                  </div>
                </FieldHint>
              ) : null}

              {successMessage ? (
                <FieldHint
                  tone="success"
                  id={formSuccessId}
                  ariaLive="polite"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>{successMessage}</div>
                  </div>
                </FieldHint>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor={documentInputId}
                    className="text-[11px] uppercase tracking-[0.2em] text-white/45"
                  >
                    {lang === "es" ? "Documento" : "Documento"}
                  </label>

                  <input
                    id={documentInputId}
                    name="document"
                    autoComplete="username"
                    inputMode="text"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    onBlur={() => setDocumentTouched(true)}
                    placeholder={
                      lang === "es"
                        ? "Ingrese su documento"
                        : "Informe seu documento"
                    }
                    aria-invalid={Boolean(documentError)}
                    aria-describedby={
                      documentError ? documentErrorId : documentHelpId
                    }
                    className={[
                      "w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25",
                      documentError
                        ? "border-red-400/30 focus:border-red-400/40"
                        : "border-white/10 focus:border-white/20 focus:bg-white/[0.07]",
                    ].join(" ")}
                  />

                  {documentError ? (
                    <p id={documentErrorId} className="text-sm text-red-200">
                      {documentError}
                    </p>
                  ) : (
                    <p
                      id={documentHelpId}
                      className="text-xs leading-6 text-white/42"
                    >
                      {lang === "es"
                        ? "La autenticación utiliza documento como identificador primario dentro de la autoridad central."
                        : "A autenticação utiliza documento como identificador primário dentro da autoridade central."}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor={passwordInputId}
                    className="text-[11px] uppercase tracking-[0.2em] text-white/45"
                  >
                    {lang === "es" ? "Contraseña" : "Senha"}
                  </label>

                  <input
                    id={passwordInputId}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder={
                      lang === "es"
                        ? "Ingrese su contraseña"
                        : "Informe sua senha"
                    }
                    aria-invalid={Boolean(passwordError)}
                    aria-describedby={
                      passwordError ? passwordErrorId : passwordHelpId
                    }
                    className={[
                      "w-full rounded-2xl border bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/25",
                      passwordError
                        ? "border-red-400/30 focus:border-red-400/40"
                        : "border-white/10 focus:border-white/20 focus:bg-white/[0.07]",
                    ].join(" ")}
                  />

                  {passwordError ? (
                    <p id={passwordErrorId} className="text-sm text-red-200">
                      {passwordError}
                    </p>
                  ) : (
                    <p
                      id={passwordHelpId}
                      className="text-xs leading-6 text-white/42"
                    >
                      {lang === "es"
                        ? "La sesión será emitida por la autoridad central y consumida por los productos autorizados del ecosistema."
                        : "A sessão será emitida pela autoridade central e consumida pelos produtos autorizados do ecossistema."}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <FieldHint>
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-white/72" />
                      <div>
                        <div className="font-medium text-white/82">
                          {lang === "es"
                            ? "Sesión real con autoridad central"
                            : "Sessão real com autoridade central"}
                        </div>
                        <div className="mt-1">
                          {lang === "es"
                            ? "El acceso ya no depende de simulación client-side. La resolución ocurre en runtime server-side y base de datos."
                            : "O acesso já não depende de simulação client-side. A resolução ocorre em runtime server-side e banco de dados."}
                        </div>
                      </div>
                    </div>
                  </FieldHint>

                  <FieldHint>
                    <div className="flex items-start gap-3">
                      <Network className="mt-0.5 h-4 w-4 shrink-0 text-white/72" />
                      <div>
                        <div className="font-medium text-white/82">
                          {lang === "es"
                            ? "Preparado para múltiples productos"
                            : "Preparado para múltiplos produtos"}
                        </div>
                        <div className="mt-1">
                          {lang === "es"
                            ? "Este acceso puede devolver al usuario al producto consumidor correcto según el contexto autorizado."
                            : "Este acesso pode devolver o usuário ao produto consumidor correto de acordo com o contexto autorizado."}
                        </div>
                      </div>
                    </div>
                  </FieldHint>
                </div>

                <button
                  type="submit"
                  disabled={submitting || formIsInvalid}
                  aria-disabled={submitting || formIsInvalid}
                  aria-describedby={error ? formErrorId : undefined}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        {lang === "es"
                          ? "Validando acceso ejecutivo..."
                          : "Validando acesso executivo..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {lang === "es"
                          ? "Ingresar al entorno protegido"
                          : "Entrar no ambiente protegido"}
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="flex items-center py-10">
          <div className="grid w-full gap-4">
            <CapabilityCard
              icon={<ShieldCheck className="h-5 w-5 text-white/80" />}
              eyebrow={
                lang === "es"
                  ? "Gobierno de acceso"
                  : "Governança de acesso"
              }
              title={
                lang === "es"
                  ? "Identidad real, sesión real, control real"
                  : "Identidade real, sessão real, controle real"
              }
              description={
                lang === "es"
                  ? "La autenticación ya no depende de simulación de frontend. La identidad, la sesión, la resolución de tenant y el contexto operativo se definen en la capa correcta: Postgres + runtime server-side + autoridad central."
                  : "A autenticação já não depende de simulação de frontend. A identidade, a sessão, a resolução de tenant e o contexto operacional são definidos na camada correta: Postgres + runtime server-side + autoridade central."
              }
            />

            <div className="grid gap-4 md:grid-cols-2">
              <SignalCard
                icon={<RadioTower className="h-5 w-5 text-white/80" />}
                title="Control Tower"
                description={
                  lang === "es"
                    ? "Base preparada para eventos estructurados, incidentes, jobs, health checks y trazabilidad operativa transversal."
                    : "Base preparada para eventos estruturados, incidentes, jobs, health checks e rastreabilidade operacional transversal."
                }
              />

              <SignalCard
                icon={<Building2 className="h-5 w-5 text-white/80" />}
                title="Multi-tenant"
                description={
                  lang === "es"
                    ? "Cada sesión puede operar con múltiples entornos y productos sin romper gobierno, seguridad ni consistencia operativa."
                    : "Cada sessão pode operar com múltiplos ambientes e produtos sem romper governança, segurança nem consistência operacional."
                }
              />
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
              <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

              <div className="grid gap-4 p-6 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                    {lang === "es" ? "Authority" : "Authority"}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">
                    auth.proceit.net
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "Emite identidad, sesión y contexto inicial."
                      : "Emite identidade, sessão e contexto inicial."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                    {lang === "es" ? "Consumers" : "Consumers"}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">
                    app / paynex / signex
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "Consumen la sesión autorizada y resuelven módulos, permisos y navegación."
                      : "Consomem a sessão autorizada e resolvem módulos, permissões e navegação."}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                    {lang === "es" ? "Observabilidad" : "Observabilidade"}
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">
                    Control Tower
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    {lang === "es"
                      ? "Auditoría, trazabilidad y señales operativas listas para consolidación."
                      : "Auditoria, rastreabilidade e sinais operacionais prontas para consolidação."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                {lang === "es"
                  ? "Mensaje institucional"
                  : "Mensagem institucional"}
              </div>

              <p className="mt-4 text-sm leading-7 text-white/62">
                {lang === "es"
                  ? "Este punto de acceso fue concebido como autoridad central del ecosistema PROCEIT. Su función no es solo autenticar, sino establecer identidad unificada, gobierno de acceso, preparación para multi-tenant, interoperabilidad entre subdominios y trazabilidad consistente para operación enterprise."
                  : "Este ponto de acesso foi concebido como autoridade central do ecossistema PROCEIT. Sua função não é apenas autenticar, mas estabelecer identidade unificada, governança de acesso, preparação para multi-tenant, interoperabilidade entre subdomínios e rastreabilidade consistente para operação enterprise."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}