import { Card } from "@/components/ui";
import { MegaphoneIcon, StoreIcon } from "@/components/icons";
import { getReadyStore, isDemoMode } from "@/lib/store";
import { isAuthConfigured } from "@/lib/supabase-auth";
import { GoogleButton } from "@/components/GoogleButton";
import { isGoogleAuthEnabled } from "@/lib/supabase-auth";
import { loginAs } from "../actions";
import { RegisterForm } from "./RegisterForm";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const store = await getReadyStore();
  const demo = isDemoMode();
  const withPassword = isAuthConfigured();
  const withGoogle = isGoogleAuthEnabled();
  // Never list real accounts: the list is what makes passwordless sign-in work
  const users = demo ? await store.listUsers() : [];

  return (
    <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
      <Card>
        <h1 className="font-display text-4xl leading-none">
          {demo ? "כניסה מהירה" : "כניסה"}
        </h1>
        <p className="mt-2 text-sm font-light text-mut">
          {withPassword
            ? "היכנסו עם האימייל והסיסמה שלכם."
            : demo
              ? "היכנסו כאחת מדמויות הדמו כדי לראות את שני הצדדים של הפלטפורמה."
              : "כניסה עם סיסמה תיפתח בקרוב. כניסת הדמו סגורה כשמחוברים נתונים אמיתיים."}
        </p>
        {withGoogle ? (
          <div className="mt-4">
            <GoogleButton label="כניסה עם Google" />
            <p className="mt-3 flex items-center gap-2 text-xs text-mut">
              <span className="h-px flex-1 bg-ink/15" />
              או עם אימייל
              <span className="h-px flex-1 bg-ink/15" />
            </p>
          </div>
        ) : null}
        {withPassword ? (
          <div className="mt-4">
            <SignInForm />
          </div>
        ) : null}
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
        <h2 className="font-display text-4xl leading-none">הרשמה חדשה</h2>
        <p className="mt-2 text-sm font-light text-mut">
          {withPassword
            ? "פתיחת חשבון לוקחת דקה. בוחרים תפקיד, ומתחילים."
            : "בדמו אין סיסמה — בגרסת הפרודקשן זה יוחלף ב-Supabase Auth."}
        </p>
        {withGoogle ? (
          <div className="mt-4">
            <GoogleButton label="הרשמה עם Google" />
            <p className="mt-3 flex items-center gap-2 text-xs text-mut">
              <span className="h-px flex-1 bg-ink/15" />
              או במילוי הפרטים
              <span className="h-px flex-1 bg-ink/15" />
            </p>
          </div>
        ) : null}
        <div className="mt-4">
          <RegisterForm withPassword={withPassword} />
        </div>
      </Card>
    </div>
  );
}
