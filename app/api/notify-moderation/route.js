// Called by SubmissionForm.js right after a pending (non-auto-approved)
// submission is created. Fails silently if not configured or if the
// email send fails - the submission itself already succeeded regardless.
export async function POST() {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!apiKey || !adminEmail) {
    return Response.json({ sent: false, reason: "not configured" });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Resend's shared test domain - works with zero setup. Swap in a
        // verified sswx.space address once that's set up in Resend for a
        // branded from-address.
        from: "Storm Archive <onboarding@resend.dev>",
        to: adminEmail,
        subject: "New chase route pending review",
        text: "A new chase route submission is waiting in the Storm Archive moderation queue.",
      }),
    });
    return Response.json({ sent: res.ok });
  } catch (err) {
    return Response.json({ sent: false, reason: err.message }, { status: 500 });
  }
}
