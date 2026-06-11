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
  // Descripción corta para los tiles del panel de inicio. Si falta, el panel
  // pinta "Próximamente" y desactiva el enlace.
  description?: string;
};

// Navegación lateral del panel + tiles de "Accesos rápidos" en /. Cada item
// con `description` se renderiza como tile activo (link al módulo).
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  {
    href: "/crm",
    label: "CRM de ventas",
    icon: ClipboardList,
    roles: ["ceo", "head_coach", "setter", "closer"],
    description: "Leads, llamadas y conversiones del setter al closer.",
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Users,
    roles: ["ceo", "head_coach", "nutricionista"],
    description: "Ficha, plan nutricional, evolución y check-ins.",
  },
  {
    href: "/biblioteca",
    label: "Biblioteca",
    icon: Library,
    roles: ["ceo", "head_coach", "nutricionista"],
    description: "Alimentos, recetas, vídeos y briefs IA.",
  },
  {
    href: "/contenido",
    label: "Contenido",
    icon: Megaphone,
    roles: ["ceo", "head_coach"],
    description: "Planificación de contenido semanal y métricas.",
  },
  {
    href: "/finanzas",
    label: "Cuadro de mandos",
    icon: Wallet,
    roles: ["ceo"],
    description: "Ingresos, gastos, beneficios y objetivos del negocio.",
  },
  {
    href: "/comunidad",
    label: "Comunidad",
    icon: MessagesSquare,
    roles: ["ceo", "head_coach", "nutricionista", "setter", "closer"],
    description: "Muro del equipo y cursos para atletas.",
  },
  {
    href: "/tareas",
    label: "Tareas",
    icon: CheckSquare,
    roles: ["ceo", "head_coach"],
    description: "Checklist semanal del equipo y tareas puntuales.",
  },
  {
    href: "/reuniones",
    label: "Reuniones",
    icon: CalendarDays,
    roles: ["ceo", "head_coach", "nutricionista", "setter", "closer"],
    description: "Actas y notas de las reuniones del equipo.",
  },
  {
    href: "/equipo",
    label: "Equipo",
    icon: UserCog,
    roles: ["ceo", "head_coach"],
    description: "Miembros del equipo, roles y acceso.",
  },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role as Role));
}
