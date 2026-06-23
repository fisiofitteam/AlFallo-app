import { Trash2, Apple, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { optionLabel } from "@/lib/clients";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { FoodCreateForm } from "@/components/FoodCreateForm";
import { deleteFood } from "../actions";

export const metadata = { title: "Alimentos · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function AlimentosTab({ searchParams }: { searchParams: { q?: string } }) {
  await requireProfessional();

  const q = (searchParams.q ?? "").trim();
  const foods = await prisma.foodLibrary.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
  });

  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Banco de alimentos con macros por 100 g, reutilizable en los planes.
      </p>

      {/* Alta de alimento (componente cliente para subir foto a Vercel Blob). */}
      <FoodCreateForm />

      {/* Buscador */}
      <form className="mb-4">
        <div className="relative max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar alimento…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </form>

      {foods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Apple size={32} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">{q ? "Sin resultados" : "Aún no hay alimentos"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Alimento</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoría</th>
                <th className="px-4 py-3 text-right font-medium">Kcal</th>
                <th className="px-4 py-3 text-right font-medium">P</th>
                <th className="px-4 py-3 text-right font-medium">C</th>
                <th className="px-4 py-3 text-right font-medium">G</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {f.imageUrl ? (
                        <img
                          src={f.imageUrl}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                          <Apple size={16} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-medium">{f.name}</span>
                        {f.brand && <span className="block text-xs text-muted">{f.brand}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {optionLabel(FOOD_CATEGORY_OPTIONS, f.category)}
                  </td>
                  <td className="px-4 py-3 text-right">{Math.round(f.kcalPer100)}</td>
                  <td className="px-4 py-3 text-right text-muted">{f.proteinPer100}</td>
                  <td className="px-4 py-3 text-right text-muted">{f.carbsPer100}</td>
                  <td className="px-4 py-3 text-right text-muted">{f.fatPer100}</td>
                  <td className="px-2 py-3 text-right">
                    <form action={deleteFood}>
                      <input type="hidden" name="id" value={f.id} />
                      <button
                        aria-label={`Borrar ${f.name}`}
                        className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border bg-surface-2 px-4 py-2 text-xs text-muted">
            P = proteína · C = carbohidratos · G = grasa (g por 100 g)
          </p>
        </div>
      )}
    </>
  );
}
