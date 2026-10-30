import { redirect } from "next/navigation";
import { LegalLinks } from "@/components/Legal";
import { Shell } from "@/components/Shell";
import { getSession } from "@/lib/data";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { userId } = await getSession();
  if (userId) redirect("/");
  const { error } = await searchParams;
  return (
    <Shell>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div>
          <h1 className="display text-4xl">Fingerpick</h1>
          <p className="mt-2 text-muted">One song a day. The one that hit hardest.</p>
        </div>
        <LoginForm initialError={error ? "That sign-in didn't work. Try again." : undefined} />
      </div>
      <LegalLinks />
    </Shell>
  );
}
