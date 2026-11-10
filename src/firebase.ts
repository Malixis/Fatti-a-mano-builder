import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  InventoryItem,
  PartnerProfile,
  VectorElement,
  WorkshopCard,
} from './types/erp';
import {
  sanitizeInventoryItemForFirestore,
  sanitizePartnerForFirestore,
  sanitizeWorkshopForFirestore,
} from './utils/roiCalculator';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

// Scope per Google Calendar (Workspace Integration)
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
let cachedAccessToken: string | null = null;

// Recupera eventuale token OAuth se il login è avvenuto tramite signInWithRedirect (es. Safari iPad)
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      }
    }
  })
  .catch((err) => {
    console.warn('Redirect auth check:', err);
  });

// Validate connection to Firestore on boot as required by firebase-integration-rpc
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isUnauthorizedDomainError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'auth/unauthorized-domain' ||
    msg.includes('auth/unauthorized-domain')
  );
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));
  return provider;
}

export async function loginWithGoogle(): Promise<User> {
  const provider = createGoogleProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken ?? null;
    return result.user;
  } catch (error) {
    const code = (error as { code?: string })?.code || '';
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      throw new Error('Reindirizzamento al login Google in corso...');
    }
    throw error;
  }
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;
  const provider = createGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Impossibile ottenere il token OAuth per Google Calendar.');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

export function hasCachedAccessToken(): boolean {
  return Boolean(cachedAccessToken);
}

