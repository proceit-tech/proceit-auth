"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Layers3,
  Orbit,
  RadioTower,
  ShieldCheck,
} from "lucide-react";

import type { NavigationTreeItem } from "@/lib/navigation/build-navigation-tree";

type Lang = "pt" | "es";

type Props = {
  lang?: Lang;
  items: NavigationTreeItem[];
};

function getLabel(item: NavigationTreeItem, lang: Lang): string {
  return lang === "es" ? item.labelEs : item.labelPt;
}

function normalizeItems(items: NavigationTreeItem[] | null | undefined): NavigationTreeItem[] {
  return Array.isArray(items) ? items : [];
}

function isPathActive(pathname: string, href: string | null): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hasActiveDescendant(
  pathname: string,
  item: NavigationTreeItem
): boolean {
  if (isPathActive(pathname, item.href)) {
    return true;
  }

  return item.children.some((child) => hasActiveDescendant(pathname, child));
}

function getModuleBadge(item: NavigationTreeItem): string {
  return item.moduleCode || "core";
}

function renderLeafLink(params: {
  item: NavigationTreeItem;
  label: string;
  active: boolean;
  depth?: number;
}) {
  const { item, label, active, depth = 0 } = params;

  return (
    <Link
      href={item.href!}
      className={[
        "group block rounded-2xl transition-all",
        depth === 0 ? "px-5 py-4" : "px-4 py-3",
        active
          ? depth === 0
            ? "bg-white/[0.08] text-white"
            : "bg-[hsl(var(--nav-accent))/0.16] text-white"
          : depth === 0
          ? "text-white/78 hover:bg-white/[0.05] hover:text-white"
          : "text-white/68 hover:bg-white/[0.05] hover:text-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className={[
              depth === 0 ? "text-sm font-semibold tracking-[0.01em]" : "font-medium",
            ].join(" ")}
          >
            {label}
          </div>

          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
            {getModuleBadge(item)}
          </div>
        </div>

        <ChevronRight
          className={`h-4 w-4 shrink-0 transition ${
            active ? "text-sky-300" : "text-white/35 group-hover:text-sky-300"
          }`}
        />
      </div>
    </Link>
  );
}

function renderStaticNode(params: {
  item: NavigationTreeItem;
  label: string;
  lang: Lang;
  depth?: number;
  highlighted?: boolean;
}) {
  const { item, label, lang, depth = 0, highlighted = false } = params;

  return (
    <div
      className={[
        "rounded-2xl border border-white/10",
        depth === 0 ? "px-5 py-4" : "px-4 py-3",
        highlighted ? "bg-white/[0.05] text-white" : "bg-white/[0.03] text-white",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className={depth === 0 ? "text-sm font-semibold tracking-[0.01em]" : "font-medium text-white/80"}>
            {label}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
              {getModuleBadge(item)}
            </span>

            {item.children.length > 0 ? (
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
                {lang === "es" ? "Grupo" : "Grupo"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65">
          <Orbit className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function NavigationNode({
  item,
  lang,
  pathname,
  depth = 0,
}: {
  item: NavigationTreeItem;
  lang: Lang;
  pathname: string;
  depth?: number;
}) {
  const label = getLabel(item, lang);
  const selfActive = isPathActive(pathname, item.href);
  const treeActive = hasActiveDescendant(pathname, item);
  const hasChildren = item.children.length > 0;

  if (!hasChildren) {
    if (item.href) {
      return renderLeafLink({
        item,
        label,
        active: selfActive,
        depth,
      });
    }

    return renderStaticNode({
      item,
      label,
      lang,
      depth,
      highlighted: treeActive,
    });
  }

  return (
    <div
      className={[
        "overflow-hidden rounded-3xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.28)]",
        depth === 0 ? "bg-white/[0.035]" : "bg-white/[0.025]",
      ].join(" ")}
    >
      {depth === 0 ? (
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />
      ) : null}

      {item.href ? (
        renderLeafLink({
          item,
          label,
          active: treeActive,
          depth,
        })
      ) : (
        renderStaticNode({
          item,
          label,
          lang,
          depth,
          highlighted: treeActive,
        })
      )}

      <div className={depth === 0 ? "space-y-1 px-3 pb-3" : "space-y-1 px-3 pb-3 pt-1"}>
        {item.children.map((child) => (
          <NavigationNode
            key={child.code}
            item={child}
            lang={lang}
            pathname={pathname}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProtectedSidebar({
  lang = "es",
  items,
}: Props) {
  const pathname = usePathname();
  const normalizedItems = normalizeItems(items);
  const hasItems = normalizedItems.length > 0;

  return (
    <aside className="hidden shrink-0 xl:flex xl:w-[340px]">
      <div className="sticky top-0 flex h-screen w-full flex-col border-r border-white/10 bg-black/35 backdrop-blur-xl">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="mb-4 h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

          <div className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            PROCEIT CONTROLLED RUNTIME
          </div>

          <div className="mt-4 text-[11px] uppercase tracking-[0.28em] text-white/40">
            PROCEIT
          </div>

          <div className="mt-3 text-2xl font-black tracking-[-0.03em] text-white">
            {lang === "es" ? "Ecosistema Operativo" : "Ecossistema Operacional"}
          </div>

          <p className="mt-3 text-sm leading-6 text-white/58">
            {lang === "es"
              ? "Navegación dinámica resuelta por permisos efectivos, módulos activos y contexto operativo del tenant."
              : "Navegação dinâmica resolvida por permissões efetivas, módulos ativos e contexto operacional do tenant."}
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/38">
                    {lang === "es" ? "Base de acceso" : "Base de acesso"}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {lang === "es" ? "Protegida y contextual" : "Protegida e contextual"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    {lang === "es"
                      ? "La navegación visible ya nace condicionada por runtime, tenant y estructura autorizada."
                      : "A navegação visível já nasce condicionada por runtime, tenant e estrutura autorizada."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {!hasItems ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75">
                <Layers3 className="h-5 w-5" />
              </div>

              <div className="text-base font-semibold text-white">
                {lang === "es" ? "Sin navegación disponible" : "Sem navegação disponível"}
              </div>

              <p className="mt-2 text-sm leading-6 text-white/58">
                {lang === "es"
                  ? "No se encontraron módulos o rutas visibles para el contexto operativo actual."
                  : "Não foram encontrados módulos ou rotas visíveis para o contexto operacional atual."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {normalizedItems.map((item) => (
                <NavigationNode
                  key={item.code}
                  item={item}
                  lang={lang}
                  pathname={pathname}
                />
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75">
                <RadioTower className="h-4 w-4" />
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/38">
                  {lang === "es" ? "Estado del shell" : "Estado do shell"}
                </div>

                <div className="mt-2 text-sm font-medium text-white">
                  {lang === "es"
                    ? "Protegido, dinámico y escalable"
                    : "Protegido, dinâmico e escalável"}
                </div>

                <p className="mt-2 text-sm leading-6 text-white/58">
                  {lang === "es"
                    ? "Base preparada para session center premium, tenant switcher real y consolidación futura del Control Tower."
                    : "Base preparada para session center premium, tenant switcher real e consolidação futura do Control Tower."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}