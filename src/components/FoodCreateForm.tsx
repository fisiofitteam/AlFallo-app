"use client";

import { useState } from "react";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { Field, Select, TextInput } from "@/components/form-ui";
import { ImageUpload } from "@/components/ImageUpload";
import { createFood } from "@/app/(panel)/biblioteca/actions";

/**
 * Form de alta de un alimento en el banco. Es cliente porque la subida de
 * imagen necesita estado controlado para el ImageUpload + hidden input
 * sincronizado que viaja al server action.
 *
 * Tras el submit, el `action` del form llama a createFood (server action)
 * y la página recarga via revalidatePath dentro de la action.
 */
export function FoodCreateForm() {
  const [imageUrl, setImageUrl] = useState<string>("");

  return (
    <form
      action={async (fd) => {
        await createFood(fd);
        // Limpiar el preview después de crear: el form se resetea solo,
        // pero el state de imageUrl no.
        setImageUrl("");
      }}
      className="mb-8 rounded-2xl border border-border bg-surface p-5"
    >
      <h2 className="mb-4 font-semibold">Añadir alimento</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre" htmlFor="name">
          <TextInput id="name" name="name" required placeholder="Pechuga de pollo" />
        </Field>
        <Field label="Marca / supermercado" htmlFor="brand">
          <TextInput id="brand" name="brand" placeholder="Opcional" />
        </Field>
        <Field label="Categoría" htmlFor="category">
          <Select id="category" name="category" options={FOOD_CATEGORY_OPTIONS} />
        </Field>
        <Field label="Kcal / 100 g" htmlFor="kcalPer100">
          <TextInput id="kcalPer100" name="kcalPer100" inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Proteína / 100 g" htmlFor="proteinPer100">
          <TextInput id="proteinPer100" name="proteinPer100" inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Carbos / 100 g" htmlFor="carbsPer100">
          <TextInput id="carbsPer100" name="carbsPer100" inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Grasa / 100 g" htmlFor="fatPer100">
          <TextInput id="fatPer100" name="fatPer100" inputMode="decimal" placeholder="0" />
        </Field>
      </div>

      <div className="mt-5">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Foto del alimento (opcional)
        </label>
        {/* Hidden que viaja en el FormData del action. Se sincroniza vía
            estado con el ImageUpload. */}
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <ImageUpload value={imageUrl} onChange={setImageUrl} label="Subir foto" />
      </div>

      <div className="mt-4 flex justify-end">
        <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
          Añadir
        </button>
      </div>
    </form>
  );
}
