import { writable } from 'svelte/store';
import { auth, db, storage, functions } from './firebase/config';
import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	updateProfile,
	GoogleAuthProvider,
	signInWithPopup
} from 'firebase/auth';
import {
	collection,
	doc,
	getDoc,
	getDocs,
	addDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	serverTimestamp,
	writeBatch,
	limit
} from 'firebase/firestore';
import {
	ref,
	uploadBytes,
	getDownloadURL,
	deleteObject
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import type {
	User,
	Tour,
	Schedule,
	Booking,
	Rating,
	AverageRatings,
	TourStop,
	PublicProfile
} from './firebase/types';

// Create stores for state management (matching convexService)
export const currentUser = writable<User | null>(null);
export const isAdmin = writable<boolean>(false);
export const userCreatedTours = writable<Tour[]>([]);

// Initialize auth state listener
if (typeof window !== 'undefined') {
	onAuthStateChanged(auth, async (firebaseUser) => {
		if (firebaseUser) {
			await FirebaseService.getAccount();
		} else {
			currentUser.set(null);
			isAdmin.set(false);
			userCreatedTours.set([]);
		}
	});
}

export const FirebaseService = {
	// Authentication methods
	async getAccount(): Promise<User | null> {
		try {
			const firebaseUser = auth.currentUser;
			if (!firebaseUser) {
				currentUser.set(null);
				isAdmin.set(false);
				userCreatedTours.set([]);
				return null;
			}

			// Get profile
			const profileDoc = await getDoc(doc(db, 'publicProfiles', firebaseUser.uid));
			const profile = profileDoc.exists() ? profileDoc.data() : null;

			// Get role
			const roleDoc = await getDoc(doc(db, 'userRoles', firebaseUser.uid));
			const role = roleDoc.exists() ? roleDoc.data() : null;

			const user: User = {
				id: firebaseUser.uid,
				email: firebaseUser.email || '',
				name: firebaseUser.displayName || undefined,
				username: profile?.username,
				role: role?.role || 'user',
				isAdmin: role?.role === 'admin'
			};

			currentUser.set(user);
			isAdmin.set(user.isAdmin);

			// Fetch user created tours
			const tours = await this.getCreatorTours(user.id);
			userCreatedTours.set((tours as Tour[]) || []);

			return user;
		} catch (error) {
			console.error('Error getting account:', error);
			currentUser.set(null);
			isAdmin.set(false);
			userCreatedTours.set([]);
			return null;
		}
	},

	hasAdminAccess(): boolean {
		let adminStatus = false;
		isAdmin.subscribe((value) => {
			adminStatus = value;
		})();
		return adminStatus;
	},

	async createAccount(email: string, password: string, name: string) {
		try {
			const credential = await createUserWithEmailAndPassword(auth, email, password);
			await updateProfile(credential.user, { displayName: name });

			// Create public profile (use UID as document ID so getAccount can find it)
			await setDoc(doc(db, 'publicProfiles', credential.user.uid), {
				userId: credential.user.uid,
				username: name,
				memberSince: Date.now(),
				updatedAt: serverTimestamp()
			});

			// Create default user role (use UID as document ID)
			await setDoc(doc(db, 'userRoles', credential.user.uid), {
				userId: credential.user.uid,
				role: 'user'
			});

			// Fetch and return the user
			const user = await this.getAccount();
			return user;
		} catch (error) {
			console.error('Error creating account:', error);
			throw error;
		}
	},

	async login(email: string, password: string) {
		try {
			await signInWithEmailAndPassword(auth, email, password);
			const user = await this.getAccount();
			return user;
		} catch (error) {
			console.error('Error logging in:', error);
			throw error;
		}
	},

	async loginWithGoogle() {
		try {
			const provider = new GoogleAuthProvider();
			const result = await signInWithPopup(auth, provider);
			const firebaseUser = result.user;

			// Check if user profile already exists
			const profileDoc = await getDoc(doc(db, 'publicProfiles', firebaseUser.uid));

			if (!profileDoc.exists()) {
				// Create public profile for new Google user (use UID as document ID)
				await setDoc(doc(db, 'publicProfiles', firebaseUser.uid), {
					userId: firebaseUser.uid,
					username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
					memberSince: Date.now(),
					updatedAt: serverTimestamp()
				});

				// Create default user role (use UID as document ID)
				await setDoc(doc(db, 'userRoles', firebaseUser.uid), {
					userId: firebaseUser.uid,
					role: 'user'
				});
			}

			const user = await this.getAccount();
			return user;
		} catch (error) {
			console.error('Error logging in with Google:', error);
			throw error;
		}
	},

	async logout() {
		try {
			await signOut(auth);
		} catch (error) {
			console.error('Error logging out:', error);
		}
		currentUser.set(null);
		isAdmin.set(false);
		userCreatedTours.set([]);
	},

	async resendConfirmationEmail(email: string) {
		// Firebase handles email verification differently
		console.log('Resend confirmation email requested for:', email);
		return { success: true, message: 'If email verification is enabled, a new email will be sent.' };
	},

	// Tour methods
	async createTour(tourData: any, userId?: string) {
		try {
			const user = auth.currentUser;
			if (!user) throw new Error('Not authenticated');

			const price = tourData.tourType === 'app' ? 0 : (tourData.price || 24);

			// Process stops if present
			const stops: TourStop[] = (tourData.stops || []).map((stop: TourStop) => {
				const s: any = {
					id: stop.id,
					order: stop.order,
					location: {
						lat: stop.location.lat,
						lng: stop.location.lng,
						address: stop.location.address || '',
						placeName: stop.location.placeName || '',
						placeType: stop.location.placeType || ''
					}
				};
				if (stop.teachingMaterial) {
					s.teachingMaterial = {
						vocabulary: stop.teachingMaterial.vocabulary || [],
						dialogues: stop.teachingMaterial.dialogues || [],
						facts: stop.teachingMaterial.facts || [],
						keywords: stop.teachingMaterial.keywords || [],
						teacherPlan: stop.teachingMaterial.teacherPlan || '',
						generatedAt: stop.teachingMaterial.generatedAt || Date.now(),
						languageTaught: stop.teachingMaterial.languageTaught || '',
						instructionLanguage: stop.teachingMaterial.instructionLanguage || '',
						cefrLevel: stop.teachingMaterial.cefrLevel || ''
					};
				}
				return s;
			});

			const descriptionDoc: any = {
				name: tourData.name || '',
				cityId: tourData.cityId || '',
				languageTaught: tourData.languageTaught || '',
				instructionLanguage: tourData.instructionLanguage || '',
				description: tourData.description || '',
				price: price,
				stops: stops
			};
			if (tourData.langDifficulty) descriptionDoc.langDifficulty = tourData.langDifficulty;
			if (tourData.tourType) descriptionDoc.tourType = tourData.tourType;

			const tourDoc: any = {
				description: descriptionDoc,
				creatorId: user.uid,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp()
			};
			if (tourData.imageUrl) tourDoc.imageUrl = tourData.imageUrl;
			if (tourData.imageStorageId) tourDoc.imageStorageId = tourData.imageStorageId;

			const docRef = await addDoc(collection(db, 'tours'), tourDoc);
			return { _id: docRef.id, id: docRef.id };
		} catch (error) {
			console.error('Error creating tour:', error);
			throw error;
		}
	},

	async updateTour(tourId: string, tourData: any) {
		try {
			const tourRef = doc(db, 'tours', tourId);

			const updateData: any = {
				updatedAt: serverTimestamp()
			};

			// Process stops if present
			const processStops = (stops: TourStop[] | undefined): TourStop[] => {
				if (!stops) return [];
				return stops.map((stop: TourStop) => {
					const s: any = {
						id: stop.id,
						order: stop.order,
						location: {
							lat: stop.location.lat,
							lng: stop.location.lng,
							address: stop.location.address || '',
							placeName: stop.location.placeName || '',
							placeType: stop.location.placeType || ''
						}
					};
					if (stop.teachingMaterial) {
						s.teachingMaterial = {
							vocabulary: stop.teachingMaterial.vocabulary || [],
							dialogues: stop.teachingMaterial.dialogues || [],
							facts: stop.teachingMaterial.facts || [],
							keywords: stop.teachingMaterial.keywords || [],
							teacherPlan: stop.teachingMaterial.teacherPlan || '',
							generatedAt: stop.teachingMaterial.generatedAt || Date.now(),
							languageTaught: stop.teachingMaterial.languageTaught || '',
							instructionLanguage: stop.teachingMaterial.instructionLanguage || '',
							cefrLevel: stop.teachingMaterial.cefrLevel || ''
						};
					}
					return s;
				});
			};

			if (tourData.description && typeof tourData.description === 'object') {
				const desc: any = { ...tourData.description };
				desc.stops = processStops(tourData.description.stops || tourData.stops);
				// Remove any undefined values from the spread
				for (const key of Object.keys(desc)) {
					if (desc[key] === undefined) delete desc[key];
				}
				updateData.description = desc;
			} else {
				const desc: any = {
					name: tourData.name || '',
					cityId: tourData.cityId || '',
					languageTaught: tourData.languageTaught || '',
					instructionLanguage: tourData.instructionLanguage || '',
					description: '',
					stops: processStops(tourData.stops)
				};
				if (tourData.langDifficulty) desc.langDifficulty = tourData.langDifficulty;
				if (tourData.tourType) desc.tourType = tourData.tourType;
				if (tourData.price !== undefined) desc.price = tourData.price;
				updateData.description = desc;
			}

			if (tourData.imageUrl !== undefined) {
				updateData.imageUrl = tourData.imageUrl;
			}
			if (tourData.imageStorageId !== undefined) {
				updateData.imageStorageId = tourData.imageStorageId;
			}

			await updateDoc(tourRef, updateData);
			return { success: true };
		} catch (error) {
			console.error('Error updating tour:', error);
			throw error;
		}
	},

	async deleteTour(tourId: string) {
		try {
			const batch = writeBatch(db);

			// Get the tour to check for storage files
			const tourDoc = await getDoc(doc(db, 'tours', tourId));
			const tourData = tourDoc.data();

			// Delete related schedules and their bookings
			const schedulesQuery = query(collection(db, 'schedules'), where('tourId', '==', tourId));
			const schedulesSnapshot = await getDocs(schedulesQuery);

			for (const scheduleDoc of schedulesSnapshot.docs) {
				const bookingsQuery = query(
					collection(db, 'bookings'),
					where('scheduleId', '==', scheduleDoc.id)
				);
				const bookingsSnapshot = await getDocs(bookingsQuery);
				bookingsSnapshot.docs.forEach((bookingDoc) => batch.delete(bookingDoc.ref));
				batch.delete(scheduleDoc.ref);
			}

			// Delete ratings
			const ratingsQuery = query(collection(db, 'ratings'), where('tourId', '==', tourId));
			const ratingsSnapshot = await getDocs(ratingsQuery);
			ratingsSnapshot.docs.forEach((ratingDoc) => batch.delete(ratingDoc.ref));

			// Delete notifications
			const notificationsQuery = query(
				collection(db, 'notifications'),
				where('tourId', '==', tourId)
			);
			const notificationsSnapshot = await getDocs(notificationsQuery);
			notificationsSnapshot.docs.forEach((notificationDoc) => batch.delete(notificationDoc.ref));

			// Delete the tour
			batch.delete(doc(db, 'tours', tourId));

			await batch.commit();

			// Delete storage file if exists
			if (tourData?.imageStorageId) {
				try {
					const fileRef = ref(storage, tourData.imageStorageId);
					await deleteObject(fileRef);
				} catch (storageError) {
					console.error('Error deleting tour image:', storageError);
				}
			}

			return { success: true };
		} catch (error) {
			console.error('Error deleting tour:', error);
			throw error;
		}
	},

	async getTour(tourId: string) {
		if (!tourId || tourId === 'undefined') {
			console.error('Invalid tour ID provided to getTour:', tourId);
			return { data: null, error: new Error('Invalid tour ID provided') };
		}

		try {
			const tourDoc = await getDoc(doc(db, 'tours', tourId));
			if (!tourDoc.exists()) {
				return { data: null, error: null };
			}

			const tour = {
				...tourDoc.data(),
				id: tourDoc.id,
				_id: tourDoc.id,
				$id: tourDoc.id
			};

			return { data: tour, error: null };
		} catch (error) {
			console.error('Error getting tour:', error);
			return { data: null, error };
		}
	},

	async getAllTours() {
		try {
			const toursSnapshot = await getDocs(collection(db, 'tours'));
			const tours = toursSnapshot.docs.map((doc) => ({
				...doc.data(),
				id: doc.id,
				_id: doc.id,
				$id: doc.id
			}));

			return {
				documents: tours,
				data: tours
			};
		} catch (error) {
			console.error('Error getting all tours:', error);
			throw error;
		}
	},

	// File upload methods
	async uploadFile(file: File, userId?: string) {
		try {
			const user = auth.currentUser;
			if (!user) throw new Error('Not authenticated');

			const filePath = `tours/${user.uid}/${Date.now()}_${file.name}`;
			const fileRef = ref(storage, filePath);

			await uploadBytes(fileRef, file);
			const url = await getDownloadURL(fileRef);

			return { id: filePath, url };
		} catch (error) {
			console.error('Error uploading file:', error);
			throw error;
		}
	},

	async deleteFile(fileId: string) {
		try {
			const fileRef = ref(storage, fileId);
			await deleteObject(fileRef);
		} catch (error) {
			console.error('Error deleting file:', error);
			throw error;
		}
	},

	getFilePreviewUrl(fileId: string): string {
		return fileId;
	},

	// Schedule methods
	async scheduleTour(
		tourId: string,
		scheduledDate: Date,
		maxParticipants: number,
		meetingPoint: string,
		additionalInfo: string = '',
		price: number = 0
	) {
		try {
			const scheduleDoc = {
				tourId,
				scheduledDate: scheduledDate.getTime(),
				maxParticipants,
				meetingPoint,
				additionalInfo,
				price,
				createdAt: serverTimestamp()
			};

			const docRef = await addDoc(collection(db, 'schedules'), scheduleDoc);
			return { _id: docRef.id, id: docRef.id };
		} catch (error) {
			console.error('Error scheduling tour:', error);
			throw error;
		}
	},

	async getScheduledTours(tourId: string) {
		if (!tourId || tourId === 'undefined') {
			console.error('Invalid tour ID provided to getScheduledTours:', tourId);
			return { data: [], error: null };
		}

		try {
			const schedulesQuery = query(
				collection(db, 'schedules'),
				where('tourId', '==', tourId),
				orderBy('scheduledDate', 'asc')
			);
			const schedulesSnapshot = await getDocs(schedulesQuery);

			const schedules = schedulesSnapshot.docs.map((doc) => ({
				...doc.data(),
				id: doc.id,
				_id: doc.id,
				$id: doc.id
			}));

			return { data: schedules, error: null };
		} catch (error) {
			console.error('Error getting scheduled tours:', error);
			return { data: [], error };
		}
	},

	async getScheduleById(scheduleId: string) {
		if (!scheduleId || scheduleId === 'undefined') {
			console.error('Invalid schedule ID provided to getScheduleById:', scheduleId);
			return { data: null, error: new Error('Invalid schedule ID') };
		}

		try {
			const scheduleDoc = await getDoc(doc(db, 'schedules', scheduleId));
			if (!scheduleDoc.exists()) {
				return { data: null, error: null };
			}

			const schedule = {
				...scheduleDoc.data(),
				id: scheduleDoc.id,
				_id: scheduleDoc.id,
				$id: scheduleDoc.id
			};

			return { data: schedule, error: null };
		} catch (error) {
			console.error('Error getting schedule by ID:', error);
			return { data: null, error };
		}
	},

	async cancelSchedule(scheduleId: string) {
		if (!scheduleId || scheduleId === 'undefined') {
			console.error('Invalid schedule ID provided to cancelSchedule:', scheduleId);
			return { success: false, error: new Error('Invalid schedule ID') };
		}

		try {
			const batch = writeBatch(db);

			// Delete related bookings
			const bookingsQuery = query(
				collection(db, 'bookings'),
				where('scheduleId', '==', scheduleId)
			);
			const bookingsSnapshot = await getDocs(bookingsQuery);
			bookingsSnapshot.docs.forEach((bookingDoc) => batch.delete(bookingDoc.ref));

			// Delete the schedule
			batch.delete(doc(db, 'schedules', scheduleId));

			await batch.commit();
			return { success: true, error: null };
		} catch (error) {
			console.error('Error canceling schedule:', error);
			return { success: false, error };
		}
	},

	async getUpcomingScheduledTours() {
		try {
			const now = Date.now();
			const schedulesQuery = query(
				collection(db, 'schedules'),
				where('scheduledDate', '>=', now),
				orderBy('scheduledDate', 'asc')
			);
			const schedulesSnapshot = await getDocs(schedulesQuery);

			const schedules = await Promise.all(
				schedulesSnapshot.docs.map(async (scheduleDoc) => {
					const scheduleData = scheduleDoc.data();

					// Get tour info
					let tour = null;
					if (scheduleData.tourId) {
						const tourDoc = await getDoc(doc(db, 'tours', scheduleData.tourId));
						if (tourDoc.exists()) {
							tour = {
								...tourDoc.data(),
								id: tourDoc.id,
								_id: tourDoc.id,
								$id: tourDoc.id
							};
						}
					}

					// Get bookings count
					const bookingsQuery = query(
						collection(db, 'bookings'),
						where('scheduleId', '==', scheduleDoc.id)
					);
					const bookingsSnapshot = await getDocs(bookingsQuery);
					const bookingsCount = bookingsSnapshot.docs.reduce((sum, bookingDoc) => {
						const participants = bookingDoc.data().participants || 0;
						return participants > 0 ? sum + participants : sum;
					}, 0);

					return {
						...scheduleData,
						id: scheduleDoc.id,
						_id: scheduleDoc.id,
						$id: scheduleDoc.id,
						tour,
						bookingsCount
					};
				})
			);

			return {
				documents: schedules,
				data: schedules
			};
		} catch (error) {
			console.error('Error getting upcoming scheduled tours:', error);
			throw error;
		}
	},

	// Booking methods
	async bookTour(
		scheduleId: string,
		userId: string,
		name: string,
		email: string,
		participants: number = 1,
		notes: string = ''
	) {
		try {
			// Get schedule to check capacity
			const scheduleDoc = await getDoc(doc(db, 'schedules', scheduleId));
			if (!scheduleDoc.exists()) {
				return { data: null, error: { message: 'Schedule not found' } };
			}

			const scheduleData = scheduleDoc.data();

			// Get current bookings count
			const bookingsQuery = query(
				collection(db, 'bookings'),
				where('scheduleId', '==', scheduleId)
			);
			const bookingsSnapshot = await getDocs(bookingsQuery);
			const currentBookings = bookingsSnapshot.docs.reduce((sum, bookingDoc) => {
				const p = bookingDoc.data().participants || 0;
				return p > 0 ? sum + p : sum;
			}, 0);

			// Check capacity
			if (currentBookings + participants > scheduleData.maxParticipants) {
				return { data: null, error: { message: 'Not enough spots available' } };
			}

			const bookingDoc = {
				scheduleId,
				userId,
				name,
				email,
				participants,
				notes,
				attended: false,
				createdAt: serverTimestamp()
			};

			const docRef = await addDoc(collection(db, 'bookings'), bookingDoc);
			return { data: { _id: docRef.id, id: docRef.id }, error: null };
		} catch (error: any) {
			console.error('Error booking tour:', error);
			return { data: null, error: { message: error.message } };
		}
	},

	async cancelBooking(bookingId: string) {
		try {
			// Mark as cancelled by setting participants to -1
			await updateDoc(doc(db, 'bookings', bookingId), {
				participants: -1
			});
			return { data: true, error: null };
		} catch (error: any) {
			console.error('Error cancelling booking:', error);
			return { data: null, error: { message: error.message } };
		}
	},

	async getBookingsForSchedule(scheduleId: string) {
		if (!scheduleId || scheduleId === 'undefined') {
			console.error('Invalid schedule ID provided to getBookingsForSchedule:', scheduleId);
			return { data: [], error: null };
		}

		try {
			const bookingsQuery = query(
				collection(db, 'bookings'),
				where('scheduleId', '==', scheduleId)
			);
			const bookingsSnapshot = await getDocs(bookingsQuery);

			const bookings = bookingsSnapshot.docs.map((doc) => ({
				...doc.data(),
				id: doc.id,
				_id: doc.id,
				$id: doc.id
			}));

			return { data: bookings, error: null };
		} catch (error) {
			console.error('Error getting bookings for schedule:', error);
			return { data: [], error };
		}
	},

	async getUserBookings(userId: string) {
		try {
			const bookingsQuery = query(
				collection(db, 'bookings'),
				where('userId', '==', userId)
			);
			const bookingsSnapshot = await getDocs(bookingsQuery);

			const bookings = await Promise.all(
				bookingsSnapshot.docs.map(async (bookingDoc) => {
					const bookingData = bookingDoc.data();

					// Get schedule
					let schedule: any = null;
					let tour: any = null;
					if (bookingData.scheduleId) {
						const scheduleDocRef = await getDoc(doc(db, 'schedules', bookingData.scheduleId));
						if (scheduleDocRef.exists()) {
							const scheduleData = scheduleDocRef.data();
							schedule = {
								...scheduleData,
								id: scheduleDocRef.id,
								_id: scheduleDocRef.id
							};

							// Get tour
							if (scheduleData.tourId) {
								const tourDocRef = await getDoc(doc(db, 'tours', scheduleData.tourId));
								if (tourDocRef.exists()) {
									tour = {
										...tourDocRef.data(),
										id: tourDocRef.id,
										_id: tourDocRef.id
									};
								}
							}
						}
					}

					return {
						...bookingData,
						id: bookingDoc.id,
						_id: bookingDoc.id,
						$id: bookingDoc.id,
						schedule,
						tour
					};
				})
			);

			return {
				documents: bookings,
				data: bookings
			};
		} catch (error) {
			console.error('Error getting user bookings:', error);
			throw error;
		}
	},

	// Attendance methods
	async markAsAttended(bookingId: string) {
		try {
			const bookingRef = doc(db, 'bookings', bookingId);
			const bookingDoc = await getDoc(bookingRef);

			if (!bookingDoc.exists()) {
				throw new Error('Booking not found');
			}

			const bookingData = bookingDoc.data();

			await updateDoc(bookingRef, {
				attended: true,
				attendedAt: Date.now()
			});

			// Get the tour ID from the schedule
			let tourId = null;
			if (bookingData.scheduleId) {
				const scheduleDoc = await getDoc(doc(db, 'schedules', bookingData.scheduleId));
				if (scheduleDoc.exists()) {
					tourId = scheduleDoc.data().tourId;
				}
			}

			// Try to send rating notification email via Cloud Function
			if (tourId) {
				try {
					const sendRatingEmail = httpsCallable(functions, 'sendRatingNotificationEmail');
					await sendRatingEmail({
						email: bookingData.email,
						tourId,
						userName: bookingData.name
					});
				} catch (emailError) {
					console.error('Error sending rating notification email:', emailError);
				}
			}

			return {
				...bookingData,
				tourId,
				attended: true,
				attendedAt: Date.now()
			};
		} catch (error) {
			console.error('Error marking as attended:', error);
			throw error;
		}
	},

	async hasUserAttendedTour(userId: string, tourId: string) {
		try {
			// Get all schedules for this tour
			const schedulesQuery = query(
				collection(db, 'schedules'),
				where('tourId', '==', tourId)
			);
			const schedulesSnapshot = await getDocs(schedulesQuery);
			const scheduleIds = schedulesSnapshot.docs.map((doc) => doc.id);

			if (scheduleIds.length === 0) return false;

			// Check if user has any attended bookings for these schedules
			for (const scheduleId of scheduleIds) {
				const bookingsQuery = query(
					collection(db, 'bookings'),
					where('scheduleId', '==', scheduleId),
					where('userId', '==', userId),
					where('attended', '==', true)
				);
				const bookingsSnapshot = await getDocs(bookingsQuery);
				if (!bookingsSnapshot.empty) {
					return true;
				}
			}

			return false;
		} catch (error) {
			console.error('Error checking if user attended tour:', error);
			return false;
		}
	},

	// Rating methods
	getAverageRating(tour: any): number {
		try {
			if (tour.ratings && typeof tour.ratings === 'object') {
				const ratings = Object.values(tour.ratings).filter(
					(r) => typeof r === 'number'
				) as number[];
				if (ratings.length > 0) {
					return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
				}
			}

			if (typeof tour.rating === 'number') {
				return tour.rating;
			}

			if (typeof tour.averageRating === 'number') {
				return tour.averageRating;
			}

			return 0;
		} catch (error) {
			console.error('Error calculating average rating:', error);
			return 0;
		}
	},

	async submitTourRatings(
		tourId: string,
		userId: string,
		languageLearningRating: number,
		informativeRating: number,
		funRating: number,
		comment: string = ''
	) {
		try {
			// Check if user already rated this tour
			const existingQuery = query(
				collection(db, 'ratings'),
				where('tourId', '==', tourId),
				where('userId', '==', userId)
			);
			const existingSnapshot = await getDocs(existingQuery);

			if (!existingSnapshot.empty) {
				throw new Error('You have already rated this tour');
			}

			const ratingDoc = {
				tourId,
				userId,
				languageLearningRating,
				informativeRating,
				funRating,
				comment,
				createdAt: serverTimestamp()
			};

			const docRef = await addDoc(collection(db, 'ratings'), ratingDoc);
			return { _id: docRef.id, id: docRef.id };
		} catch (error) {
			console.error('Error submitting tour ratings:', error);
			throw error;
		}
	},

	async getTourRatings(tourId: string) {
		if (!tourId || tourId === 'undefined') {
			console.error('Invalid tour ID provided to getTourRatings:', tourId);
			return { data: [], error: new Error('Invalid tour ID provided') };
		}

		try {
			const ratingsQuery = query(
				collection(db, 'ratings'),
				where('tourId', '==', tourId)
			);
			const ratingsSnapshot = await getDocs(ratingsQuery);

			const ratings = ratingsSnapshot.docs.map((doc) => ({
				...doc.data(),
				id: doc.id,
				_id: doc.id,
				$id: doc.id
			}));

			return { data: ratings, error: null };
		} catch (error) {
			console.error('Error getting tour ratings:', error);
			return { data: [], error };
		}
	},

	async getAverageTourRatings(tourId: string): Promise<AverageRatings> {
		try {
			const ratingsQuery = query(
				collection(db, 'ratings'),
				where('tourId', '==', tourId)
			);
			const ratingsSnapshot = await getDocs(ratingsQuery);

			if (ratingsSnapshot.empty) {
				return {
					languageLearning: 0,
					informative: 0,
					fun: 0,
					overall: 0,
					count: 0
				};
			}

			let languageLearningSum = 0;
			let informativeSum = 0;
			let funSum = 0;
			let count = 0;

			ratingsSnapshot.docs.forEach((doc) => {
				const data = doc.data();
				languageLearningSum += data.languageLearningRating || 0;
				informativeSum += data.informativeRating || 0;
				funSum += data.funRating || 0;
				count++;
			});

			const languageLearning = count > 0 ? languageLearningSum / count : 0;
			const informative = count > 0 ? informativeSum / count : 0;
			const fun = count > 0 ? funSum / count : 0;
			const overall = (languageLearning + informative + fun) / 3;

			return {
				languageLearning,
				informative,
				fun,
				overall,
				count
			};
		} catch (error) {
			console.error('Error getting average tour ratings:', error);
			return {
				languageLearning: 0,
				informative: 0,
				fun: 0,
				overall: 0,
				count: 0
			};
		}
	},

	async hasUserRatedTour(userId: string, tourId: string) {
		try {
			const ratingsQuery = query(
				collection(db, 'ratings'),
				where('tourId', '==', tourId),
				where('userId', '==', userId),
				limit(1)
			);
			const ratingsSnapshot = await getDocs(ratingsQuery);
			return !ratingsSnapshot.empty;
		} catch (error) {
			console.error('Error checking if user rated tour:', error);
			return false;
		}
	},

	async getTourCreatorId(tourId: string): Promise<string | null> {
		if (!tourId || tourId === 'undefined') {
			console.error('Invalid tour ID provided to getTourCreatorId:', tourId);
			return null;
		}

		try {
			const tourDoc = await getDoc(doc(db, 'tours', tourId));
			if (!tourDoc.exists()) return null;
			return tourDoc.data().creatorId || null;
		} catch (error) {
			console.error('Error getting tour creator ID:', error);
			return null;
		}
	},

	async getCreatorTours(creatorId: string) {
		try {
			const toursQuery = query(
				collection(db, 'tours'),
				where('creatorId', '==', creatorId)
			);
			const toursSnapshot = await getDocs(toursQuery);

			return toursSnapshot.docs.map((doc) => ({
				...doc.data(),
				id: doc.id,
				_id: doc.id,
				$id: doc.id
			}));
		} catch (error) {
			console.error('Error getting creator tours:', error);
			return [];
		}
	},

	async getCreatorAverageRatings(creatorId: string): Promise<AverageRatings> {
		try {
			// Get all tours by creator
			const toursQuery = query(
				collection(db, 'tours'),
				where('creatorId', '==', creatorId)
			);
			const toursSnapshot = await getDocs(toursQuery);
			const tourIds = toursSnapshot.docs.map((doc) => doc.id);

			if (tourIds.length === 0) {
				return {
					languageLearning: 0,
					informative: 0,
					fun: 0,
					overall: 0,
					count: 0
				};
			}

			// Get all ratings for those tours
			let languageLearningSum = 0;
			let informativeSum = 0;
			let funSum = 0;
			let count = 0;

			for (const tourId of tourIds) {
				const ratingsQuery = query(
					collection(db, 'ratings'),
					where('tourId', '==', tourId)
				);
				const ratingsSnapshot = await getDocs(ratingsQuery);

				ratingsSnapshot.docs.forEach((doc) => {
					const data = doc.data();
					languageLearningSum += data.languageLearningRating || 0;
					informativeSum += data.informativeRating || 0;
					funSum += data.funRating || 0;
					count++;
				});
			}

			const languageLearning = count > 0 ? languageLearningSum / count : 0;
			const informative = count > 0 ? informativeSum / count : 0;
			const fun = count > 0 ? funSum / count : 0;
			const overall = (languageLearning + informative + fun) / 3;

			return {
				languageLearning,
				informative,
				fun,
				overall,
				count
			};
		} catch (error) {
			console.error('Error getting creator average ratings:', error);
			return {
				languageLearning: 0,
				informative: 0,
				fun: 0,
				overall: 0,
				count: 0
			};
		}
	},

	// Notification methods
	async saveNotification(tourId: string, email: string) {
		if (!tourId || tourId === 'undefined') {
			console.error('Invalid tour ID provided to saveNotification:', tourId);
			return { data: null, error: new Error('Invalid tour ID provided') };
		}

		if (!email) {
			console.error('Email is required for saveNotification');
			return { data: null, error: new Error('Email is required') };
		}

		try {
			const notificationDoc = {
				tourId,
				email,
				createdAt: Date.now()
			};

			const docRef = await addDoc(collection(db, 'notifications'), notificationDoc);
			return { data: { _id: docRef.id }, error: null };
		} catch (error) {
			console.error('Error saving notification:', error);
			return { data: null, error };
		}
	},

	// User methods
	async getUserCreatedTours(userId: string) {
		try {
			const tours = await this.getCreatorTours(userId);
			return { data: tours, error: null };
		} catch (error) {
			console.error('Error getting user created tours:', error);
			return { data: [], error };
		}
	},

	async getUsernameById(userId: string): Promise<string | null> {
		if (!userId) {
			return null;
		}

		try {
			const profilesQuery = query(
				collection(db, 'publicProfiles'),
				where('userId', '==', userId),
				limit(1)
			);
			const profilesSnapshot = await getDocs(profilesQuery);

			if (profilesSnapshot.empty) {
				return `User ${userId.substring(0, 8)}`;
			}

			return profilesSnapshot.docs[0].data().username || `User ${userId.substring(0, 8)}`;
		} catch (error) {
			console.error('Error getting username by ID:', error);
			return `User ${userId.substring(0, 8)}`;
		}
	},

	async updateUserProfile(name: string) {
		try {
			const user = auth.currentUser;
			if (!user) throw new Error('Not authenticated');

			// Update Firebase Auth display name
			await updateProfile(user, { displayName: name });

			// Update public profile
			const profilesQuery = query(
				collection(db, 'publicProfiles'),
				where('userId', '==', user.uid),
				limit(1)
			);
			const profilesSnapshot = await getDocs(profilesQuery);

			if (!profilesSnapshot.empty) {
				await updateDoc(profilesSnapshot.docs[0].ref, {
					username: name,
					updatedAt: serverTimestamp()
				});
			} else {
				await addDoc(collection(db, 'publicProfiles'), {
					userId: user.uid,
					username: name,
					updatedAt: serverTimestamp()
				});
			}

			return { success: true };
		} catch (error) {
			console.error('Error updating user profile:', error);
			throw error;
		}
	},

	async getPublicProfile(userId: string): Promise<PublicProfile | null> {
		if (!userId) return null;

		try {
			const profilesQuery = query(
				collection(db, 'publicProfiles'),
				where('userId', '==', userId),
				limit(1)
			);
			const profilesSnapshot = await getDocs(profilesQuery);

			if (profilesSnapshot.empty) return null;

			const data = profilesSnapshot.docs[0].data();
			return {
				userId: data.userId,
				username: data.username,
				bio: data.bio,
				languagesSpoken: data.languagesSpoken,
				avatarUrl: data.avatarUrl,
				avatarStorageId: data.avatarStorageId,
				memberSince: data.memberSince,
				updatedAt: data.updatedAt
			} as PublicProfile;
		} catch (error) {
			console.error('Error getting public profile:', error);
			return null;
		}
	},

	async updatePublicProfile(data: Partial<PublicProfile>) {
		try {
			const user = auth.currentUser;
			if (!user) throw new Error('Not authenticated');

			const profilesQuery = query(
				collection(db, 'publicProfiles'),
				where('userId', '==', user.uid),
				limit(1)
			);
			const profilesSnapshot = await getDocs(profilesQuery);

			const updateData: any = {
				...data,
				updatedAt: serverTimestamp()
			};
			// Remove undefined values
			for (const key of Object.keys(updateData)) {
				if (updateData[key] === undefined) delete updateData[key];
			}

			if (!profilesSnapshot.empty) {
				await updateDoc(profilesSnapshot.docs[0].ref, updateData);
			} else {
				await addDoc(collection(db, 'publicProfiles'), {
					userId: user.uid,
					...updateData
				});
			}

			return { success: true };
		} catch (error) {
			console.error('Error updating public profile:', error);
			throw error;
		}
	},

	async uploadAvatar(file: File) {
		try {
			const user = auth.currentUser;
			if (!user) throw new Error('Not authenticated');

			const filePath = `avatars/${user.uid}/${Date.now()}_${file.name}`;
			const fileRef = ref(storage, filePath);

			await uploadBytes(fileRef, file);
			const url = await getDownloadURL(fileRef);

			return { id: filePath, url };
		} catch (error) {
			console.error('Error uploading avatar:', error);
			throw error;
		}
	},

	async getNextScheduledTour(tourId: string) {
		try {
			if (!tourId || tourId === 'undefined') {
				console.error('Invalid tour ID provided to getNextScheduledTour:', tourId);
				return { data: null, error: null };
			}

			const now = Date.now();
			const schedulesQuery = query(
				collection(db, 'schedules'),
				where('tourId', '==', tourId),
				where('scheduledDate', '>=', now),
				orderBy('scheduledDate', 'asc'),
				limit(1)
			);
			const schedulesSnapshot = await getDocs(schedulesQuery);

			if (schedulesSnapshot.empty) {
				return { data: null, error: null };
			}

			const scheduleDoc = schedulesSnapshot.docs[0];
			const schedule = {
				...scheduleDoc.data(),
				id: scheduleDoc.id,
				_id: scheduleDoc.id,
				$id: scheduleDoc.id
			};

			return { data: schedule, error: null };
		} catch (error) {
			console.error('Error getting next scheduled tour:', error);
			return { data: null, error };
		}
	}
};

// Alias for backwards compatibility
export const ConvexService = FirebaseService;
