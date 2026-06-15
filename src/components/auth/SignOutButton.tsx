import { signOut } from "@/lib/auth/actions";
import SubmitButton from "@/components/auth/SubmitButton";

/** Sign-out control — posts to the signOut server action. */
export default function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Signing out…">
        Sign out
      </SubmitButton>
    </form>
  );
}
