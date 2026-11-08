STAFF MANAGEMENT SYSTEM — HTML/CSS/JAVASCRIPT + FIREBASE

FILES
- index.html: login, registration, admin and employee dashboard views
- style.css: styling
- app.js: Firebase Authentication and Firestore operations
- firebase-config.js: your Firebase web app configuration
- firestore.rules: starter Firestore security rules

SETUP
1. In Firebase Console, open your project and register a Web app (</>).
2. Copy the Firebase config object.
3. Open firebase-config.js and replace all PASTE_YOUR_* values with your real config values.
   Keep the export line: export const firebaseConfig = { ... };
4. Firebase Console > Build > Authentication > Get started > Sign-in method.
   Enable Email/Password.
5. Firebase Console > Firestore Database > Rules.
   Replace the rules with firestore.rules and click Publish.
6. Run this folder with VS Code Live Server. Do not open index.html directly as file://.
7. Register a normal account. Public registration creates employee accounts only.
8. To create the FIRST ADMIN:
   - Register your own account through the website.
   - In Firebase Console > Firestore Database > Data, open the users collection.
   - Open the document whose ID is your Firebase Authentication user UID.
   - Change its role field from "employee" to "admin" (string).
   - Sign out and sign in again.
   Do not let public users choose the admin role.

IMPORTANT NOTES
- The admin "Add employee" form creates a staff directory record. It does not create a Firebase login account.
- Employees create their own login using the Register form. Their initial role is employee.
- Admin can add/delete employee directory records and publish announcements.
- Deleting an employee directory record does NOT delete their Firebase Authentication account.
- For a production system, use Firebase Admin SDK in a trusted server/Cloud Function for privileged account creation, role assignment, and account deletion. Never put service-account credentials in browser JavaScript.
- Test all access rules with Firebase Emulator Suite before production deployment.
- This is a starter template, not a complete HR/payroll system.
