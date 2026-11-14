import { redirect } from "next/navigation";
import { LegalLinks } from "@/components/Legal";
import { Shell } from "@/components/Shell";
import { Wordmark } from "@/components/globe/Wordmark";
import { getSession } from "@/lib/data";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { userId } = await getSession();
  if (userId) redirect("/");
  const { error } = await searchParams;
  return (
    <Shell>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col items-center text-center">
          <h1>
            <Wordmark size={34} />
          </h1>
          <p className="mt-3 text-[22px] leading-snug" style={{ fontFamily: "var(--font-hand), var(--font-sans)", fontWeight: 700 }}>
            What&apos;s your top track today?
          </p>
        </div>
        <LoginForm initialError={error ? "That sign-in didn't work. Try again." : undefined} />
      </div>
      <LegalLinks />
    </Shell>
  );
}
