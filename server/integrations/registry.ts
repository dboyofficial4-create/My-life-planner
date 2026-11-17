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
    id: 'sports_data',
    connectable: false,
    isConfigured: () => false,
    describe: {
      name: 'Sports data source',
      module: 'sports',
      status: 'planned',
      implemented: ['Built-in general drills, labelled as general coaching practice.'],
      requires: ['Choosing a verified source (e.g. a governing body’s coaching curriculum) and confirming its licence, cost and coverage.'],
      unsupported: ['Live professional statistics — they are not evidence for individual training plans and aren’t used.'],
      fallback: 'General drills plus your own logged results.',
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
