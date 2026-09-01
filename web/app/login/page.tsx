import { Card, btnGhost } from "@/components/ui";
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
        <h1 className="text-lg font-bold">כניסה מהירה — משתמשי דמו</h1>
        <p className="mt-1 text-sm font-light text-slate-400">
          היכנסו כאחת הדמויות כדי לראות את שני הצדדים של הפלטפורמה.
        </p>
        <div className="mt-4 space-y-2">
          {users.map((u) => (
            <form key={u.id} action={loginAs.bind(null, u.id)}>
              <button className={`${btnGhost} w-full !justify-between`}>
                <span>
                  {u.role === "business" ? "🏪" : "📣"} {u.name}
                </span>
                <span className="text-xs text-slate-400">
                  {u.role === "business" ? "עסק" : "משפיען"}
                </span>
              </button>
            </form>
          ))}
        </div>
      </Card>
      <Card>
        <h1 className="text-lg font-bold">הרשמה חדשה</h1>
        <p className="mt-1 text-sm font-light text-slate-400">
          בדמו אין סיסמה — בגרסת הפרודקשן זה יוחלף ב-Supabase Auth.
        </p>
        <div className="mt-4">
          <RegisterForm />
        </div>
      </Card>
    </div>
  );
}
