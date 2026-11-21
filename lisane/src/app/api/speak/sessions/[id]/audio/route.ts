import { z } from "zod";
import { getAppUser } from "@/lib/require-app-user";
import { sendSpeakAudio } from "@/server/speak/live-session";

const bodySchema = z.object({
  audioBase64: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (!user) {
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_input", message: "Missing audio." } },
      { status: 400 },
    );
  }

  const { id } = await params;
  const accepted = sendSpeakAudio(id, user.id, parsed.data.audioBase64);
  if (!accepted) {
    return Response.json(
      { error: { code: "session_not_found", message: "This speaking session has ended." } },
      { status: 404 },
    );
  }
  return new Response(null, { status: 204 });
}
