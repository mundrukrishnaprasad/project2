"use server";

import { revalidatePath } from "next/cache";
import { addMessage } from "@/lib/db";

export async function createMessage(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!name || !body) {
    return;
  }
  if (name.length > 80 || body.length > 500) {
    return;
  }

  await addMessage(name, body);
  revalidatePath("/");
}
