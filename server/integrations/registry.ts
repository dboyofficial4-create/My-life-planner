import type { AppConfig } from '../app';

/**
 * Every external integration is described honestly: what works, what needs
 * credentials or approval, what is unsupported, and the fallback.
 * The UI renders this list verbatim — nothing here claims more than exists.
 */
export interface IntegrationDef {
  id: string;
  connectable: boolean;
  isConfigured: (cfg: AppConfig) => boolean;
  describe: {
    name: string;
    module: string;
    status: 'available' | 'needs_credentials' | 'not_supported' | 'planned';
    implemented: string[];
    requires: string[];
    unsupported: string[];
    fallback: string;
    unsupportedReason?: string;
  };
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'ics_import',
    connectable: false,
    isConfigured: () => true,
    describe: {
      name: 'Calendar file import (.ics)',
      module: 'school',
      status: 'available',
      implemented: ['Import assignment due dates from an .ics file you download (many LMSs, including Canvas, offer a calendar feed).', 'Preview before importing; duplicates are skipped.', 'Imported items are labelled “Imported”.'],
      requires: ['Nothing — the file never leaves your account and no login is needed.'],
      unsupported: ['Grades and assignment weights (calendar files don’t contain them).', 'Automatic re-sync — import the file again to pick up changes.'],
      fallback: 'Manual entry in School.',
    },
  },
  {
    id: 'canvas',
    connectable: true,
    isConfigured: (cfg) => !!cfg.encryptionKey,
    describe: {
      name: 'Canvas LMS',
      module: 'school',
      status: 'available',
      implemented: [
        'Connect with a personal access token you create in Canvas (Account → Settings → New Access Token).',
        'Imports active courses, assignments due from 30 days ago onward, submission status, assignment groups and weights, scores, and Canvas’s current course grade.',
        'Sync again any time; items update instead of duplicating. Imported items are labelled “From Canvas”.',
        'The token is encrypted (AES-256-GCM), only sent to your school’s Canvas address, and never shown again.',
      ],
      requires: [
        'Your school’s Canvas address and a personal access token. Some schools turn off token creation for students — if “New Access Token” is missing, use the calendar-file import instead.',
        'Read-only use: Waypoint never submits work or changes anything in Canvas.',
      ],
      unsupported: [
        'Logging in with your Canvas password — Waypoint never asks for it.',
        'Automatic background sync — press “Sync now” to refresh.',
        'School-wide sign-in (OAuth) needs a Developer Key from your school’s Canvas admin and isn’t built yet.',
      ],
      fallback: 'Import your Canvas calendar feed (.ics) or enter assignments manually.',
    },
  },
  {
    id: 'home_access_center',
    connectable: false,
    isConfigured: () => false,
    describe: {
      name: 'Home Access Center (HAC)',
      module: 'school',
      status: 'not_supported',
      implemented: [],
      requires: ['A district-approved data-sharing method. HAC is configured per school district and there is no public, universal API.'],
      unsupported: ['Signing in with your school password or reading HAC pages automatically — that could break district rules and put your account at risk.'],
      fallback: 'Enter grades and grading categories manually; the grade calculator labels results as estimates until weights are confirmed.',
      unsupportedReason: 'There is no authorised, universal Home Access Center integration. Use manual entry instead.',
    },
  },
  {
    id: 'youtube',
    connectable: true,
    isConfigured: (cfg) => !!cfg.encryptionKey,
    describe: {
      name: 'YouTube (vetted coaching channels)',
      module: 'sports',
      status: 'available',
      implemented: [
        'Finds videos for your focus skills — but only from vetted channels (national governing bodies and established coaching channels), never all of YouTube.',
        'Each channel is checked at runtime: if its name doesn’t match what’s expected, it’s ignored.',
        'Results are cached for a week to stay within YouTube’s free daily quota. Safe search is always on.',
      ],
      requires: [
        'A free YouTube Data API key (Google Cloud Console → create a project → enable “YouTube Data API v3” → Credentials → Create API key).',
        'Your key is stored encrypted and only sent to YouTube.',
      ],
      unsupported: ['Sports without a verified channel yet (swimming, tennis, track) show official written resources instead of videos.', 'Live professional statistics — they don’t help individual training and aren’t used.'],
      fallback: 'Without a key, each sport links to its vetted channels on YouTube, plus written resources from governing bodies.',
    },
  },
  {
    id: 'anthropic',
    connectable: true,
    isConfigured: (cfg) => !!cfg.encryptionKey || !!cfg.anthropicApiKey,
    describe: {
      name: 'AI study sets (Claude by Anthropic)',
      module: 'school',
      status: 'available',
      implemented: [
        'Upload PDFs, photos of notes, Word docs, PowerPoint slides or text and get a study sheet, flashcards, a practice test and a topic list in one step.',
        'Generated content is labelled “AI-generated” and based only on the material you upload.',
        'You see the estimated cost of each study set.',
      ],
      requires: [
        'An Anthropic API key. Anthropic accounts are for adults (18+), so a parent or guardian needs to create the key and is billed for usage — usually a few cents per study set, more for long PDFs.',
        'Your key is stored encrypted and only sent to Anthropic.',
      ],
      unsupported: ['Doing graded homework for you — the AI makes study aids about the concepts instead.'],
      fallback: 'Paste notes with “term: definition” lines and Waypoint makes flashcards without AI.',
    },
  },
  {
    id: 'product_data',
    connectable: false,
    isConfigured: () => false,
    describe: {
      name: 'Product & price data',
      module: 'care',
      status: 'planned',
      implemented: ['Routines recommend product categories, not specific products.'],
      requires: ['A licensed product data provider for verified prices, availability and ingredients.'],
      unsupported: ['Prices, stock, reviews or purchase links — none are shown until real data exists.'],
      fallback: 'Category-level guidance you can match to products you already own.',
    },
  },
];
