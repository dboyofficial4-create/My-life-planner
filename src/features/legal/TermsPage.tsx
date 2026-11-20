import { Link } from 'react-router';
import { Navigation } from 'lucide-react';
import { MIN_FACE_PHOTO_AGE, MIN_SELF_REGISTER_AGE } from '@shared/domain/age';

/** Terms of use, in plain language. Public: linked from sign-up, the welcome page and the photo forms. */
export default function TermsPage() {
  return (
    <div className="legal">
      <header className="legal__top">
        <Link to="/" className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><Navigation aria-hidden /></span>
          Waypoint
        </Link>
      </header>
      <main className="legal__body">
        <h1>Terms of use</h1>
        <p className="muted">Last updated November 20, 2026. Plain language on purpose: if something here is unclear, it counts in your favour.</p>

        <section id="who">
          <h2>1. Who can use Waypoint</h2>
          <p>You must be {MIN_SELF_REGISTER_AGE} or older to make an account. If you’re under 18, use Waypoint with a parent’s or guardian’s knowledge. Some features have their own age limits, listed below.</p>
        </section>

        <section id="advice">
          <h2>2. Waypoint gives general guidance, not professional advice</h2>
          <p>Plans, workouts, meals, skin routines and AI results are general information. They are not medical, nutrition, dermatology, mental-health or legal advice and can be wrong. Stop any exercise that causes sharp pain. See a doctor for anything painful, spreading, changing or worrying, and talk to a doctor before big changes to how you eat or train.</p>
        </section>

        <section id="photos">
          <h2>3. Photo rules</h2>
          <p>Some features can look at photos. Every photo you send must follow these rules:</p>
          <ul>
            <li><strong>Product finder (skin):</strong> ages {MIN_FACE_PHOTO_AGE} and up. Your face only, from the shoulders up, in normal clothes.</li>
            <li><strong>Build planner (body):</strong> ages 18 and up. Fully clothed in athletic wear (for example a T-shirt or tank top and shorts). Under 18, the build planner works from your answers instead of photos.</li>
            <li><strong>Progress photos (athletes):</strong> ages {MIN_FACE_PHOTO_AGE} and up. These never leave your device: they’re encrypted with your passcode and kept only in that browser. The same clothing rules apply.</li>
            <li>Only photos of yourself, or, for the build planner’s goal photo, a photo of the general look you want. Never photos of other people without their permission.</li>
            <li>No nudity, underwear, swimwear, or sexual or revealing photos, ever.</li>
          </ul>
          <p>Photos that break these rules are rejected and not used. Don’t send them: you are responsible for what you upload, and breaking the photo rules can get your account closed. Waypoint never stores photos. They are shrunk on your device, sent once to the AI service named on the form, and only the written result is saved.</p>
        </section>

        <section id="ai">
          <h2>4. AI features</h2>
          <p>Study sets, the product finder and the build planner send what you upload or type to an outside AI service (Anthropic, or Google when set up that way). You’re told which before anything is sent, and you have to agree each time. AI can make mistakes, so check anything important. Product names in results are examples, not endorsements.</p>
        </section>

        <section id="data">
          <h2>5. Your data</h2>
          <p>Your plan, settings and results are only visible to you. You can download everything or delete your account in Settings → Privacy & data. Connections like Canvas only read what they need, and you can disconnect them at any time.</p>
        </section>

        <section id="use">
          <h2>6. Using Waypoint fairly</h2>
          <p>Don’t try to access other people’s accounts, break the app, or use it to harass anyone. Accounts that do can be closed.</p>
        </section>

        <section id="changes">
          <h2>7. Changes</h2>
          <p>These terms may change as Waypoint does. Important changes will be shown in the app before they apply.</p>
        </section>

        <p className="small muted"><Link to="/">Back to Waypoint</Link></p>
      </main>
    </div>
  );
}
