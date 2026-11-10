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
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  CanvasPresetId,
  InventoryItem,
  PartnerProfile,
  VectorElement,
  WorkshopCard,
  WorkshopPosterDesign,
} from './types/erp';
import {
  sanitizeDesignTemplateForFirestore,
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

function isNotFoundFirestoreError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'not-found' ||
    code.endsWith('/not-found') ||
    msg.includes('No document to update')
  );
}

/**
 * Esegue un salvataggio atomico conforme alle regole di immutabilità di `createdAt` e `ownerId`:
 * - Se il documento esiste già, esegue `updateDoc` mantenendo intatti `createdAt` e `ownerId`.
 * - Se il documento non esiste ancora (`not-found`), esegue `setDoc` impostando `createdAt` e `updatedAt` a `serverTimestamp()`.
 */
async function upsertCloudDoc(
  collectionName: string,
  cleanId: string,
  sanitizedPayload: Record<string, unknown>,
  isNewHint = false
): Promise<void> {
  const path = `${collectionName}/${cleanId}`;
  const docRef = doc(db, collectionName, cleanId);
  const { ownerId, ...mutableFields } = sanitizedPayload;

  if (isNewHint) {
    try {
      await setDoc(docRef, {
        ...sanitizedPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    } catch {
      // Se il documento esisteva già nonostante il flag isNewHint, procedi con updateDoc
    }
  }

  try {
    await updateDoc(docRef, {
      ...mutableFields,
      updatedAt: serverTimestamp(),
    });
  } catch (updateErr) {
    if (isNotFoundFirestoreError(updateErr)) {
      try {
        await setDoc(docRef, {
          ...sanitizedPayload,
          ownerId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (createErr) {
        handleFirestoreError(createErr, OperationType.CREATE, path);
      }
    }
    handleFirestoreError(updateErr, OperationType.UPDATE, path);
  }
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
  const sanitized = sanitizeWorkshopForFirestore(workshop, user.uid);
  await upsertCloudDoc('workshops', cleanId, sanitized, isNew);
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
        const serverUpdatedMs =
          typeof d.updatedAt?.toMillis === 'function' ? d.updatedAt.toMillis() : 0;
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
          ticketPrice: Number(d.ticketPrice) || 0,
          venueFeePerPax: Number(d.venueFeePerPax) || 0,
          targetPax: Number(d.targetPax) || 20,
          calculatorLinked: d.calculatorLinked ?? true,
          phases,
          phase1Setup: d.phase1Setup || phases[0]?.description || '',
          phase2Execution: d.phase2Execution || phases[1]?.description || '',
          phase3Closing: d.phase3Closing || phases[2]?.description || '',
          materials: Array.isArray(d.materials) ? d.materials : [],
          clientUpdatedAt: Number(d.clientUpdatedAt) || serverUpdatedMs || 1,
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
  const sanitized = sanitizePartnerForFirestore(partner, user.uid);
  await upsertCloudDoc('partners', cleanId, sanitized);
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
        const serverUpdatedMs =
          typeof d.updatedAt?.toMillis === 'function' ? d.updatedAt.toMillis() : 0;
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
          clientUpdatedAt: Number(d.clientUpdatedAt) || serverUpdatedMs || 1,
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
  const sanitized = sanitizeInventoryItemForFirestore(item, user.uid);
  await upsertCloudDoc('inventory', cleanId, sanitized);
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
        const serverUpdatedMs =
          typeof d.updatedAt?.toMillis === 'function' ? d.updatedAt.toMillis() : 0;
        items.push({
          id: docSnap.id,
          name: d.name,
          costType: d.costType === 'fixed' ? 'fixed' : 'variable',
          unitCost: Number(d.unitCost ?? d.unitCostPerPack) || 0,
          packsOrderedTotal: Number(d.packsOrderedTotal) || 1,
          piecesPerPack: Number(d.piecesPerPack) || 1,
          totalPiecesOrdered:
            Number(d.totalPiecesOrdered) ||
            (Number(d.packsOrderedTotal) || 1) * (Number(d.piecesPerPack) || 1),
          piecesUsedTotal: Number(d.piecesUsedTotal ?? d.totalPiecesUsed) || 0,
          piecesAvailable: Number(d.piecesAvailable ?? d.totalPiecesAvailable) || 0,
          lastWorkshopTitle: d.lastWorkshopTitle || '',
          updatedAt: d.updatedAtLabel || '',
          clientUpdatedAt: Number(d.clientUpdatedAt) || serverUpdatedMs || 1,
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    }
  );
}

function parseVectorElementFromCloud(raw: Record<string, unknown>): VectorElement {
  return {
    id: String(raw.id || `el-${Date.now()}`),
    name: String(raw.name || 'Elemento'),
    type: (raw.type as VectorElement['type']) || 'freehand',
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    width: Number(raw.width) || 100,
    height: Number(raw.height) || 100,
    rotation: Number(raw.rotation) || 0,
    scale: Number(raw.scale) || 1,
    color: String(raw.color || '#1A2B4C'),
    secondaryColor: String(raw.secondaryColor || '#B85B43'),
    opacity: Number(raw.opacity ?? 1),
    zIndex: Number(raw.zIndex || 1),
    visible: Boolean(raw.visible ?? true),
    locked: Boolean(raw.locked ?? false),
    pathData: String(raw.pathData || ''),
    subPaths: Array.isArray(raw.subPaths)
      ? raw.subPaths.map((sp: Record<string, unknown>) => ({
          d: String(sp.d || ''),
          fill: String(sp.fill || 'none'),
          stroke: String(sp.stroke || 'none'),
          strokeWidth: Number(sp.strokeWidth || 2),
        }))
      : undefined,
    textureType: (raw.textureType as VectorElement['textureType']) || 'none',
    textContent: String(raw.textContent || ''),
    fontStyle: (raw.fontStyle as VectorElement['fontStyle']) || 'editorial-serif',
    fontSize: Number(raw.fontSize || 42),
    stampKind: (raw.stampKind as VectorElement['stampKind']) || 'seal-fatti-a-mano',
    isHandDrawnText: Boolean(raw.isHandDrawnText ?? false),
    partnerId: String(raw.partnerId || ''),
  };
}

export async function saveTemplateToCloud(
  design: WorkshopPosterDesign,
  user: User
): Promise<void> {
  const cleanId = design.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const sanitized = sanitizeDesignTemplateForFirestore(design, user.uid);
  await upsertCloudDoc('templates', cleanId, sanitized);
}

export async function deleteTemplateFromCloud(templateId: string): Promise<void> {
  const cleanId = templateId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `templates/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'templates', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserTemplates(
  userId: string,
  onUpdate: (designs: WorkshopPosterDesign[]) => void
) {
  const q = query(collection(db, 'templates'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkshopPosterDesign[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const serverUpdatedMs =
          typeof d.updatedAt?.toMillis === 'function' ? d.updatedAt.toMillis() : 0;
        const inferredWorkshopId =
          typeof d.workshopId === 'string' && d.workshopId
            ? d.workshopId
            : docSnap.id.replace(/^tpl-/, '');
        items.push({
          id: docSnap.id,
          workshopId: inferredWorkshopId,
          title: String(d.title || 'Locandina Fatti a mano'),
          presetName: (d.presetName as CanvasPresetId) || '1080x1350',
          width: Number(d.width) || 1080,
          height: Number(d.height) || 1350,
          backgroundColor: String(d.backgroundColor || '#EADDCD'),
          partnerId: String(d.partnerId || ''),
          elements: Array.isArray(d.elements)
            ? d.elements.map((el: Record<string, unknown>) => parseVectorElementFromCloud(el))
            : [],
          clipboard: Array.isArray(d.clipboard)
            ? d.clipboard.map((el: Record<string, unknown>) => parseVectorElementFromCloud(el))
            : [],
          clientUpdatedAt: Number(d.clientUpdatedAt) || serverUpdatedMs || 1,
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'templates');
    }
  );
}
