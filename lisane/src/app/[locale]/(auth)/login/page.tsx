import { AuthForm } from "@/components/auth/auth-form";
import { isGoogleAuthEnabled } from "@/lib/auth";

export default function LoginPage() {
  return <AuthForm mode="login" googleEnabled={isGoogleAuthEnabled()} />;
}
