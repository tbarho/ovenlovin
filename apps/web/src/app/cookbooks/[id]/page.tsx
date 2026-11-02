import { redirect } from "next/navigation";

/** A cookbook lives on the recipes page; old and hand-typed /cookbooks/:id links land there. */
export default async function CookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/recipes?cookbook=${encodeURIComponent(id)}`);
}
