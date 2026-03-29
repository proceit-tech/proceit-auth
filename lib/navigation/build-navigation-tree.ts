export type NavigationSourceItem = {
  code: string;
  parentCode: string | null;
  moduleCode: string | null;
  labelEs: string;
  labelPt: string;
  href: string | null;
  icon: string | null;
  itemType: "section" | "group" | "item";
  sortOrder: number;
  metadata: Record<string, unknown> | null;
};

export type NavigationTreeItem = NavigationSourceItem & {
  children: NavigationTreeItem[];
};

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSortOrder(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value;
}

function toNavigationTreeItem(
  item: NavigationSourceItem
): NavigationTreeItem | null {
  const code = normalizeString(item?.code);
  const parentCode = normalizeString(item?.parentCode);
  const moduleCode = normalizeString(item?.moduleCode);
  const labelEs = normalizeString(item?.labelEs) ?? "";
  const labelPt = normalizeString(item?.labelPt) ?? "";
  const href = normalizeString(item?.href);
  const icon = normalizeString(item?.icon);

  if (!code) {
    return null;
  }

  return {
    code,
    parentCode,
    moduleCode,
    labelEs,
    labelPt,
    href,
    icon,
    itemType: item.itemType,
    sortOrder: normalizeSortOrder(item.sortOrder),
    metadata: item.metadata ?? null,
    children: [],
  };
}

function compareNavigationItems(
  a: NavigationTreeItem,
  b: NavigationTreeItem
): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.code.localeCompare(b.code);
}

function sortTree(nodes: NavigationTreeItem[]): void {
  nodes.sort(compareNavigationItems);

  for (const node of nodes) {
    if (node.children.length > 0) {
      sortTree(node.children);
    }
  }
}

function wouldCreateCycle(params: {
  itemCode: string;
  parentCode: string | null;
  itemMap: Map<string, NavigationTreeItem>;
}): boolean {
  const { itemCode, parentCode, itemMap } = params;

  if (!parentCode) {
    return false;
  }

  let currentCode: string | null = parentCode;
  const visited = new Set<string>();

  while (currentCode) {
    if (currentCode === itemCode) {
      return true;
    }

    if (visited.has(currentCode)) {
      return true;
    }

    visited.add(currentCode);

    const current = itemMap.get(currentCode);
    currentCode = current?.parentCode ?? null;
  }

  return false;
}

/**
 * Política oficial atual:
 * - item sem code utilizável é descartado;
 * - code duplicado: o primeiro item vence;
 * - self-parent vira root;
 * - parent inexistente vira root;
 * - ciclo indireto é bloqueado e o item vira root;
 * - ordenação final por sortOrder e code.
 */
export function buildNavigationTree(
  items: NavigationSourceItem[]
): NavigationTreeItem[] {
  const itemMap = new Map<string, NavigationTreeItem>();
  const roots: NavigationTreeItem[] = [];

  for (const item of items) {
    const normalizedItem = toNavigationTreeItem(item);

    if (!normalizedItem) {
      continue;
    }

    if (itemMap.has(normalizedItem.code)) {
      continue;
    }

    itemMap.set(normalizedItem.code, normalizedItem);
  }

  for (const item of itemMap.values()) {
    const isSelfParent = item.parentCode === item.code;

    if (
      item.parentCode &&
      !isSelfParent &&
      !wouldCreateCycle({
        itemCode: item.code,
        parentCode: item.parentCode,
        itemMap,
      })
    ) {
      const parent = itemMap.get(item.parentCode);

      if (parent) {
        parent.children.push(item);
        continue;
      }
    }

    roots.push(item);
  }

  sortTree(roots);

  return roots;
}