export async function logoutFirebase(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sincronizza (crea o aggiorna) l'evento del Laboratorio su Google Calendar primario dell'utente.
 */
export async function syncWorkshopToGoogleCalendar(
  workshop: WorkshopCard,
  partner?: PartnerProfile
): Promise<{ eventId: string; htmlLink: string }> {
  const accessToken = await getAccessToken();

  const dateStr = workshop.eventDate || '2026-11-19';
  const timeStr = workshop.eventStartTime || '19:30';
  const durationMinutes = Number(workshop.eventDurationMinutes) || 120;

  const startDate = new Date(`${dateStr}T${timeStr}:00`);
  const safeStart = Number.isNaN(startDate.getTime())
    ? new Date(Date.now() + 86400000)
    : startDate;
  const endDate = new Date(safeStart.getTime() + durationMinutes * 60000);

  const phasesSummary = (workshop.phases || [])
    .map((p, idx) => `${p.numberLabel || `0${idx + 1}`} - ${p.title}: ${p.description}`)
    .join('\n\n');

  const partnerSummary = partner
    ? `\n\nPartner Location: ${partner.name} (${partner.address})\nAccordo Commerciale: ${partner.commercialDealType} — ${partner.commercialDealNotes}`
    : '';

  const eventPayload = {
    summary: `Fatti a mano · ${workshop.title} (${workshop.ticketPrice}€)`,
    location: workshop.location,
    description: `${workshop.subtitle}\nTarget Partecipanti: ${workshop.targetPax} pax · Quota Locale: €${workshop.venueFeePerPax}/pax${partnerSummary}\n\nPROTOCOLLO OPERATIVO:\n${phasesSummary}`,
    start: {
      dateTime: safeStart.toISOString(),
    },
    end: {
      dateTime: endDate.toISOString(),
    },
  };

  const existingEventId = workshop.calendarEventId?.trim();
  const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  let response: Response;
  if (existingEventId) {
    response = await fetch(`${baseUrl}/${encodeURIComponent(existingEventId)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });
    if (response.status === 404) {
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });
    }
  } else {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });
  }

  if (response.status === 401) {
    cachedAccessToken = null;
    throw new Error('Sessione Google Calendar scaduta. Riprova per riautorizzare.');
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Errore Google Calendar (${response.status}): ${errText.slice(0, 160)}`);
  }

  const data = (await response.json()) as { id?: string; htmlLink?: string };
  return {
    eventId: data.id || `gcal-${Date.now()}`,
    htmlLink: data.htmlLink || 'https://calendar.google.com',
  };
}

export async function saveWorkshopToCloud(
  workshop: WorkshopCard,
  user: User,
  isNew: boolean
): Promise<void> {
  const cleanId = workshop.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `workshops/${cleanId}`;
  const sanitized = sanitizeWorkshopForFirestore(workshop, user.uid);
  try {
    await setDoc(doc(db, 'workshops', cleanId), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.WRITE, path);
  }
}

export async function deleteWorkshopFromCloud(workshopId: string): Promise<void> {
  const cleanId = workshopId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `workshops/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'workshops', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserWorkshops(
  userId: string,
  onUpdate: (workshops: WorkshopCard[]) => void
) {
  const q = query(collection(db, 'workshops'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkshopCard[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const phases =
          Array.isArray(d.phases) && d.phases.length > 0
            ? d.phases
            : [
                {
                  id: 'ph-1',
                  numberLabel: '01',
                  title: 'Setup & Allestimento Tavoli',
                  durationLabel: 'Pre-evento',
                  description: d.phase1Setup || '',
                },
                {
                  id: 'ph-2',
                  numberLabel: '02',
                  title: 'Esecuzione Tecnica & Guida Artistica',
                  durationLabel: 'Cuore del Lab',
                  description: d.phase2Execution || '',
                },
                {
                  id: 'ph-3',
                  numberLabel: '03',
                  title: 'Chiusura, Timbro & Aperitivo',
                  durationLabel: 'Social & Networking',
                  description: d.phase3Closing || '',
                },
              ];
        items.push({
          id: docSnap.id,
          title: d.title,
          subtitle: d.subtitle,
          location: d.location,
          partnerId: d.partnerId || '',
          dateLabel: d.dateLabel,
          eventDate: d.eventDate || '2026-11-19',
          eventStartTime: d.eventStartTime || '19:30',
          eventDurationMinutes: Number(d.eventDurationMinutes) || 120,
          calendarEventId: d.calendarEventId || '',
          calendarEventUrl: d.calendarEventUrl || '',
          category: d.category,
          ticketPrice: d.ticketPrice,
          venueFeePerPax: d.venueFeePerPax,
          targetPax: d.targetPax,
          calculatorLinked: d.calculatorLinked ?? true,
          phases,
          phase1Setup: d.phase1Setup || phases[0]?.description || '',
          phase2Execution: d.phase2Execution || phases[1]?.description || '',
          phase3Closing: d.phase3Closing || phases[2]?.description || '',
          materials: Array.isArray(d.materials) ? d.materials : [],
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workshops');
    }
  );
}

export async function savePartnerToCloud(
  partner: PartnerProfile,
  user: User
): Promise<void> {
  const cleanId = partner.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `partners/${cleanId}`;
  const sanitized = sanitizePartnerForFirestore(partner, user.uid);
  try {
    await setDoc(doc(db, 'partners', cleanId), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePartnerFromCloud(partnerId: string): Promise<void> {
  const cleanId = partnerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `partners/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'partners', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserPartners(
  userId: string,
  onUpdate: (partners: PartnerProfile[]) => void
) {
  const q = query(collection(db, 'partners'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PartnerProfile[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          name: d.name,
          whoTheyAre: d.whoTheyAre,
          address: d.address,
          commercialDealType: d.commercialDealType,
          commercialDealNotes: d.commercialDealNotes,
          defaultVenueFee: Number(d.defaultVenueFee) || 0,
          logoText: d.logoText || 'PARTNER',
          logoShape: d.logoShape || 'circle-seal',
          fontStyle: d.fontStyle || 'editorial-serif',
          palette: Array.isArray(d.palette) ? d.palette : ['#1A2B4C', '#B85B43', '#4A6B53'],
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'partners');
    }
  );
}

export async function saveInventoryItemToCloud(
  item: InventoryItem,
  user: User
): Promise<void> {
  const cleanId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `inventory/${cleanId}`;
  const sanitized = sanitizeInventoryItemForFirestore(item, user.uid);
  try {
    await setDoc(doc(db, 'inventory', cleanId), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInventoryItemFromCloud(itemId: string): Promise<void> {
  const cleanId = itemId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `inventory/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'inventory', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserInventory(
  userId: string,
  onUpdate: (items: InventoryItem[]) => void
) {
  const q = query(collection(db, 'inventory'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          name: d.name,
          costType: d.costType === 'fixed' ? 'fixed' : 'variable',
          unitCost: Number(d.unitCost) || 0,
          packsOrderedTotal: Number(d.packsOrderedTotal) || 1,
          piecesPerPack: Number(d.piecesPerPack) || 1,
          totalPiecesOrdered: Number(d.totalPiecesOrdered) || 1,
          piecesUsedTotal: Number(d.piecesUsedTotal) || 0,
          piecesAvailable: Number(d.piecesAvailable) || 0,
          lastWorkshopTitle: d.lastWorkshopTitle || '',
          updatedAt: d.updatedAtLabel || '',
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    }
  );
}

export async function saveTemplateToCloud(
  template: {
    id: string;
    title: string;
    presetName: string;
    width: number;
    height: number;
    backgroundColor: string;
    elements: VectorElement[];
  },
  user: User
): Promise<void> {
  const cleanId = template.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `templates/${cleanId}`;
  try {
    await setDoc(doc(db, 'templates', cleanId), {
      title: (template.title || 'Locandina Fatti a mano').slice(0, 120),
      presetName: (template.presetName || '1080x1350').slice(0, 80),
      width: Math.min(10000, Math.max(100, Number(template.width) || 1080)),
      height: Math.min(10000, Math.max(100, Number(template.height) || 1350)),
      backgroundColor: (template.backgroundColor || '#EADDCD').slice(0, 16),
      elements: (template.elements || []).slice(0, 80).map((el) => ({
        id: String(el.id).slice(0, 64),
        name: String(el.name || 'Elemento').slice(0, 80),
        type: el.type,
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
        rotation: Math.round(el.rotation || 0),
        scale: Number(el.scale || 1),
        color: el.color,
        secondaryColor: el.secondaryColor || '#B85B43',
        opacity: Number(el.opacity ?? 1),
        zIndex: Number(el.zIndex || 1),
        visible: Boolean(el.visible),
        locked: Boolean(el.locked),
        pathData: String(el.pathData || '').slice(0, 4500),
        textureType: el.textureType || 'none',
        textContent: String(el.textContent || '').slice(0, 500),
        fontStyle: el.fontStyle || 'editorial-serif',
        fontSize: Number(el.fontSize || 42),
        stampKind: el.stampKind || 'seal-fatti-a-mano',
      })),
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
