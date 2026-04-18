"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addCards, createDeck, deleteCard, deleteDeck, updateCard } from "@/lib/db";
import { clearSession, createSession, createUser, requireUser, verifyUser } from "@/lib/auth";
import { parseCards } from "@/lib/import";

export async function signUpAction(formData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const userId = await createUser({ username, password });

  await createSession(userId);
  revalidatePath("/");
  redirect("/");
}

export async function loginAction(formData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const user = await verifyUser({ username, password });

  if (!user) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  revalidatePath("/");
  redirect("/");
}

export async function logoutAction() {
  await clearSession();
  revalidatePath("/");
  redirect("/login");
}

export async function createDeckAction(formData) {
  const user = await requireUser();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!title) {
    throw new Error("Deck title is required");
  }

  const deckId = await createDeck({ title, description, userId: user.id });
  const pasted = String(formData.get("cards") || "").trim();
  const csvFile = formData.get("csvFile");
  if (pasted) {
    await addCards(deckId, parseCards(pasted), user.id);
  }
  if (csvFile && csvFile.size > 0) {
    await addCards(deckId, parseCards(await csvFile.text(), "csv"), user.id);
  }

  revalidatePath("/");
  redirect(`/decks/${deckId}`);
}

export async function addCardAction(formData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId"));
  const term = String(formData.get("term") || "").trim();
  const definition = String(formData.get("definition") || "").trim();

  await addCards(deckId, [{ term, definition }], user.id);
  revalidatePath(`/decks/${deckId}`);
}

export async function importCardsAction(formData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId"));
  const raw = String(formData.get("cards") || "");
  const format = String(formData.get("format") || "auto");
  const csvFile = formData.get("csvFile");
  const cards = parseCards(raw, format);

  await addCards(deckId, cards, user.id);
  if (csvFile && csvFile.size > 0) {
    await addCards(deckId, parseCards(await csvFile.text(), "csv"), user.id);
  }
  revalidatePath(`/decks/${deckId}`);
}

export async function updateCardAction(formData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId"));
  const cardId = String(formData.get("cardId"));
  const term = String(formData.get("term") || "").trim();
  const definition = String(formData.get("definition") || "").trim();

  await updateCard({ cardId, deckId, term, definition, userId: user.id });
  revalidatePath(`/decks/${deckId}`);
}

export async function deleteCardAction(formData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId"));
  const cardId = String(formData.get("cardId"));

  await deleteCard({ cardId, deckId, userId: user.id });
  revalidatePath(`/decks/${deckId}`);
}

export async function deleteDeckAction(formData) {
  const user = await requireUser();
  const deckId = String(formData.get("deckId"));
  await deleteDeck(deckId, user.id);
  revalidatePath("/");
  redirect("/");
}
