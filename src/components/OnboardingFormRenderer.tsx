// Renderer del formulario de onboarding del atleta a partir de la config
// dinámica. Componente server-side (sin JS innecesario), recibe la config
// resuelta y devuelve los <input>s con los `name`s correctos.

import { Field, SectionTitle, Select, TextArea, TextInput } from "@/components/form-ui";
import {
  CORE_SELECT_OPTIONS,
  isCustomField,
  type OnboardingField,
  type OnboardingFormConfigShape,
} from "@/lib/onboarding-form";

function FieldRender({ f }: { f: OnboardingField }) {
  if (f.hidden) return null;
  const name = f.id;

  // Para selects core, traemos las opciones predefinidas. Para selects
  // personalizados, usamos las que el editor haya definido.
  const options =
    f.type === "select"
      ? isCustomField(f.id)
        ? f.options ?? []
        : CORE_SELECT_OPTIONS[f.id] ?? f.options ?? []
      : [];

  return (
    <Field label={f.label} htmlFor={name} hint={f.hint ?? undefined}>
      {f.type === "textarea" ? (
        <TextArea id={name} name={name} required={f.required} />
      ) : f.type === "select" ? (
        <Select id={name} name={name} options={options} />
      ) : f.type === "date" ? (
        <TextInput id={name} name={name} type="date" required={f.required} />
      ) : f.type === "number" ? (
        <TextInput id={name} name={name} inputMode="decimal" required={f.required} />
      ) : f.type === "tags" ? (
        <TextInput id={name} name={name} required={f.required} />
      ) : f.type === "checkbox" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" id={name} name={name} className="h-4 w-4" />
          <span>{f.hint ?? "Sí"}</span>
        </label>
      ) : (
        <TextInput id={name} name={name} required={f.required} />
      )}
    </Field>
  );
}

export function OnboardingFormRenderer({ config }: { config: OnboardingFormConfigShape }) {
  return (
    <>
      {config.sections.map((s) => {
        const visible = s.fields.filter((f) => !f.hidden);
        if (visible.length === 0) return null;
        return (
          <section key={s.id}>
            <SectionTitle>{s.title}</SectionTitle>
            {s.description ? (
              <p className="-mt-2 mb-3 text-xs text-muted">{s.description}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visible.map((f) => (
                <FieldRender key={f.id} f={f} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
