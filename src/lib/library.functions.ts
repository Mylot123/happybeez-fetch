import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chunkSchema = z.object({
  section_number: z.number().int(),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(6000),
  page_start: z.number().int().nullable().optional(),
});

const ingestSchema = z.object({
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional(),
  year: z.number().int().optional(),
  chunks: z.array(chunkSchema).min(1).max(2000),
});

export const ingestBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ingestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: book, error: bookErr } = await supabase
      .from("library_books")
      .insert({
        title: data.title,
        author: data.author ?? null,
        year: data.year ?? null,
        description: `Geüpload via Boekbibliotheek (${data.chunks.length} fragmenten)`,
      })
      .select("id")
      .single();
    if (bookErr || !book) {
      throw new Error(bookErr?.message ?? "Kon boek niet aanmaken.");
    }

    // Insert in batches of 200 to keep payloads reasonable
    const rows = data.chunks.map((c) => ({
      book_id: book.id,
      section_number: c.section_number,
      title: c.title.slice(0, 300),
      content: c.content,
      page_start: c.page_start ?? null,
    }));

    for (let i = 0; i < rows.length; i += 200) {
      const slice = rows.slice(i, i + 200);
      const { error } = await supabase.from("library_book_sections").insert(slice);
      if (error) throw new Error(`Fragment ${i} fout: ${error.message}`);
    }

    return { book_id: book.id, inserted: rows.length };
  });
