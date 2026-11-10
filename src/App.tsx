import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CanvasPresetId,
  InventoryItem,
  PartnerProfile,
  VectorElement,
  WorkshopCard,
} from './types/erp';
import {
  INITIAL_INVENTORY,
  INITIAL_PARTNERS,
  INITIAL_POSTER_STATE,
  INITIAL_WORKSHOPS,
} from './data/seedWorkshops';
import { buildPosterFromWorkshop } from './utils/vectorMath';
import { mergeConfirmedMaterialsIntoInventory } from './utils/roiCalculator';
import { GraphicBuilder } from './components/GraphicBuilder';
import { FontTextureEngine } from './components/FontTextureEngine';
import { LabManager } from './components/LabManager';
import { SetupArchitectureView } from './components/SetupArchitectureView';
import {
  deleteInventoryItemFromCloud,
  deletePartnerFromCloud,
  deleteWorkshopFromCloud,
  loginWithGoogle,
  logoutFirebase,
  saveInventoryItemToCloud,
  savePartnerToCloud,
  saveTemplateToCloud,
  saveWorkshopToCloud,
  subscribeToAuth,
  subscribeUserInventory,
  subscribeUserPartners,
  subscribeUserWorkshops,
  syncWorkshopToGoogleCalendar,
} from './firebase';

type ActiveModuleTab = 'lab-manager' | 'graphic-builder' | 'font-engine' | 'setup-docs';

