import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();

const db = admin.firestore();

// Create public profile and user role when a new user signs up
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const batch = db.batch();

  // Create public profile
  const profileRef = db.collection('publicProfiles').doc();
  batch.set(profileRef, {
    userId: user.uid,
    username: user.displayName || user.email?.split('@')[0] || 'user',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Create default user role
  const roleRef = db.collection('userRoles').doc();
  batch.set(roleRef, {
    userId: user.uid,
    role: 'user'
  });

  await batch.commit();
  console.log(`Created profile and role for user ${user.uid}`);
});

// Callable function to send rating notification email
export const sendRatingNotificationEmail = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }

    const { email, tourId, userName } = data;

    if (!email || !tourId) {
      throw new functions.https.HttpsError('invalid-argument', 'Email and tourId are required');
    }

    // Get tour details
    const tourDoc = await db.collection('tours').doc(tourId).get();
    if (!tourDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Tour not found');
    }

    const tourData = tourDoc.data();
    const tourName = tourData?.description?.name || 'this tour';
    const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
    const ratingUrl = `${siteUrl}/tours/${tourId}/rate`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, skipping email');
      return { success: true, skipped: true };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'LangTour <noreply@langtour.com>',
          to: email,
          subject: `Rate your experience on ${tourName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Thanks for joining ${tourName}!</h2>
              <p>Hi ${userName || 'there'},</p>
              <p>We hope you enjoyed your language learning tour. Your feedback helps other learners find great experiences.</p>
              <p>
                <a href="${ratingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
                  Rate Your Experience
                </a>
              </p>
              <p>Thank you for being part of the LangTour community!</p>
            </div>
          `
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send email:', errorText);
        throw new functions.https.HttpsError('internal', 'Failed to send email');
      }

      // Save notification record
      await db.collection('notifications').add({
        tourId,
        email,
        createdAt: Date.now()
      });

      console.log(`Rating notification email sent to ${email} for tour ${tourId}`);
      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send email');
    }
  }
);

// Firestore trigger: Cascading delete when a tour is deleted
export const onTourDelete = functions.firestore
  .document('tours/{tourId}')
  .onDelete(async (snap, context) => {
    const tourId = context.params.tourId;
    const tourData = snap.data();

    console.log(`Tour ${tourId} deleted, cleaning up related data...`);

    const batch = db.batch();

    // Delete related schedules and their bookings
    const schedulesSnapshot = await db
      .collection('schedules')
      .where('tourId', '==', tourId)
      .get();

    for (const scheduleDoc of schedulesSnapshot.docs) {
      // Delete bookings for each schedule
      const bookingsSnapshot = await db
        .collection('bookings')
        .where('scheduleId', '==', scheduleDoc.id)
        .get();

      bookingsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(scheduleDoc.ref);
    }

    // Delete ratings
    const ratingsSnapshot = await db
      .collection('ratings')
      .where('tourId', '==', tourId)
      .get();
    ratingsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete notifications
    const notificationsSnapshot = await db
      .collection('notifications')
      .where('tourId', '==', tourId)
      .get();
    notificationsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    // Delete tour image from storage if exists
    if (tourData?.imageStorageId) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(tourData.imageStorageId).delete();
        console.log(`Deleted tour image: ${tourData.imageStorageId}`);
      } catch (error) {
        console.error('Error deleting tour image:', error);
      }
    }

    console.log(`Cleanup completed for tour ${tourId}`);
  });
