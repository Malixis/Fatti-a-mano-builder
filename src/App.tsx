import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BrandColorHex,
  CanvasPresetId,
  ExpenseVoucher,
  ExtractedInvoiceLineItem,
  InventoryItem,
  PartnerProfile,
  VectorElement,
  WorkshopAccountingRecord,
  WorkshopCard,
  WorkshopPosterDesign,
} from './types/erp';
import {
  INITIAL_INVENTORY,
  INITIAL_PARTNERS,
  INITIAL_VOUCHERS,
  INITIAL_WORKSHOPS,
} from './data/seedWorkshops';
import {
  createDefaultWorkshopDesign,
  syncPosterElementsWithWorkshop,
} from './utils/vectorMath';
import {
  mergeConfirmedMaterialsIntoInventory,
  mergeInvoiceItemsIntoInventory,
} from './utils/roiCalculator';
import { AdministrationTab } from './components/AdministrationTab';
import { GraphicBuilder } from './components/GraphicBuilder';
import { LabManager } from './components/LabManager';
import {
  FIREBASE_AUTH_SETTINGS_URL,
  FIREBASE_PROJECT_ID,
  deleteInventoryItemFromCloud,
  deletePartnerFromCloud,
  deleteTemplateFromCloud,
  deleteVoucherFromCloud,
  deleteWorkshopFromCloud,
  isUnauthorizedDomainError,
  loginWithGoogle,
  logoutFirebase,
  saveInventoryItemToCloud,
  savePartnerToCloud,
  saveTemplateToCloud,
  saveVoucherToCloud,
  saveWorkshopToCloud,
  subscribeToAuth,
  subscribeUserInventory,
  subscribeUserPartners,
  subscribeUserTemplates,
  subscribeUserVouchers,
  subscribeUserWorkshops,
  syncWorkshopToGoogleCalendar,
} from './firebase';
import { Check, Copy, ExternalLink, ShieldAlert, X } from 'lucide-react';

type ActiveModuleTab = 'lab-manager' | 'administration' | 'graphic-builder';

const STORAGE_KEYS = {
  WORKSHOPS: 'fatti_a_mano_workshops_v3',
  PARTNERS: 'fatti_a_mano_partners_v3',
  INVENTORY: 'fatti_a_mano_inventory_v3',
  VOUCHERS: 'fatti_a_mano_vouchers_v3',
  ACCOUNTING_MAP: 'fatti_a_mano_accounting_v3',
  DESIGNS: 'fatti_a_mano_designs_v3',
  ACTIVE_WORKSHOP_ID: 'fatti_a_mano_active_ws_v3',
  // Chiavi v2 per migrazione trasparente
  LEGACY_WORKSHOPS: 'fatti_a_mano_workshops_v2',
  LEGACY_PARTNERS: 'fatti_a_mano_partners_v2',
  LEGACY_INVENTORY: 'fatti_a_mano_inventory_v2',
};

