"use client";

import Link from "next/link";
import { useState } from "react";
import { Globe } from "lucide-react";

type Lang = "es" | "pt";

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>("es");

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.10),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.10]" />

      {/* Top accent */}
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_520px]">
          {/* Left */}
          <section className="hidden lg:flex lg:flex-col lg:justify-center">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300 backdrop-blur">
                PROCEIT AUTH
              </div>

              <h1 className="text-5xl font-black leading-[0.95] tracking-[-0.04em] xl:text-7xl">
                {lang === "es" ? "Acceso seguro" : "Acesso seguro"}
                <span className="block text-sky-400">
                  {lang === "es"
                    ? "para operar con control."
                    : "para operar com controle."}
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-white/70 xl:text-lg">
                {lang === "es"
                  ? "Plataforma de autenticación central para los productos PROCEIT. Ingrese con sus credenciales para acceder a tenants, módulos y permisos según su perfil."
                  : "Plataforma de autenticação central para os produtos PROCEIT. Entre com suas credenciais para acessar tenants, módulos e permissões conforme seu perfil."}
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    {lang === "es" ? "Seguridad" : "Segurança"}
                  </div>
                  <div className="mt-3 text-lg font-bold">RBAC</div>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {lang === "es"
                      ? "Accesos por tenant, rol y contexto operativo."
                      : "Acessos por tenant, papel e contexto operacional."}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    {lang === "es" ? "Control" : "Controle"}
                  </div>
                  <div className="mt-3 text-lg font-bold">
                    {lang === "es" ? "Sesión central" : "Sessão central"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {lang === "es"
                      ? "Un único acceso para múltiples sistemas PROCEIT."
                      : "Um único acesso para múltiplos sistemas PROCEIT."}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    {lang === "es" ? "Gobernanza" : "Governança"}
                  </div>
                  <div className="mt-3 text-lg font-bold">
                    {lang === "es" ? "Auditable" : "Auditável"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {lang === "es"
                      ? "Base preparada para monitoreo y trazabilidad."
                      : "Base preparada para monitoramento e rastreabilidade."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right */}
          <section className="relative">
            <div className="absolute -inset-6 rounded-[36px] bg-sky-500/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-sky-400 to-transparent" />

              <div className="p-6 sm:p-8 md:p-10">
                {/* top bar */}
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                      {lang === "es" ? "Acceso a plataforma" : "Acesso à plataforma"}
                    </div>

                    <h2 className="mt-4 text-3xl font-black tracking-[-0.03em]">
                      {lang === "es" ? "Iniciar sesión" : "Entrar"}
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-white/60">
                      {lang === "es"
                        ? "Ingrese su documento o correo y su contraseña para acceder a su entorno de trabajo."
                        : "Informe seu documento ou e-mail e sua senha para acessar seu ambiente de trabalho."}
                    </p>
                  </div>

                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
                    <span className="px-2 text-white/50">
                      <Globe className="h-4 w-4" />
                    </span>

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

                <form className="space-y-5">
                  <div>
                    <label
                      htmlFor="identity"
                      className="mb-2 block text-sm font-semibold text-white/80"
                    >
                      {lang === "es" ? "Documento o correo" : "Documento ou e-mail"}
                    </label>
                    <input
                      id="identity"
                      name="identity"
                      type="text"
                      placeholder={
                        lang === "es"
                          ? "Ej. 00708082017 o magno@proceit.net"
                          : "Ex. 00708082017 ou magno@proceit.net"
                      }
                      className="h-14 w-full rounded-2xl border border-white/10 bg-[#0b1220]/80 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-sky-400/50 focus:bg-[#0b1220] focus:ring-4 focus:ring-sky-400/10"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="password"
                        className="block text-sm font-semibold text-white/80"
                      >
                        {lang === "es" ? "Contraseña" : "Senha"}
                      </label>

                      <Link
                        href="/access/recovery"
                        className="text-xs font-medium text-sky-300 transition hover:text-sky-200"
                      >
                        {lang === "es"
                          ? "¿Olvidó su contraseña?"
                          : "Esqueceu sua senha?"}
                      </Link>
                    </div>

                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={
                        lang === "es"
                          ? "Ingrese su contraseña"
                          : "Informe sua senha"
                      }
                      className="h-14 w-full rounded-2xl border border-white/10 bg-[#0b1220]/80 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-sky-400/50 focus:bg-[#0b1220] focus:ring-4 focus:ring-sky-400/10"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-3 text-sm text-white/65">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-sky-400 focus:ring-sky-400/30"
                      />
                      {lang === "es"
                        ? "Mantener sesión activa"
                        : "Manter sessão ativa"}
                    </label>

                    <span className="text-xs text-white/35">
                      {lang === "es" ? "Entorno protegido" : "Ambiente protegido"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="mt-2 inline-flex h-14 w-full items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/15 px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.15)] transition hover:border-sky-300/40 hover:bg-sky-400/20"
                  >
                    {lang === "es"
                      ? "Entrar a la plataforma"
                      : "Entrar na plataforma"}
                  </button>
                </form>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      Tenant
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/85">
                      {lang === "es" ? "Acceso contextual" : "Acesso contextual"}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      {lang === "es"
                        ? "El sistema identifica su pertenencia y permisos por empresa."
                        : "O sistema identifica seu vínculo e permissões por empresa."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                      Plataforma
                    </div>
                    <div className="mt-2 text-sm font-semibold text-white/85">
                      PROCEIT Identity
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/55">
                      {lang === "es"
                        ? "Base preparada para escalado multi-producto y multi-tenant."
                        : "Base preparada para escala multi-produto e multi-tenant."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}