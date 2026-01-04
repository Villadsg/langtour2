import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Send rating notification email
export const sendRatingNotificationEmail = action({
  args: {
    email: v.string(),
    tourId: v.id("tours"),
    userName: v.string(),
  },
  handler: async (ctx, { email, tourId, userName }) => {
    // Get tour details
    const tour = await ctx.runQuery(api.tours.getTour, { tourId });
    if (!tour) throw new Error("Tour not found");

    const tourName = tour.description?.name || "this tour";
    const siteUrl = process.env.CONVEX_SITE_URL || "http://localhost:5173";
    const ratingUrl = `${siteUrl}/tours/${tourId}/rate`;

    // Check if RESEND_API_KEY is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email send");
      console.log(`Would send email to: ${email}`);
      console.log(`Subject: Rate your experience on ${tourName}`);
      return { success: true, skipped: true };
    }

    // Send email using Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LangTour <noreply@langtour.com>",
        to: email,
        subject: `Rate your experience on ${tourName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Thank you for participating in ${tourName}!</h2>
            <p>Hello ${userName},</p>
            <p>We hope you enjoyed your tour experience. Your feedback is valuable to us and helps improve future tours.</p>
            <p>Please take a moment to rate your experience:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${ratingUrl}" style="background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Rate This Tour
              </a>
            </div>
            <p>You'll be able to rate the tour on three dimensions:</p>
            <ul>
              <li>Language Learning</li>
              <li>Informative Content</li>
              <li>Fun Factor</li>
            </ul>
            <p>You can also leave optional comments about your experience.</p>
            <p>Thank you for your participation!</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }

    // Save notification record
    await ctx.runMutation(api.notifications.saveNotification, {
      tourId,
      email,
    });

    return { success: true };
  },
});
