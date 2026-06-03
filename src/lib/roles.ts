import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Library,
  Megaphone,
  Wallet,
  MessagesSquare,
  UserCog,
  CheckSquare,
  CalendarDays,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Roles del equipo. El modelo Professional guarda el rol como String;
// estos son los valores válidos (el rol "cliente" tendrá su propio modelo).
export const ROLES = {
  ceo: "ceo",
  head_coach: "head_coach",
  nutricionista: "nutricionista",
  setter: "setter",
  closer: "closer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  ceo: "Dirección",
  head_coach: "Head Coach",
  nutricionista: "Nutricionista",
  setter: "Setter",
  closer: "Closer",
};

// Managers ven todo y ciertas métricas sensibles.
export function isManager(role: string): boolean {
  return role === ROLES.ceo || role === ROLES.head_coach;
}

export function isValidRole(role: string): role is Role {
  return (ALL_ROLES as string[]).includes(role);
}

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Roles que pueden ver el item. Si se omite, lo ven todos.
  roles?: Role[];
};

// Navegación lateral del panel. En Fase 1 los destinos son placeholders.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/crm", label: "CRM de ventas", icon: ClipboardList, roles: ["ceo", "head_coach", "setter", "closer"] },
  { href: "/clientes", label: "Clientes", icon: Users, roles: ["ceo", "head_coach", "nutricionista"] },
  { href: "/biblioteca", label: "Biblioteca", icon: Library, roles: ["ceo", "head_coach", "nutricionista"] },
  { href: "/contenido", label: "Contenido", icon: Megaphone, roles: ["ceo", "head_coach"] },
  { href: "/finanzas", label: "Cuadro de mandos", icon: Wallet, roles: ["ceo"] },
  { href: "/comunidad", label: "Comunidad", icon: MessagesSquare, roles: ["ceo", "head_coach", "nutricionista", "setter", "closer"] },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, roles: ["ceo", "head_coach"] },
  { href: "/reuniones", label: "Reuniones", icon: CalendarDays, roles: ["ceo", "head_coach"] },
  { href: "/equipo", label: "Equipo", icon: UserCog, roles: ["ceo", "head_coach"] },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role as Role));
}