const STORAGE_KEYS = {
  WORKSHOPS: 'fatti_a_mano_workshops_v2',
  PARTNERS: 'fatti_a_mano_partners_v2',
  INVENTORY: 'fatti_a_mano_inventory_v2',
};

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveModuleTab>('lab-manager');
  const [workshops, setWorkshops] = useState<WorkshopCard[]>(() =>
    loadLocal(STORAGE_KEYS.WORKSHOPS, INITIAL_WORKSHOPS)
  );
  const [partners, setPartners] = useState<PartnerProfile[]>(() =>
    loadLocal(STORAGE_KEYS.PARTNERS, INITIAL_PARTNERS)
  );
  const [inventory, setInventory] = useState<InventoryItem[]>(() =>
    loadLocal(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY)
  );

  const [activeWorkshopId, setActiveWorkshopId] = useState<string>(
    () => workshops[0]?.id || INITIAL_WORKSHOPS[0].id
  );
  const [selectedBuilderPartnerId, setSelectedBuilderPartnerId] = useState<string>(
    () => workshops[0]?.partnerId || INITIAL_PARTNERS[0].id
  );

  const [canvasElements, setCanvasElements] = useState<VectorElement[]>(
    INITIAL_POSTER_STATE.canvasElements
  );
  const [clipboardAssets, setClipboardAssets] = useState<VectorElement[]>(
    INITIAL_POSTER_STATE.clipboardAssets
  );
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
    presetId: CanvasPresetId;
  }>({
    width: 1080,
    height: 1350,
    presetId: '1080x1350',
  });

  const [user, setUser] = useState<User | null>(null);
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
  const [bridgeBanner, setBridgeBanner] = useState<string | null>(null);

  // Salvataggio automatico su localStorage per persistenza immediata
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

  // Autenticazione Google Firebase e sincronizzazione cross-device ("Ricordati l'account")
  useEffect(() => {
    const unsubAuth = subscribeToAuth((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubWorkshops = subscribeUserWorkshops(user.uid, (cloudItems) => {
      if (cloudItems.length > 0) {
        setWorkshops(cloudItems);
        setActiveWorkshopId((prevId) =>
          cloudItems.some((w) => w.id === prevId) ? prevId : cloudItems[0].id
        );
      }
    });
    const unsubPartners = subscribeUserPartners(user.uid, (cloudPartners) => {
      if (cloudPartners.length > 0) {
        setPartners(cloudPartners);
      }
    });
    const unsubInventory = subscribeUserInventory(user.uid, (cloudInv) => {
      if (cloudInv.length > 0) {
        setInventory(cloudInv);
      }
    });
    return () => {
      unsubWorkshops();
      unsubPartners();
      unsubInventory();
    };
  }, [user]);

  const handleUpdateWorkshop = (updated: WorkshopCard) => {
    setWorkshops((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );
    if (updated.partnerId) {
      setSelectedBuilderPartnerId(updated.partnerId);
    }
    if (user) {
      saveWorkshopToCloud(updated, user, false).catch((e) => console.error(e));
    }
  };

  const handleCreateWorkshop = () => {
    const defaultPartner = partners[0];
    const newWs: WorkshopCard = {
      id: `ws-${Date.now()}`,
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
      phases: [
        {
          id: `ph-${Date.now()}-1`,
          numberLabel: '01',
          title: 'Preparazione Panetti & Postazioni Kraft',
          durationLabel: 'Pre-evento (-30 min)',
          description:
            'Preparare 20 panetti di argilla gres maculata da 350g ciascuno, ciotoline con barbottina, stecche in bosso e spugnette umide su tovagliette Kraft.',
        },
        {
          id: `ph-${Date.now()}-2`,
          numberLabel: '02',
          title: 'Modellazione Pinch Pot & Ingobbi',
          durationLabel: 'Esecuzione (70 min)',
          description:
            'Tecnica del pizzicato (Pinch Pot): apertura della sfera col pollice, assottigliamento pareti, applicazione manico organico e decorazione con ingobbi Terracotta e Blu Notte.',
        },
        {
          id: `ph-${Date.now()}-3`,
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
          id: `m-${Date.now()}-1`,
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
          id: `m-${Date.now()}-2`,
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
    setWorkshops((prev) => [...prev, newWs]);
    setActiveWorkshopId(newWs.id);
    if (user) {
      saveWorkshopToCloud(newWs, user, true).catch((e) => console.error(e));
    }
  };

  const handleDeleteWorkshop = async (id: string) => {
    if (workshops.length <= 1) return;
    const remaining = workshops.filter((w) => w.id !== id);
    setWorkshops(remaining);
    setActiveWorkshopId(remaining[0].id);
    if (user) {
      try {
        await deleteWorkshopFromCloud(id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Gestione Partner (Locale + Cloud)
  const handleSavePartner = async (partner: PartnerProfile) => {
    setPartners((prev) => {
      const exists = prev.some((p) => p.id === partner.id);
      return exists
        ? prev.map((p) => (p.id === partner.id ? partner : p))
        : [...prev, partner];
    });
    setSelectedBuilderPartnerId(partner.id);
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
    setPartners((prev) => prev.filter((p) => p.id !== partnerId));
    if (selectedBuilderPartnerId === partnerId) {
      setSelectedBuilderPartnerId('');
    }
    if (user) {
      try {
        await deletePartnerFromCloud(partnerId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Gestione Inventario Totale del Format (Locale + Cloud)
  const handleConfirmWorkshopInventory = async (workshop: WorkshopCard) => {
    const merged = mergeConfirmedMaterialsIntoInventory(
      inventory,
      workshop.materials,
      workshop.targetPax,
      workshop.title
    );
    setInventory(merged);
    if (user) {
      for (const item of merged) {
        saveInventoryItemToCloud(item, user).catch((e) => console.error(e));
      }
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== itemId));
    if (user) {
      try {
        await deleteInventoryItemFromCloud(itemId);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Sincronizzazione Google Calendar
  const handleSyncGoogleCalendar = async (
    workshop: WorkshopCard,
    partner?: PartnerProfile
  ) => {
    const res = await syncWorkshopToGoogleCalendar(workshop, partner);
    setBridgeBanner(
      `Evento "${workshop.title}" sincronizzato su Google Calendar per il ${workshop.eventDate} alle ${workshop.eventStartTime}!`
    );
    setTimeout(() => setBridgeBanner(null), 4500);
    return res;
  };

  // Modulo 3: Il Ponte Data-Binding ("Genera Locandina")
  const handleGeneratePosterBridge = (
    workshop: WorkshopCard,
    partner?: PartnerProfile
  ) => {
    const generated = buildPosterFromWorkshop(workshop, partner);
    setCanvasSize({
      width: 1080,
      height: 1350,
      presetId: '1080x1350',
    });
    if (partner) {
      setSelectedBuilderPartnerId(partner.id);
    }
    setCanvasElements(generated.canvasElements);
    setClipboardAssets(generated.clipboardAssets);
    setActiveTab('graphic-builder');
    setBridgeBanner(
      `Locandina 1080×1350 generata da "${workshop.title}" (${workshop.ticketPrice}€ · ${workshop.location})${
        partner ? ` con Brand Kit Partner "${partner.name}"` : ''
      }!`
    );
    setTimeout(() => setBridgeBanner(null), 5000);
  };

  const handleSaveWorkshopCloud = async (workshop: WorkshopCard) => {
    const syncAllForUser = async (targetUser: User) => {
      setIsSavingCloud(true);
      try {
        await saveWorkshopToCloud(workshop, targetUser, false);
        for (const p of partners) {
          await savePartnerToCloud(p, targetUser);
        }
        for (const inv of inventory) {
          await saveInventoryItemToCloud(inv, targetUser);
        }
        setBridgeBanner(
          'Schede laboratorio, Partner e Inventario Format sincronizzati sul tuo Account Google!'
        );
      } catch (e) {
        console.error(e);
      } finally {
        setIsSavingCloud(false);
        setTimeout(() => setBridgeBanner(null), 4000);
      }
    };

    if (!user) {
      try {
        const loggedUser = await loginWithGoogle();
        await syncAllForUser(loggedUser);
      } catch (e) {
        console.error(e);
      }
      return;
    }

    await syncAllForUser(user);
  };

  const handleSaveTemplateCloud = async () => {
    const currentWs =
      workshops.find((w) => w.id === activeWorkshopId) || workshops[0];
    const runSave = async (targetUser: User) => {
      setIsSavingCloud(true);
      try {
        await saveTemplateToCloud(
          {
            id: `tpl-${currentWs.id}`,
            title: `Locandina ${currentWs.title}`,
            presetName: canvasSize.presetId,
            width: canvasSize.width,
            height: canvasSize.height,
            backgroundColor: '#EADDCD',
            elements: canvasElements,
          },
          targetUser
        );
        setBridgeBanner('Template vettoriale salvato sul tuo Account Google Firebase!');
      } catch (e) {
        console.error(e);
      } finally {
        setIsSavingCloud(false);
        setTimeout(() => setBridgeBanner(null), 3500);
      }
    };

    if (!user) {
      try {
        const logged = await loginWithGoogle();
        await runSave(logged);
      } catch (e) {
        console.error(e);
      }
    } else {
      await runSave(user);
    }
  };

  const handleAuthAction = async () => {
    if (user) {
      await logoutFirebase();
    } else {
      try {
        const logged = await loginWithGoogle();
        // Al login, sincronizza subito lo stato corrente sull'account
        await handleSaveWorkshopCloud(
          workshops.find((w) => w.id === activeWorkshopId) || workshops[0]
        );
        setUser(logged);
      } catch (e) {
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

        {/* Zona 2: 4 Concise Single-Line Navigation Links */}
        <nav
          aria-label="Navigazione moduli ERP"
          className="flex items-center gap-6 text-sm font-medium text-[#1A2B4C]/80 overflow-x-auto"
        >
          <button
            type="button"
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
            onClick={() => setActiveTab('graphic-builder')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'graphic-builder'
                ? 'border-[#B85B43] text-[#1A2B4C] font-semibold'
                : 'border-transparent hover:text-[#1A2B4C]'
            }`}
          >
            Builder Grafico
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('font-engine')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'font-engine'
                ? 'border-[#B85B43] text-[#1A2B4C] font-semibold'
                : 'border-transparent hover:text-[#1A2B4C]'
            }`}
          >
            Font &amp; Texture
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('setup-docs')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'setup-docs'
                ? 'border-[#B85B43] text-[#1A2B4C] font-semibold'
                : 'border-transparent hover:text-[#1A2B4C]'
            }`}
          >
            Setup &amp; Architettura
          </button>
        </nav>

        {/* Zona 3: 1 Primary Action (Google Account Sync + Calendar OAuth) */}
        <div className="flex items-center shrink-0">
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
            onDeleteInventoryItem={handleDeleteInventoryItem}
            onSyncGoogleCalendar={handleSyncGoogleCalendar}
            onSaveWorkshopCloud={handleSaveWorkshopCloud}
            isSavingCloud={isSavingCloud}
          />
        )}

        {activeTab === 'graphic-builder' && (
          <GraphicBuilder
            elements={canvasElements}
            setElements={setCanvasElements}
            clipboard={clipboardAssets}
            setClipboard={setClipboardAssets}
            canvasSize={canvasSize}
            setCanvasSize={setCanvasSize}
            partners={partners}
            selectedPartnerId={selectedBuilderPartnerId}
            onSelectPartner={setSelectedBuilderPartnerId}
            onOpenFontModal={() => setActiveTab('font-engine')}
            onSaveTemplateCloud={handleSaveTemplateCloud}
            isSavingCloud={isSavingCloud}
          />
        )}

        {activeTab === 'font-engine' && (
          <FontTextureEngine
            canvasCenter={{
              x: Math.round(canvasSize.width / 2),
              y: Math.round(canvasSize.height / 2),
            }}
            onInsertElement={(newEl) => {
              setCanvasElements((prev) => [...prev, newEl]);
              setActiveTab('graphic-builder');
              setBridgeBanner(
                `Tracciato testuale "${newEl.name}" aggiunto al Canvas con filtro ${newEl.textureType}!`
              );
              setTimeout(() => setBridgeBanner(null), 3500);
            }}
            onAddToClipboard={(newEl) => {
              setClipboardAssets((prev) => [newEl, ...prev.slice(0, 7)]);
            }}
          />
        )}

        {activeTab === 'setup-docs' && <SetupArchitectureView />}
      </main>

      {/* Footer sobrio e funzionale */}
      <footer className="border-t border-[#1A2B4C]/10 px-6 py-4 text-xs text-[#1A2B4C]/70 flex flex-wrap items-center justify-between gap-4">
        <span>Fatti a mano — Lab &amp; Design ERP · Edutainment &amp; Craft Format</span>
        <span>
          Account Sync Cross-Device · Google Calendar · iPad Pro Apple Pencil &amp; Trackpad
        </span>
      </footer>
    </div>
  );
}
