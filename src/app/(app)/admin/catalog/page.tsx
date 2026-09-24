import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { CatalogAdmin } from "./CatalogAdmin";

export const metadata: Metadata = { title: "Catalogue" };

export default async function CatalogPage() {
  await requirePageUser(["ADMIN"], "/admin/catalog");
  return <CatalogAdmin />;
}
