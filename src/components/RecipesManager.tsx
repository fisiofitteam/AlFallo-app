"use client";

import { useState } from "react";
import { Plus, X, Pencil, Trash2, ChefHat, ChevronDown } from "lucide-react";
import { createRecipe, updateRecipe, deleteRecipe } from "@/app/(panel)/biblioteca/recetas/actions";
import { ImageUpload } from "@/components/ImageUpload";

// Tipos de receta seleccionables por el nutri en /biblioteca/recetas.
// "snack" (sin sufijo) sigue siendo válido por compatibilidad con recetas
// antiguas — se mostrará bajo "Snack" en mealTypeLabel. Las nuevas se
// clasifican como snack_dulce o snack_salado.
export const MEAL_TYPES = [
  { value: "", label: "Sin tipo" },
  { value: "desayuno", label: "🌅 Desayuno" },
  { value: "comida", label: "🍽 Comida" },
  { value: "cena", label: "🌙 Cena" },
  { value: "snack_dulce", label: "🍪 Snack dulce" },
  { value: "snack_salado", label: "🥨 Snack salado" },
  { value: "postre", label: "🍰 Postre" },
];

export function mealTypeLabel(value: string | null): string {
  if (value === "snack") return "🥨 Snack"; // legacy
  return MEAL_TYPES.find((m) => m.value === (value ?? ""))?.label ?? "Sin tipo";
}

export type RecipeItem = {
  id: string;
  title: string;
  description: string | null;
  mealType: string | null;
  ingredients: string;
  instructions: string;
  imageUrl: string | null;
  authorName: string | null;
  createdAt: string;
};

