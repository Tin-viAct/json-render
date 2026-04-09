import { Header } from "@/components/header";
import { getStarCount } from "@/lib/github";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const stars = await getStarCount();

  return (
    <div className="min-h-screen flex flex-col">
      <Header stars={stars} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