function loadLocal<T>(key: string, fallback: T, legacyKey?: string): T {
  try {
    const raw =
      window.localStorage.getItem(key) ||
      (legacyKey ? window.localStorage.getItem(legacyKey) : null);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function buildInitialDesignsMap(
  workshops: WorkshopCard[],
  partners: PartnerProfile[]
): Record<string, WorkshopPosterDesign> {
  const saved = loadLocal<Record<string, WorkshopPosterDesign> | null>(
    STORAGE_KEYS.DESIGNS,
    null
  );
  const map: Record<string, WorkshopPosterDesign> = saved ? { ...saved } : {};

  for (const ws of workshops) {
    if (!map[ws.id] || !Array.isArray(map[ws.id].elements)) {
      const partner = partners.find((p) => p.id === ws.partnerId);
      map[ws.id] = createDefaultWorkshopDesign(ws, partner, 0);
    }
  }
  return map;
}

/**
 * Unisce in modo sicuro gli elementi locali con quelli provenienti da Cloud Firestore (`onSnapshot`),
 * confrontando `clientUpdatedAt` per impedire che uno snapshot più vecchio ripristini o cancelli
 * le modifiche appena effettuate dall'utente.
 */
function mergeByTimestamp<T extends { id: string; clientUpdatedAt?: number }>(
  localList: T[],
  cloudList: T[],
  deletedIds: Set<string>
): { merged: T[]; localNewerToPush: T[] } {
  if (cloudList.length === 0) {
    const localModified = localList.filter((item) => (item.clientUpdatedAt || 0) > 0);
    return { merged: localList, localNewerToPush: localModified };
  }

  const cloudMap = new Map<string, T>();
  for (const c of cloudList) {
    if (!deletedIds.has(c.id)) {
      cloudMap.set(c.id, c);
    }
  }

  const mergedMap = new Map<string, T>();
  const localNewerToPush: T[] = [];

  // 1. Esamina gli elementi locali
  for (const localItem of localList) {
    if (deletedIds.has(localItem.id)) continue;
    const cloudItem = cloudMap.get(localItem.id);
    const localTs = Number(localItem.clientUpdatedAt) || 0;

    if (cloudItem) {
      const cloudTs = Number(cloudItem.clientUpdatedAt) || 1;
      if (localTs > cloudTs) {
        mergedMap.set(localItem.id, localItem);
        localNewerToPush.push(localItem);
      } else {
        mergedMap.set(localItem.id, cloudItem);
      }
      cloudMap.delete(localItem.id);
    } else if (localTs > 0) {
      // L'utente ha modificato o creato questo elemento in locale prima/durante la sessione: conservalo!
      mergedMap.set(localItem.id, localItem);
      localNewerToPush.push(localItem);
    }
  }

  // 2. Aggiungi tutti gli elementi presenti sul Cloud da altri dispositivi
  for (const [id, cloudItem] of cloudMap.entries()) {
    mergedMap.set(id, cloudItem);
  }

  const merged = Array.from(mergedMap.values());
  return {
    merged: merged.length > 0 ? merged : localList,
    localNewerToPush,
  };
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveModuleTab>('lab-manager');
  const [workshops, setWorkshops] = useState<WorkshopCard[]>(() =>
    loadLocal(STORAGE_KEYS.WORKSHOPS, INITIAL_WORKSHOPS, STORAGE_KEYS.LEGACY_WORKSHOPS)
  );
  const [partners, setPartners] = useState<PartnerProfile[]>(() =>
    loadLocal(STORAGE_KEYS.PARTNERS, INITIAL_PARTNERS, STORAGE_KEYS.LEGACY_PARTNERS)
  );
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    loadLocal(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY, STORAGE_KEYS.LEGACY_INVENTORY)
  );
  const [vouchers, setVouchers] = useState<ExpenseVoucher[]>(() =>
    loadLocal(STORAGE_KEYS.VOUCHERS, INITIAL_VOUCHERS)
  );
  const [accountingMap, setAccountingMap] = useState<
    Record<string, WorkshopAccountingRecord>
  >(() => loadLocal(STORAGE_KEYS.ACCOUNTING_MAP, {}));

  const [activeWorkshopId, setActiveWorkshopId] = useState<string>(() => {
    const savedId = loadLocal<string>(STORAGE_KEYS.ACTIVE_WORKSHOP_ID, '');
    if (savedId && workshops.some((w) => w.id === savedId)) {
      return savedId;
    }
    return workshops[0]?.id || INITIAL_WORKSHOPS[0].id;
  });

  // Dizionario delle locandine del Builder Grafico indicizzato per `workshopId`
  const [designsByWorkshopId, setDesignsByWorkshopId] = useState<
    Record<string, WorkshopPosterDesign>
  >(() => buildInitialDesignsMap(workshops, partners));

  const [user, setUser] = useState<User | null>(null);
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
  const [bridgeBanner, setBridgeBanner] = useState<string | null>(null);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>(
    'Salvataggio automatico attivo'
  );

  // Traccia gli ID eliminati intenzionalmente nella sessione per non ri-importarli da snapshot pendenti
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<number | null>(null);

  // Stato Modale Guidato per Errore Firebase auth/unauthorized-domain (es. su GitHub Pages)
  const [showDomainModal, setShowDomainModal] = useState<boolean>(false);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  const currentHostname =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'tuo-username.github.io';

  const handleCopyHostname = () => {
    navigator.clipboard?.writeText(currentHostname).catch(() => {});
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2200);
  };

  // Scheda attiva e locandina attiva del Builder
  const activeWorkshop = useMemo(
    () => workshops.find((w) => w.id === activeWorkshopId) || workshops[0],
    [workshops, activeWorkshopId]
  );

  const activeDesign: WorkshopPosterDesign = useMemo(() => {
    const existing = designsByWorkshopId[activeWorkshop.id];
    if (existing && Array.isArray(existing.elements)) {
      return existing;
    }
    const partner = partners.find((p) => p.id === activeWorkshop.partnerId);
    return createDefaultWorkshopDesign(activeWorkshop, partner, 0);
  }, [designsByWorkshopId, activeWorkshop, partners]);

  // Persistenza immediata su localStorage ad ogni modifica (Schede, Partner, Inventario, Vouchers, Accounting, Builder Designs)
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.WORKSHOPS, JSON.stringify(workshops));
    } catch {
      // ignore storage quota errors
    }
  }, [workshops]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(partners));
    } catch {
      // ignore
    }
  }, [partners]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
    } catch {
      // ignore
    }
  }, [inventory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.VOUCHERS, JSON.stringify(vouchers));
    } catch {
      // ignore
    }
  }, [vouchers]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.ACCOUNTING_MAP,
        JSON.stringify(accountingMap)
      );
    } catch {
      // ignore
    }
  }, [accountingMap]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.DESIGNS,
        JSON.stringify(designsByWorkshopId)
      );
    } catch {
      // ignore
    }
  }, [designsByWorkshopId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.ACTIVE_WORKSHOP_ID,
        JSON.stringify(activeWorkshopId)
      );
    } catch {
      // ignore
    }
  }, [activeWorkshopId]);

  // Pianifica un salvataggio automatico debounced su Cloud Firestore quando l'utente modifica Scheda o Builder
  const scheduleCloudAutoSave = (
    nextWorkshop?: WorkshopCard,
    nextDesign?: WorkshopPosterDesign
  ) => {
    const timeStr = formatNowTime();
    setLastSavedLabel(
      user
        ? `Salvato in automatico · Cloud (${timeStr})`
        : `Salvato in automatico · Locale (${timeStr})`
    );

    if (!user) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    const targetUser = user;
    const wsToSave = nextWorkshop;
    const designToSave = nextDesign;

    autoSaveTimerRef.current = window.setTimeout(() => {
      if (wsToSave) {
        saveWorkshopToCloud(wsToSave, targetUser, false).catch((e) =>
          console.error(e)
        );
      }
      if (designToSave) {
        saveTemplateToCloud(designToSave, targetUser).catch((e) =>
          console.error(e)
        );
      }
    }, 650);
  };

  // Helpers di mutazione per il Builder Grafico (associati alla Scheda Laboratorio attiva)
  const updateActiveDesign = (
    updater: (prev: WorkshopPosterDesign) => WorkshopPosterDesign
  ) => {
    const wsId = activeWorkshop.id;
    setDesignsByWorkshopId((prevMap) => {
      const current =
        prevMap[wsId] ||
        createDefaultWorkshopDesign(
          activeWorkshop,
          partners.find((p) => p.id === activeWorkshop.partnerId),
          0
        );
      const updated: WorkshopPosterDesign = {
        ...updater(current),
        id: `tpl-${wsId}`,
        workshopId: wsId,
        clientUpdatedAt: Date.now(),
      };
      scheduleCloudAutoSave(undefined, updated);
      return {
        ...prevMap,
        [wsId]: updated,
      };
    });
  };

  const setCanvasElements: React.Dispatch<React.SetStateAction<VectorElement[]>> = (
    action
  ) => {
    updateActiveDesign((current) => {
      const nextElements =
        typeof action === 'function' ? action(current.elements) : action;
      return {
        ...current,
        elements: nextElements,
      };
    });
  };

  const setClipboardAssets: React.Dispatch<React.SetStateAction<VectorElement[]>> = (
    action
  ) => {
    updateActiveDesign((current) => {
      const nextClipboard =
        typeof action === 'function' ? action(current.clipboard) : action;
      return {
        ...current,
        clipboard: nextClipboard,
      };
    });
  };

  const setCanvasSize: React.Dispatch<
    React.SetStateAction<{ width: number; height: number; presetId: CanvasPresetId }>
  > = (action) => {
    updateActiveDesign((current) => {
      const prevSize = {
        width: current.width,
        height: current.height,
        presetId: current.presetName,
      };
      const nextSize = typeof action === 'function' ? action(prevSize) : action;
      return {
        ...current,
        width: nextSize.width,
        height: nextSize.height,
        presetName: nextSize.presetId,
      };
    });
  };

  const setCanvasBackgroundColor = (color: BrandColorHex) => {
    updateActiveDesign((current) => ({
      ...current,
      backgroundColor: color,
    }));
  };

  const handleSelectBuilderPartner = (partnerId: string) => {
    updateActiveDesign((current) => ({
      ...current,
      partnerId,
    }));
  };

  const handleResetActiveDesignToDefault = () => {
    const partner = partners.find(
      (p) => p.id === (activeDesign.partnerId || activeWorkshop.partnerId)
    );
    const fresh = createDefaultWorkshopDesign(activeWorkshop, partner, Date.now());
    setDesignsByWorkshopId((prev) => ({
      ...prev,
      [activeWorkshop.id]: fresh,
    }));
    scheduleCloudAutoSave(undefined, fresh);
    setBridgeBanner(
      `Layout base della locandina "${activeWorkshop.title}" rigenerato dai dati della scheda.`
    );
    setTimeout(() => setBridgeBanner(null), 3500);
  };

  // Autenticazione Google Firebase e sincronizzazione cross-device ("Ricordati l'account")
  useEffect(() => {
    const unsubAuth = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setShowDomainModal(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubWorkshops = subscribeUserWorkshops(user.uid, (cloudItems) => {
      setWorkshops((prevLocal) => {
        const { merged, localNewerToPush } = mergeByTimestamp(
          prevLocal,
          cloudItems,
          deletedIdsRef.current
        );
        for (const item of localNewerToPush) {
          saveWorkshopToCloud(item, user, false).catch((e) => console.error(e));
        }
        setActiveWorkshopId((prevId) =>
          merged.some((w) => w.id === prevId) ? prevId : merged[0]?.id || prevId
        );
        return merged;
      });
    });

    const unsubPartners = subscribeUserPartners(user.uid, (cloudPartners) => {
      setPartners((prevLocal) => {
        const { merged, localNewerToPush } = mergeByTimestamp(
          prevLocal,
          cloudPartners,
          deletedIdsRef.current
        );
        for (const p of localNewerToPush) {
          savePartnerToCloud(p, user).catch((e) => console.error(e));
        }
        return merged;
      });
    });

    const unsubInventory = subscribeUserInventory(user.uid, (cloudInv) => {
      setInventory((prevLocal) => {
        const { merged, localNewerToPush } = mergeByTimestamp(
          prevLocal,
          cloudInv,
          deletedIdsRef.current
        );
        for (const inv of localNewerToPush) {
          saveInventoryItemToCloud(inv, user).catch((e) => console.error(e));
        }
        return merged;
      });
    });

    const unsubTemplates = subscribeUserTemplates(user.uid, (cloudTemplates) => {
      setDesignsByWorkshopId((prevMap) => {
        const nextMap: Record<string, WorkshopPosterDesign> = { ...prevMap };
        const toPush: WorkshopPosterDesign[] = [];

        const cloudByWsId = new Map<string, WorkshopPosterDesign>();
        for (const tpl of cloudTemplates) {
          const wsId = tpl.workshopId || tpl.id.replace(/^tpl-/, '');
          if (!deletedIdsRef.current.has(wsId) && !deletedIdsRef.current.has(tpl.id)) {
            cloudByWsId.set(wsId, { ...tpl, workshopId: wsId, id: `tpl-${wsId}` });
          }
        }

        // Confronta ogni design locale con quello Cloud
        for (const [wsId, localDesign] of Object.entries(nextMap)) {
          const cloudDesign = cloudByWsId.get(wsId);
          const localTs = Number(localDesign.clientUpdatedAt) || 0;
          if (cloudDesign) {
            const cloudTs = Number(cloudDesign.clientUpdatedAt) || 1;
            if (localTs > cloudTs) {
              nextMap[wsId] = localDesign;
              toPush.push(localDesign);
            } else {
              nextMap[wsId] = cloudDesign;
            }
            cloudByWsId.delete(wsId);
          } else if (localTs > 0) {
            toPush.push(localDesign);
          }
        }

        // Aggiungi design presenti solo sul Cloud (es. creati su iPad Pro o altro dispositivo)
        for (const [wsId, cloudDesign] of cloudByWsId.entries()) {
          nextMap[wsId] = cloudDesign;
        }

        for (const d of toPush) {
          saveTemplateToCloud(d, user).catch((e) => console.error(e));
        }

        return nextMap;
      });
    });

    const unsubVouchers = subscribeUserVouchers(user.uid, (cloudVouchers) => {
      setVouchers((prevLocal) => {
        const { merged, localNewerToPush } = mergeByTimestamp(
          prevLocal,
          cloudVouchers,
          deletedIdsRef.current
        );
        for (const v of localNewerToPush) {
          saveVoucherToCloud(v, user).catch((e) => console.error(e));
        }
        return merged;
      });
    });

    return () => {
      unsubWorkshops();
      unsubPartners();
      unsubInventory();
      unsubTemplates();
      unsubVouchers();
    };
  }, [user]);

  const handleUpdateWorkshop = (updatedRaw: WorkshopCard) => {
    const now = Date.now();
    const updated: WorkshopCard = {
      ...updatedRaw,
      clientUpdatedAt: now,
    };

    setWorkshops((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );

    const partner = partners.find((p) => p.id === updated.partnerId);

    // Aggiorna i testi collegati nella locandina di questa scheda preservando tutti i disegni e le modifiche del Builder
    setDesignsByWorkshopId((prevMap) => {
      const existing =
        prevMap[updated.id] || createDefaultWorkshopDesign(updated, partner, 0);
      const syncedDesign = syncPosterElementsWithWorkshop(
        existing,
        updated,
        partner
      );
      scheduleCloudAutoSave(updated, syncedDesign);
      return {
        ...prevMap,
        [updated.id]: syncedDesign,
      };
    });
  };

  const handleCreateWorkshop = () => {
    const now = Date.now();
    const defaultPartner = partners[0];
    const newWs: WorkshopCard = {
      id: `ws-${now}`,
      title: 'Ceramica & Calici — Tazzine Pizzicate',
      subtitle: 'Modella a mano libera la tua tazzina da caffè in gres',
      location: defaultPartner
        ? `${defaultPartner.name}, ${defaultPartner.address}`
        : 'Bottega Argilla, Via Savona 42 · Milano',
      partnerId: defaultPartner?.id || '',
      dateLabel: 'Giovedì 3 Dicembre · Ore 19:30',
      eventDate: '2026-12-03',
      eventStartTime: '19:30',
      eventDurationMinutes: 120,
      category: 'Ceramica Pinch',
      ticketPrice: 28,
      venueFeePerPax: defaultPartner?.defaultVenueFee ?? 7,
      targetPax: 20,
      calculatorLinked: true,
      clientUpdatedAt: now,
      phases: [
        {
          id: `ph-${now}-1`,
          numberLabel: '01',
          title: 'Preparazione Panetti & Postazioni Kraft',
          durationLabel: 'Pre-evento (-30 min)',
          description:
            'Preparare 20 panetti di argilla gres maculata da 350g ciascuno, ciotoline con barbottina, stecche in bosso e spugnette umide su tovagliette Kraft.',
        },
        {
          id: `ph-${now}-2`,
          numberLabel: '02',
          title: 'Modellazione Pinch Pot & Ingobbi',
          durationLabel: 'Esecuzione (70 min)',
          description:
            'Tecnica del pizzicato (Pinch Pot): apertura della sfera col pollice, assottigliamento pareti, applicazione manico organico e decorazione con ingobbi Terracotta e Blu Notte.',
        },
        {
          id: `ph-${now}-3`,
          numberLabel: '03',
          title: 'Punzonatura & Calice Conviviale',
          durationLabel: 'Chiusura (30 min)',
          description:
            'Punzonatura del fondo con timbro "Fatti a mano" e iniziali del partecipante. Aperitivo conviviale mentre le tazzine vengono catalogate per la cottura.',
        },
      ],
      phase1Setup:
        'Preparare 20 panetti di argilla gres maculata da 350g ciascuno, ciotoline con barbottina, stecche in bosso e spugnette umide su tovagliette Kraft.',
      phase2Execution:
        'Tecnica del pizzicato (Pinch Pot): apertura della sfera col pollice, assottigliamento pareti, applicazione manico organico e decorazione con ingobbi Terracotta e Blu Notte.',
      phase3Closing:
        'Punzonatura del fondo con timbro "Fatti a mano" e iniziali del partecipante. Aperitivo conviviale mentre le tazzine vengono catalogate per la cottura.',
      materials: [
        {
          id: `m-${now}-1`,
          name: 'Kit 20 mirette e stecche in legno + 20 tavolieri',
          unitCost: 4.0,
          quantity: 20,
          packsOrdered: 1,
          piecesPerPack: 20,
          costType: 'fixed',
          packed: true,
          confirmedForInventory: true,
        },
        {
          id: `m-${now}-2`,
          name: 'Argilla gres + ingobbi + quota cottura forno (per pax)',
          unitCost: 3.4,
          quantity: 1,
          packsOrdered: 1,
          piecesPerPack: 1,
          costType: 'variable',
          packed: true,
          confirmedForInventory: true,
        },
      ],
    };

    const newDesign = createDefaultWorkshopDesign(newWs, defaultPartner, now);

    setWorkshops((prev) => [...prev, newWs]);
    setDesignsByWorkshopId((prev) => ({
      ...prev,
      [newWs.id]: newDesign,
    }));
    setActiveWorkshopId(newWs.id);
    setLastSavedLabel(
      user
        ? `Salvato in automatico · Cloud (${formatNowTime()})`
        : `Salvato in automatico · Locale (${formatNowTime()})`
    );

    if (user) {
      saveWorkshopToCloud(newWs, user, true).catch((e) => console.error(e));
      saveTemplateToCloud(newDesign, user).catch((e) => console.error(e));
    }
  };

  const handleDeleteWorkshop = async (id: string) => {
    if (workshops.length <= 1) return;
    deletedIdsRef.current.add(id);
    deletedIdsRef.current.add(`tpl-${id}`);
    const remaining = workshops.filter((w) => w.id !== id);
    setWorkshops(remaining);
    setDesignsByWorkshopId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveWorkshopId(remaining[0].id);
    if (user) {
      try {
        await deleteWorkshopFromCloud(id);
        await deleteTemplateFromCloud(`tpl-${id}`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Gestione Partner (Locale + Cloud)
  const handleSavePartner = async (partnerRaw: PartnerProfile) => {
    const partner: PartnerProfile = {
      ...partnerRaw,
      clientUpdatedAt: Date.now(),
    };
    setPartners((prev) => {
      const exists = prev.some((p) => p.id === partner.id);
      return exists
        ? prev.map((p) => (p.id === partner.id ? partner : p))
        : [...prev, partner];
    });
    handleSelectBuilderPartner(partner.id);
    setBridgeBanner(
      `Partner "${partner.name}" salvato con Logo ${partner.logoText}, Font ${partner.fontStyle} e Palette ${partner.palette.join(' ')}!`
    );
    setTimeout(() => setBridgeBanner(null), 4000);

    if (user) {
      try {
        await savePartnerToCloud(partner, user);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeletePartner = async (partnerId: string) => {
    deletedIdsRef.current.add(partnerId);
    setPartners((prev) => prev.filter((p) => p.id !== partnerId));
    if (activeDesign.partnerId === partnerId) {
      handleSelectBuilderPartner('');
    }
    if (user) {
      try {
        await deletePartnerFromCloud(partnerId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Gestione Inventario Totale del Format (Locale + Cloud + Fatture Amazon)
  const handleConfirmWorkshopInventory = async (workshop: WorkshopCard) => {
    const merged = mergeConfirmedMaterialsIntoInventory(
      inventory,
      workshop.materials,
      workshop.targetPax,
      workshop.title,
      workshop.calculatorLinked ?? true
    );
    setInventory(merged);
    if (user) {
      for (const item of merged) {
        saveInventoryItemToCloud(item, user).catch((e) => console.error(e));
      }
    }
  };

  const handleUpdateInventoryItem = async (updatedItem: InventoryItem) => {
    setInventory((prev) =>
      prev.map((it) => (it.id === updatedItem.id ? updatedItem : it))
    );
    if (user) {
      try {
        await saveInventoryItemToCloud(updatedItem, user);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleImportAmazonInvoice = async (payload: {
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    items: ExtractedInvoiceLineItem[];
    workshopTitle: string;
    workshopId: string;
  }) => {
    const mergedInv = mergeInvoiceItemsIntoInventory(
      inventory,
      payload.items,
      `${payload.workshopTitle} (${payload.invoiceNumber})`
    );
    setInventory(mergedInv);

    // Calcola il totale della fattura Amazon e crea automaticamente il giustificativo di spesa per il Rimborso Spese Associativo
    const invoiceTotal = payload.items.reduce(
      (sum, it) =>
        it.selected === false
          ? sum
          : sum + Math.max(0, Number(it.unitCost) || 0) * Math.max(1, Number(it.packsOrdered) || 1),
      0
    );

    const autoVoucher: ExpenseVoucher = {
      id: `vch-amz-${Date.now()}`,
      voucherDate: payload.invoiceDate || new Date().toISOString().slice(0, 10),
      invoiceNumber: payload.invoiceNumber || `AMZ-${Date.now().toString().slice(-5)}`,
      category: 'amazon-invoice',
      description: `Fattura Amazon (${payload.items.length} articoli): ${payload.items
        .map((i) => i.name)
        .slice(0, 3)
        .join(', ')}`,
      amount: Number(invoiceTotal.toFixed(2)),
      paidBy: 'personal-advance',
      reimbursementStatus: 'pending',
      workshopId: payload.workshopId,
      partnerId: activeWorkshop.partnerId || '',
      kilometers: 0,
      kmRate: 0,
      notes: payload.supplier || 'Amazon EU S.à r.l.',
      clientUpdatedAt: Date.now(),
    };

    setVouchers((prev) => [autoVoucher, ...prev]);

    if (user) {
      for (const item of mergedInv) {
        saveInventoryItemToCloud(item, user).catch((e) => console.error(e));
      }
      saveVoucherToCloud(autoVoucher, user).catch((e) => console.error(e));
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    deletedIdsRef.current.add(itemId);
    setInventory((prev) => prev.filter((i) => i.id !== itemId));
    if (user) {
      try {
        await deleteInventoryItemFromCloud(itemId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Gestione Giustificativi Spesa / Rimborsi Associazione & Conto Economico
  const handleSaveVoucher = async (voucherRaw: ExpenseVoucher) => {
    const voucher: ExpenseVoucher = {
      ...voucherRaw,
      clientUpdatedAt: Date.now(),
    };
    setVouchers((prev) => {
      const exists = prev.some((v) => v.id === voucher.id);
      return exists
        ? prev.map((v) => (v.id === voucher.id ? voucher : v))
        : [voucher, ...prev];
    });
    if (user) {
      try {
        await saveVoucherToCloud(voucher, user);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    deletedIdsRef.current.add(voucherId);
    setVouchers((prev) => prev.filter((v) => v.id !== voucherId));
    if (user) {
      try {
        await deleteVoucherFromCloud(voucherId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleUpdateAccountingRecord = (
    workshopId: string,
    patch: Partial<WorkshopAccountingRecord>
  ) => {
    setAccountingMap((prev) => {
      const targetWs = workshops.find((w) => w.id === workshopId);
      const targetPartner = partners.find((p) => p.id === targetWs?.partnerId);
      const existing: WorkshopAccountingRecord = prev[workshopId] || {
        workshopId,
        actualPax: targetWs?.targetPax ?? 20,
        collectionMethod:
          targetPartner?.bureaucracyMode === 'partner-cashdesk-rebill'
            ? 'partner-cashdesk'
            : targetPartner?.bureaucracyMode === 'split-checkout'
            ? 'split-checkout'
            : 'association-direct',
        partnerPayoutStatus: 'pending',
        accountingNotes: '',
      };
      return {
        ...prev,
        [workshopId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  // Sincronizzazione Google Calendar
  const handleSyncGoogleCalendar = async (
    workshop: WorkshopCard,
    partner?: PartnerProfile
  ) => {
    try {
      const res = await syncWorkshopToGoogleCalendar(workshop, partner);
      setBridgeBanner(
        `Evento "${workshop.title}" sincronizzato su Google Calendar per il ${workshop.eventDate} alle ${workshop.eventStartTime}!`
      );
      setTimeout(() => setBridgeBanner(null), 4500);
      return res;
    } catch (error) {
      if (isUnauthorizedDomainError(error)) {
        setShowDomainModal(true);
        throw new Error(
          `Il dominio "${currentHostname}" deve essere aggiunto tra i Domini Autorizzati nella Firebase Console.`
        );
      }
      throw error;
    }
  };

  // Modulo 3: Il Ponte Data-Binding ("Genera Locandina")
  // Aggiorna i testi della locandina preservando eventuali disegni/livelli già creati dall'utente nel Builder!
  const handleGeneratePosterBridge = (
    workshop: WorkshopCard,
    partner?: PartnerProfile
  ) => {
    const existing = designsByWorkshopId[workshop.id];
    const nextDesign =
      existing && existing.elements.length > 0
        ? syncPosterElementsWithWorkshop(existing, workshop, partner)
        : createDefaultWorkshopDesign(workshop, partner, Date.now());

    setDesignsByWorkshopId((prev) => ({
      ...prev,
      [workshop.id]: nextDesign,
    }));
    scheduleCloudAutoSave(workshop, nextDesign);
    setActiveTab('graphic-builder');
    setBridgeBanner(
      `Locandina di "${workshop.title}" (${workshop.ticketPrice}€ · ${workshop.location}) sincronizzata nel Builder preservando tutti i tuoi livelli!`
    );
    setTimeout(() => setBridgeBanner(null), 5000);
  };

  // Salvataggio completo (Schede + Locandine Builder + Partner + Inventario) senza mai ripristinare vecchi dati
  const syncAllStateToCloud = async (
    targetUser: User,
    explicitWorkshop?: WorkshopCard
  ) => {
    setIsSavingCloud(true);
    try {
      const now = Date.now();
      const currentWorkshops = explicitWorkshop
        ? workshops.map((w) =>
            w.id === explicitWorkshop.id
              ? { ...explicitWorkshop, clientUpdatedAt: now }
              : w
          )
        : workshops;

      if (explicitWorkshop) {
        setWorkshops(currentWorkshops);
      }

      for (const ws of currentWorkshops) {
        await saveWorkshopToCloud(
          { ...ws, clientUpdatedAt: Math.max(now, ws.clientUpdatedAt || 0) },
          targetUser,
          false
        );
      }

      for (const design of Object.values(designsByWorkshopId)) {
        await saveTemplateToCloud(
          {
            ...design,
            clientUpdatedAt: Math.max(now, design.clientUpdatedAt || 0),
          },
          targetUser
        );
      }

      for (const p of partners) {
        await savePartnerToCloud(
          { ...p, clientUpdatedAt: Math.max(now, p.clientUpdatedAt || 0) },
          targetUser
        );
      }

      for (const inv of inventory) {
        await saveInventoryItemToCloud(
          { ...inv, clientUpdatedAt: Math.max(now, inv.clientUpdatedAt || 0) },
          targetUser
        );
      }

      const timeStr = formatNowTime();
      setLastSavedLabel(`Sincronizzato su Cloud (${timeStr})`);
      setBridgeBanner(
        'Schede Laboratorio, Locandine del Builder Grafico, Partner e Inventario salvati sul tuo Account Google!'
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingCloud(false);
      setTimeout(() => setBridgeBanner(null), 4000);
    }
  };

  const handleSaveWorkshopCloud = async (workshop: WorkshopCard) => {
    const now = Date.now();
    const stamped: WorkshopCard = { ...workshop, clientUpdatedAt: now };
    setWorkshops((prev) =>
      prev.map((w) => (w.id === stamped.id ? stamped : w))
    );
    setLastSavedLabel(`Salvato in locale (${formatNowTime()})`);

    if (!user) {
      try {
        const loggedUser = await loginWithGoogle();
        await syncAllStateToCloud(loggedUser, stamped);
      } catch (e) {
        if (isUnauthorizedDomainError(e)) {
          setShowDomainModal(true);
          return;
        }
        setBridgeBanner(
          'Modifiche salvate nella memoria locale del dispositivo. Connetti il tuo Account Google per sincronizzarle tra dispositivi.'
        );
        setTimeout(() => setBridgeBanner(null), 4000);
      }
      return;
    }

    await syncAllStateToCloud(user, stamped);
  };

  const handleSaveTemplateCloud = async () => {
    const now = Date.now();
    const stampedDesign: WorkshopPosterDesign = {
      ...activeDesign,
      clientUpdatedAt: now,
    };
    setDesignsByWorkshopId((prev) => ({
      ...prev,
      [activeWorkshop.id]: stampedDesign,
    }));
    setLastSavedLabel(`Salvato in locale (${formatNowTime()})`);

    if (!user) {
      try {
        const logged = await loginWithGoogle();
        await syncAllStateToCloud(logged);
      } catch (e) {
        if (isUnauthorizedDomainError(e)) {
          setShowDomainModal(true);
          return;
        }
        setBridgeBanner(
          'Locandina del Builder salvata nella memoria locale del dispositivo. Accedi con Google per ritrovarla su altri dispositivi.'
        );
        setTimeout(() => setBridgeBanner(null), 4000);
      }
    } else {
      await syncAllStateToCloud(user);
    }
  };

  const handleAuthAction = async () => {
    if (user) {
      await logoutFirebase();
    } else {
      try {
        const logged = await loginWithGoogle();
        setUser(logged);
        await syncAllStateToCloud(logged);
      } catch (e) {
        if (isUnauthorizedDomainError(e)) {
          setShowDomainModal(true);
          return;
        }
        console.error(e);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EADDCD] text-[#1A2B4C]">
      {/* Top Bar Contract: 3 Zone (Brand Title | 4 Nav Links | 1 Primary Action) */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-[#F4ECE1] border-b border-[#1A2B4C]/15 sticky top-0 z-30">
        {/* Zona 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('lab-manager');
          }}
          className="text-xl font-bold tracking-tight text-[#1A2B4C] whitespace-nowrap shrink-0"
          style={{ fontFamily: '"Fraunces", Georgia, serif' }}
        >
          Fatti a mano
        </a>

        {/* Zona 2: 3 Navigation Links (Lab Manager ERP · Amministrazione · Builder Grafico) */}
        <nav
          aria-label="Navigazione moduli ERP"
          className="flex items-center gap-6 text-sm font-medium text-[#1A2B4C]/80 overflow-x-auto"
        >
          <button
            type="button"
            data-testid="nav-tab-lab-manager"
            onClick={() => setActiveTab('lab-manager')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'lab-manager'
                ? 'border-[#B85B43] text-[#1A2B4C] font-semibold'
                : 'border-transparent hover:text-[#1A2B4C]'
            }`}
          >
            Lab Manager ERP
          </button>

          <button
            type="button"
            data-testid="nav-tab-administration"
            onClick={() => setActiveTab('administration')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'administration'
                ? 'border-[#B85B43] text-[#1A2B4C] font-semibold'
                : 'border-transparent hover:text-[#1A2B4C]'
            }`}
          >
            Amministrazione
          </button>

          <button
            type="button"
            data-testid="nav-tab-graphic-builder"
            onClick={() => setActiveTab('graphic-builder')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'graphic-builder'
                ? 'border-[#B85B43] text-[#1A2B4C] font-semibold'
                : 'border-transparent hover:text-[#1A2B4C]'
            }`}
          >
            Builder Grafico
          </button>
        </nav>

        {/* Zona 3: 1 Primary Action (Google Account Sync + Calendar OAuth) */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={handleAuthAction}
              className="px-3.5 py-2 text-xs font-semibold text-[#EADDCD] bg-[#1A2B4C] rounded-lg hover:bg-[#1A2B4C]/90 transition-colors whitespace-nowrap shrink-0"
              title="Clicca per disconnettere. Tutte le modifiche sono salvate sul tuo account Google."
            >
              Account: {user.displayName?.split(' ')[0] || user.email || 'Connesso'} · Cloud Attivo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAuthAction}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Accedi con Google</span>
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Notifica contestuale del Ponte Data-Binding o Cloud Sync */}
      {bridgeBanner && (
        <div
          role="status"
          className="bg-[#4A6B53] text-[#EADDCD] px-6 py-2.5 text-xs font-semibold flex items-center justify-between"
        >
          <span>{bridgeBanner}</span>
          <button
            type="button"
            onClick={() => setBridgeBanner(null)}
            className="underline ml-4 whitespace-nowrap"
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Contenuto Principale Full-Viewport (1440px container) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'lab-manager' && (
          <LabManager
            workshops={workshops}
            activeWorkshopId={activeWorkshopId}
            onSelectWorkshop={setActiveWorkshopId}
            onUpdateWorkshop={handleUpdateWorkshop}
            onCreateWorkshop={handleCreateWorkshop}
            onDeleteWorkshop={handleDeleteWorkshop}
            onGeneratePosterBridge={handleGeneratePosterBridge}
            partners={partners}
            onSavePartner={handleSavePartner}
            onDeletePartner={handleDeletePartner}
            inventory={inventory}
            onConfirmWorkshopInventory={handleConfirmWorkshopInventory}
            onUpdateInventoryItem={handleUpdateInventoryItem}
            onImportAmazonInvoice={handleImportAmazonInvoice}
            onDeleteInventoryItem={handleDeleteInventoryItem}
            onSyncGoogleCalendar={handleSyncGoogleCalendar}
            onSaveWorkshopCloud={handleSaveWorkshopCloud}
            isSavingCloud={isSavingCloud}
            lastSavedLabel={lastSavedLabel}
          />
        )}

        {activeTab === 'administration' && (
          <AdministrationTab
            workshops={workshops}
            partners={partners}
            onSavePartner={handleSavePartner}
            vouchers={vouchers}
            onSaveVoucher={handleSaveVoucher}
            onDeleteVoucher={handleDeleteVoucher}
            accountingMap={accountingMap}
            onUpdateAccountingRecord={handleUpdateAccountingRecord}
          />
        )}

        {activeTab === 'graphic-builder' && (
          <GraphicBuilder
            elements={activeDesign.elements}
            setElements={setCanvasElements}
            clipboard={activeDesign.clipboard}
            setClipboard={setClipboardAssets}
            canvasSize={{
              width: activeDesign.width,
              height: activeDesign.height,
              presetId: activeDesign.presetName,
            }}
            setCanvasSize={setCanvasSize}
            backgroundColor={activeDesign.backgroundColor}
            setBackgroundColor={setCanvasBackgroundColor}
            workshops={workshops}
            activeWorkshopId={activeWorkshopId}
            onSelectWorkshop={setActiveWorkshopId}
            onResetToWorkshopDefault={handleResetActiveDesignToDefault}
            partners={partners}
            selectedPartnerId={activeDesign.partnerId || activeWorkshop.partnerId || ''}
            onSelectPartner={handleSelectBuilderPartner}
            onSavePartner={handleSavePartner}
            onSaveTemplateCloud={handleSaveTemplateCloud}
            isSavingCloud={isSavingCloud}
            lastSavedLabel={lastSavedLabel}
          />
        )}
      </main>

      {/* Modale Assistente Automatico per Autorizzare il Dominio GitHub su Firebase (auth/unauthorized-domain) */}
      {showDomainModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="firebase-domain-modal-title"
          className="fixed inset-0 z-50 bg-[#1A2B4C]/65 flex items-center justify-center p-4"
        >
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/25 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1A2B4C]/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#B85B43]" />
                <h3
                  id="firebase-domain-modal-title"
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Autorizza il Dominio GitHub su Firebase Auth
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDomainModal(false)}
                className="p-1 text-[#1A2B4C]/60 hover:text-[#1A2B4C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#1A2B4C]/85 leading-relaxed">
              Per consentire l&apos;accesso col tuo account Google da <strong>GitHub Pages</strong> (errore{' '}
              <code className="font-mono bg-[#EADDCD] px-1 py-0.5 rounded text-[#B85B43]">
                auth/unauthorized-domain
              </code>
              ), devi aggiungere una sola volta il tuo dominio tra i <strong>Domini Autorizzati</strong> del progetto Firebase{' '}
              <code className="font-mono font-bold">{FIREBASE_PROJECT_ID}</code>:
            </p>

            {/* Step 1: Copia il dominio corrente */}
            <div className="p-3.5 bg-[#EADDCD] rounded-xl border border-[#1A2B4C]/15 space-y-2">
              <div className="text-xs font-bold text-[#1A2B4C]">
                1. Copia il dominio da autorizzare (senza https:// né percorsi):
              </div>
              <div className="flex items-center justify-between gap-2 bg-[#F4ECE1] px-3 py-2 rounded-lg border border-[#1A2B4C]/20">
                <code className="text-xs font-mono font-bold text-[#1A2B4C] select-all">
                  {currentHostname}
                </code>
                <button
                  type="button"
                  data-testid="copy-detected-domain-btn"
                  onClick={handleCopyHostname}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1A2B4C] text-[#EADDCD] rounded text-[11px] font-semibold hover:bg-[#1A2B4C]/90"
                >
                  {copiedDomain ? (
                    <>
                      <Check className="w-3 h-3 text-[#D4A373]" />
                      <span>Copiato</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copia Dominio</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 2: Apri la console Firebase */}
            <div className="p-3.5 bg-[#EADDCD] rounded-xl border border-[#1A2B4C]/15 space-y-2">
              <div className="text-xs font-bold text-[#1A2B4C]">
                2. Incolla il dominio in Firebase Console &rarr; Authorized domains:
              </div>
              <p className="text-[11px] text-[#1A2B4C]/80 leading-relaxed">
                Clicca sul pulsante qui sotto, scorri fino a <strong>Domini autorizzati (Authorized domains)</strong>, premi <strong>Aggiungi dominio (Add domain)</strong> e incolla{' '}
                <code className="font-mono font-bold">{currentHostname}</code>.
              </p>
              <a
                href={FIREBASE_AUTH_SETTINGS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#B85B43] text-[#EADDCD] rounded-lg text-xs font-semibold hover:bg-[#a04c36] transition-colors"
              >
                <span>Apri Firebase Console (Domini Autorizzati)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDomainModal(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#1A2B4C] bg-[#EADDCD] hover:bg-[#1A2B4C]/10"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDomainModal(false);
                  handleAuthAction();
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1A2B4C] text-[#EADDCD] hover:bg-[#1A2B4C]/90"
              >
                Riprova Accesso con Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer sobrio e funzionale */}
      <footer className="border-t border-[#1A2B4C]/10 px-6 py-4 text-xs text-[#1A2B4C]/70 flex flex-wrap items-center justify-between gap-4">
        <span>Fatti a mano — Lab &amp; Design ERP · Edutainment &amp; Craft Format</span>
        <button
          type="button"
          data-testid="open-domain-helper-footer-btn"
          onClick={() => setShowDomainModal(true)}
          className="underline hover:text-[#1A2B4C] font-medium"
        >
          Configura Dominio Autorizzato Firebase / GitHub Pages
        </button>
      </footer>
    </div>
  );
}
