import { redirect } from "next/navigation";
import { Card, Shell } from "@/components/Shell";
import { getSession } from "@/lib/data";
import { ProfileForm } from "./ProfileForm";

export default async function WelcomePage() {
  const { userId, profile } = await getSession();
  if (!userId) redirect("/login");
  if (profile) redirect("/");
  return (
    <Shell>
      <div className="flex flex-1 flex-col justify-center gap-8">
        <div>
          <h1 className="display text-3xl">Welcome in</h1>
          <p className="mt-2 text-muted">Pick a name so your friends can find you.</p>
        </div>
        <Card>
          <ProfileForm submitLabel="Start sharing" />
        </Card>
      </div>
    </Shell>
  );
}