export function RecipesManager({ recipes }: { recipes: RecipeItem[] }) {
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Agrupamos por tipo de comida. "Sin tipo" cae en un grupo al final.
  // Para retro-compatibilidad: las recetas con mealType="snack" (sin
  // sufijo, creadas antes del split) entran dentro del grupo "Snack salado".
  const grouped = MEAL_TYPES.map((mt) => ({
    type: mt,
    items: recipes.filter((r) => {
      const t = r.mealType ?? "";
      if (mt.value === "snack_salado" && t === "snack") return true;
      return t === mt.value;
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {recipes.length} {recipes.length === 1 ? "receta guardada" : "recetas guardadas"}
        </p>
        <button
          type="button"
          onClick={() => {
            setShowNew((v) => !v);
            setEditingId(null);
          }}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          {showNew ? <X size={13} /> : <Plus size={13} />}
          {showNew ? "Cerrar" : "Nueva receta"}
        </button>
      </div>

      {showNew ? <NewRecipeForm onDone={() => setShowNew(false)} /> : null}

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <ChefHat size={32} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">Aún no hay recetas</p>
          <p className="mt-1 text-sm text-muted">Pulsa "Nueva receta" para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            // <details> nativo por tipo. Las recetas internas (RecipeCard)
            // ya son otro <details>; el anidamiento funciona sin problemas.
            // Cerrados por defecto: el nutri suele saber qué grupo busca.
            <details
              key={g.type.value}
              className="group/section overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 p-4 transition hover:bg-bg/40">
                <ChevronDown
                  size={16}
                  className="flex-shrink-0 text-muted transition group-open/section:rotate-180"
                />
                <span className="flex-1 text-base font-bold">{g.type.label}</span>
                <span className="text-xs text-muted">{g.items.length}</span>
              </summary>
              <ul className="space-y-2 border-t border-border p-3">
                {g.items.map((r) =>
                  editingId === r.id ? (
                    <li key={r.id}>
                      <EditRecipeForm recipe={r} onDone={() => setEditingId(null)} />
                    </li>
                  ) : (
                    <RecipeCard
                      key={r.id}
                      recipe={r}
                      onEdit={() => setEditingId(r.id)}
                    />
                  ),
                )}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onEdit }: { recipe: RecipeItem; onEdit: () => void }) {
  return (
    <li>
      <details className="group overflow-hidden rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none p-4 transition hover:bg-bg/40">
          <div className="flex items-center gap-3">
            <ChevronDown
              size={16}
              className="flex-shrink-0 text-muted transition group-open:rotate-180"
            />
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <ChefHat size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{recipe.title}</p>
              {recipe.description ? (
                <p className="line-clamp-1 text-xs text-muted">{recipe.description}</p>
              ) : null}
            </div>
          </div>
        </summary>
        <div className="border-t border-border p-4">
          {recipe.imageUrl ? (
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="mb-4 max-h-72 w-full rounded-xl border border-border object-cover"
            />
          ) : null}
          {recipe.ingredients.trim() ? (
            <>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
                Ingredientes
              </h4>
              <p className="mb-3 whitespace-pre-wrap text-sm">{recipe.ingredients}</p>
            </>
          ) : null}
          {recipe.instructions.trim() ? (
            <>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
                Preparación
              </h4>
              <p className="whitespace-pre-wrap text-sm">{recipe.instructions}</p>
            </>
          ) : null}
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{recipe.authorName ? `Por ${recipe.authorName}` : null}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary hover:text-text"
              >
                <Pencil size={11} /> Editar
              </button>
              <form action={deleteRecipe}>
                <input type="hidden" name="id" value={recipe.id} />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm(`¿Borrar la receta "${recipe.title}"?`)) e.preventDefault();
                  }}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-red-600 hover:border-red-300"
                >
                  <Trash2 size={11} /> Borrar
                </button>
              </form>
            </div>
          </footer>
        </div>
      </details>
    </li>
  );
}

function NewRecipeForm({ onDone }: { onDone: () => void }) {
  return (
    <form
      action={async (fd) => {
        await createRecipe(fd);
        onDone();
      }}
      className="mb-6 rounded-2xl border border-primary/40 bg-surface p-5"
    >
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Nueva receta</h3>
      <RecipeFields />
      <FormActions onCancel={onDone} submitLabel="Guardar receta" />
    </form>
  );
}

function EditRecipeForm({
  recipe,
  onDone,
}: {
  recipe: RecipeItem;
  onDone: () => void;
}) {
  return (
    <form
      action={async (fd) => {
        await updateRecipe(fd);
        onDone();
      }}
      className="rounded-xl border border-primary/40 bg-surface p-5"
    >
      <input type="hidden" name="id" value={recipe.id} />
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
        Editando receta
      </h3>
      <RecipeFields defaults={recipe} />
      <FormActions onCancel={onDone} submitLabel="Guardar cambios" />
    </form>
  );
}

function RecipeFields({ defaults }: { defaults?: RecipeItem }) {
  // imageUrl es controlado por estado: el subidor llama onChange con la URL
  // pública de Vercel Blob y sincronizamos un hidden input para que viaje
  // como `imageUrl` en el FormData del server action.
  const [imageUrl, setImageUrl] = useState<string>(defaults?.imageUrl ?? "");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input
        name="title"
        required
        defaultValue={defaults?.title ?? ""}
        placeholder="Título (ej. Tortilla francesa con avena)"
        className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <select
        name="mealType"
        defaultValue={defaults?.mealType ?? ""}
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {MEAL_TYPES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <input
        name="description"
        defaultValue={defaults?.description ?? ""}
        placeholder="Resumen breve (opcional)"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Foto del plato
        </label>
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          label="Subir foto"
          hint="Una buena foto vende la receta. JPG/PNG/WebP."
        />
      </div>
      <textarea
        name="ingredients"
        rows={4}
        defaultValue={defaults?.ingredients ?? ""}
        placeholder="Ingredientes (una línea por item, '- ' para bullet)"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        name="instructions"
        rows={4}
        defaultValue={defaults?.instructions ?? ""}
        placeholder="Preparación (paso a paso)"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function FormActions({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-text"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {submitLabel}
      </button>
    </div>
  );
}
