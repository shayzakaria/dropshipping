import { Card } from "@/components/ui";
import { MegaphoneIcon, StoreIcon } from "@/components/icons";
import { getReadyStore } from "@/lib/store";
import { loginAs } from "../actions";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const store = await getReadyStore();
  const users = await store.listUsers();

  return (
    <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
      <Card>
        <h1 className="font-display text-4xl leading-none">כניסה מהירה</h1>
        <p className="mt-2 text-sm font-light text-mut">
          היכנסו כאחת מדמויות הדמו כדי לראות את שני הצדדים של הפלטפורמה.
        </p>
        <div className="mt-4 space-y-2">
          {users.map((u) => (
            <form key={u.id} action={loginAs.bind(null, u.id)}>
              <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/30 bg-label px-4 py-2.5 text-sm font-semibold transition hover:bg-paper">
                <span className="flex items-center gap-2.5">
                  {u.role === "business" ? (
                    <StoreIcon className="h-4.5 w-4.5 text-deal-deep" />
                  ) : (
                    <MegaphoneIcon className="h-4.5 w-4.5 text-deal-deep" />
                  )}
                  {u.name}
                </span>
                <span className="text-xs font-medium text-mut">
                  {u.role === "business" ? "עסק" : "משפיען"}
                </span>
              </button>
            </form>
          ))}
        </div>
      </Card>
      <Card>
        <h1 className="font-display text-4xl leading-none">הרשמה חדשה</h1>
        <p className="mt-2 text-sm font-light text-mut">
          בדמו אין סיסמה — בגרסת הפרודקשן זה יוחלף ב-Supabase Auth.
        </p>
        <div className="mt-4">
          <RegisterForm />
        </div>
      </Card>
    </div>
  );
}
