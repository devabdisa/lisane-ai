import { AuthForm } from "@/components/auth/auth-form";
import { isGoogleAuthEnabled } from "@/lib/auth";

export default function SignupPage() {
  return <AuthForm mode="signup" googleEnabled={isGoogleAuthEnabled()} />;
}
