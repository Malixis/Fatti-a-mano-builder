import React, { useMemo, useState } from 'react';
import {
  ExpenseVoucher,
  ExpenseVoucherCategory,
  FormatBalanceSheetMetrics,
  PartnerBureaucracyMode,
  PartnerProfile,
  WorkshopAccountingRecord,
  WorkshopCard,
} from '../types/erp';
import {
  calculateFormatBalanceSheet,
  calculateWorkshopRoi,
} from '../utils/roiCalculator';
import { exportAssociationExpenseNotePdf } from '../utils/pdfExporter';
import { requestAccountingAgentAdvice } from '../utils/aiClient';
import {
  Building2,
  Car,
  CheckCircle2,
  Clock,
  FileDown,
  FileSpreadsheet,
  Landmark,
  Plus,
  Receipt,
  Send,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';

interface AdministrationTabProps {
  workshops: WorkshopCard[];
  partners: PartnerProfile[];
  onSavePartner: (partner: PartnerProfile) => void;
  vouchers: ExpenseVoucher[];
  onSaveVoucher: (voucher: ExpenseVoucher) => void;
  onDeleteVoucher: (voucherId: string) => void;
  accountingMap: Record<string, WorkshopAccountingRecord>;
  onUpdateAccountingRecord: (
    workshopId: string,
    patch: Partial<WorkshopAccountingRecord>
  ) => void;
}

const BUREAUCRACY_LABELS: Record<PartnerBureaucracyMode, string> = {
  'association-receipt':
    'Incasso Associazione (Ricevuta Associativa) + Scontrino F&B Partner',
  'partner-cashdesk-rebill':
    'Incasso Cassa Partner + Nota di Debito / Quietanza Associazione',
  'split-checkout':
    'Doppio Pagamento Separato (Quota Lab a Associazione + Drink al Bar)',
};

const VOUCHER_CATEGORY_LABELS: Record<ExpenseVoucherCategory, string> = {
  'amazon-invoice': 'Fattura Amazon / Fornitore',
  'materials-receipt': 'Scontrino Materiali / Belle Arti',
  'mileage-reimbursement': 'Rimborso Chilometrico ACI',
  'partner-settlement': 'Ricevuta / Fattura Partner F&B',
  other: 'Altra Spesa Documentata Format',
};

export const AdministrationTab: React.FC<AdministrationTabProps> = ({
  workshops,
  partners,
  onSavePartner,
  vouchers,
  onSaveVoucher,
  onDeleteVoucher,
  accountingMap,
  onUpdateAccountingRecord,
}) => {
  // Stato nome beneficiario per PDF Nota Rimborso Spese Associativa
  const [beneficiaryName, setBeneficiaryName] = useState<string>(
    'Mattias Balzani (Socio Operativo / Format Creator)'
  );
  const [associationName, setAssociationName] = useState<string>(
    'Associazione Culturale — Gestione Format Fatti a mano'
  );

  // Stato Form Nuovo Giustificativo / Spesa / Rimborso Chilometrico
  const [vchCategory, setVchCategory] =
    useState<ExpenseVoucherCategory>('amazon-invoice');
  const [vchDate, setVchDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [vchSupplierNotes, setVchSupplierNotes] = useState<string>('Amazon EU S.à r.l.');
  const [vchInvoiceNum, setVchInvoiceNum] = useState<string>('');
  const [vchDescription, setVchDescription] = useState<string>('');
  const [vchAmount, setVchAmount] = useState<string>('35.00');
  const [vchWorkshopId, setVchWorkshopId] = useState<string>(
    workshops[0]?.id || ''
  );
  const [vchKm, setVchKm] = useState<string>('40');
  const [vchRateKm, setVchRateKm] = useState<string>('0.45');

  // Stato Agente Contabile IA Low-Token
  const [agentQuestion, setAgentQuestion] = useState<string>('');
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);

  const balanceMetrics: FormatBalanceSheetMetrics = useMemo(
    () => calculateFormatBalanceSheet(workshops, vouchers, accountingMap),
    [workshops, vouchers, accountingMap]
  );

  const handleCategoryChange = (nextCat: ExpenseVoucherCategory) => {
    setVchCategory(nextCat);
    if (nextCat === 'mileage-reimbursement') {
      const km = Math.max(1, Number(vchKm) || 40);
      const rate = Math.max(0.1, Number(vchRateKm) || 0.45);
      setVchSupplierNotes('Rimborso Chilometrico ACI (Auto Propria)');
      setVchAmount((km * rate).toFixed(2));
      if (!vchDescription) {
        setVchDescription(
          `Trasferta A/R trasporto materiali e allestimento laboratorio (${km} km × ${rate.toFixed(2)}€/km)`
        );
      }
    } else if (
      nextCat === 'amazon-invoice' &&
      vchSupplierNotes.includes('Chilometrico')
    ) {
      setVchSupplierNotes('Amazon EU S.à r.l.');
    }
  };

  const handleMileageChange = (nextKm: string, nextRate: string) => {
    setVchKm(nextKm);
    setVchRateKm(nextRate);
    const km = Math.max(0, Number(nextKm) || 0);
    const rate = Math.max(0, Number(nextRate) || 0);
    setVchAmount((km * rate).toFixed(2));
  };

  const handleAddVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.max(0, Number(vchAmount) || 0);
    if (parsedAmount <= 0) return;

    const kmNum =
      vchCategory === 'mileage-reimbursement'
        ? Math.max(1, Number(vchKm) || 1)
        : 0;
    const rateNum =
      vchCategory === 'mileage-reimbursement'
        ? Math.max(0.1, Number(vchRateKm) || 0.45)
        : 0;

    const linkedWs =
      workshops.find((w) => w.id === vchWorkshopId) || workshops[0];

    const newVoucher: ExpenseVoucher = {
      id: `vch-${Date.now()}`,
      voucherDate: vchDate || new Date().toISOString().slice(0, 10),
      invoiceNumber:
        vchInvoiceNum.trim() ||
        `DOC-${new Date().toISOString().slice(5, 10).replace('-', '')}`,
      category: vchCategory,
      description:
        vchDescription.trim() ||
        (vchCategory === 'mileage-reimbursement'
          ? `Rimborso chilometrico trasferta laboratorio (${kmNum} km)`
          : 'Acquisto materiali di consumo e attrezzatura laboratorio'),
      amount: Number(parsedAmount.toFixed(2)),
      paidBy: 'personal-advance',
      reimbursementStatus: 'pending',
      workshopId: linkedWs?.id || '',
      partnerId: linkedWs?.partnerId || '',
      kilometers: kmNum,
      kmRate: rateNum,
      notes: vchSupplierNotes.trim() || 'Anticipo Socio Operativo',
      clientUpdatedAt: Date.now(),
    };

    onSaveVoucher(newVoucher);
    setVchInvoiceNum('');
    setVchDescription('');
  };

  const handleToggleVoucherStatus = (v: ExpenseVoucher) => {
    onSaveVoucher({
      ...v,
      reimbursementStatus:
        v.reimbursementStatus === 'reimbursed' ? 'pending' : 'reimbursed',
      clientUpdatedAt: Date.now(),
    });
  };

  const handleAskAccountingAgent = async (customPrompt?: string) => {
    const q = (customPrompt ?? agentQuestion).trim();
    if (!q) return;
    setAgentLoading(true);
    setAgentError(null);
    if (customPrompt) {
      setAgentQuestion(customPrompt);
    }

    try {
      const partnerModesSummary = partners
        .map(
          (p) =>
            `${p.name}: quota ${p.defaultVenueFee}€/pax, modalità=${
              p.bureaucracyMode || 'association-receipt'
            } (${p.fiscalNotes || p.commercialDealNotes})`
        )
        .join(' | ');

      const res = await requestAccountingAgentAdvice({
        question: q,
        balanceSummary: balanceMetrics,
        partnerModesSummary,
      });
      setAgentReply(res.answer);
    } catch (err) {
      setAgentError(
        err instanceof Error
          ? err.message
          : 'Errore durante la consultazione contabile.'
      );
    } finally {
      setAgentLoading(false);
    }
  };

  const uncoveredCash = Math.max(
    0,
    balanceMetrics.associationCashResidualAfterReimbursements -
      balanceMetrics.totalPersonalAdvancesPending
  );

  return (
    <div className="space-y-6" data-testid="administration-tab-root">
      {/* Intestazione Modulo Amministrazione & Bilancio d'Esercizio */}
      <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-[#B85B43]" />
            <h1
              className="text-xl font-bold text-[#1A2B4C]"
              style={{ fontFamily: '"Fraunces", serif' }}
            >
              Amministrazione, Bilancio d&apos;Esercizio &amp; Rimborsi Associazione
            </h1>
          </div>
          <p className="text-xs text-[#1A2B4C]/75">
            Gestione contabile per chi opera senza Partita IVA tramite Associazione: controllo cassa, ripartizione Partner F&amp;B e prelievo tramite Rimborsi Spese a piè di lista e Chilometrici ACI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="export-expense-note-pdf-btn"
            onClick={() =>
              exportAssociationExpenseNotePdf(
                vouchers,
                balanceMetrics,
                beneficiaryName
              )
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A2B4C] text-[#EADDCD] text-xs font-semibold rounded-lg hover:bg-[#1A2B4C]/90 transition-colors"
          >
            <FileDown className="w-4 h-4 text-[#D4A373]" />
            <span>Scarica Nota Rimborso Spese PDF</span>
          </button>
        </div>
      </div>

      {/* 4-Card KPI Strip Contabile (Bilancio d'Esercizio in Tempo Reale) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1A2B4C]/70">
            <span>1. Entrate Lorde Format</span>
            <FileSpreadsheet className="w-4 h-4 text-[#1A2B4C]/60" />
          </div>
          <div
            data-testid="admin-kpi-gross-revenue"
            className="text-2xl font-bold font-mono tabular-nums text-[#1A2B4C]"
          >
            €{balanceMetrics.totalGrossRevenue.toFixed(2)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[#B85B43]">
            Quote Locali Partner: -€{balanceMetrics.totalPartnerVenueShare.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1A2B4C]/70">
            <span>2. Entrata Netta Associazione</span>
            <Landmark className="w-4 h-4 text-[#4A6B53]" />
          </div>
          <div
            data-testid="admin-kpi-assoc-net"
            className="text-2xl font-bold font-mono tabular-nums text-[#4A6B53]"
          >
            €{balanceMetrics.totalAssociationNetRevenue.toFixed(2)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[#1A2B4C]/70">
            Cassa disponibile: €
            {balanceMetrics.associationCashResidualAfterReimbursements.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-[#1A2B4C]/70">
            <span>3. Spese Documentate Totali</span>
            <Receipt className="w-4 h-4 text-[#B85B43]" />
          </div>
          <div
            data-testid="admin-kpi-documented-expenses"
            className="text-2xl font-bold font-mono tabular-nums text-[#1A2B4C]"
          >
            €{balanceMetrics.totalVouchersDocumented.toFixed(2)}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[#1A2B4C]/70">
            Già rimborsate: €{balanceMetrics.totalPersonalAdvancesReimbursed.toFixed(2)} · In attesa: €
            {balanceMetrics.totalPersonalAdvancesPending.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#1A2B4C] text-[#EADDCD] rounded-xl p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#EADDCD]/80">
            <span>4. Prelevabile Ora (Rimborso Spese)</span>
            <Wallet className="w-4 h-4 text-[#D4A373]" />
          </div>
          <div
            data-testid="admin-kpi-claimable-now"
            className="text-2xl font-bold font-mono tabular-nums text-[#D4A373]"
          >
            €{balanceMetrics.maxClaimableReimbursementNow.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#EADDCD]/80">
            {uncoveredCash > 0
              ? `Servono altri €${uncoveredCash.toFixed(2)} di pezze/km per azzerare la cassa`
              : 'Tutte le entrate associative sono coperte da giustificativi'}
          </div>
        </div>
      </div>

      {/* Griglia Principale: Consuntivo Bilancio + Registro Rimborsi (Sinistra 7 col) | Modalità Partner + AI Agent (Destra 5 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonna Sinistra (lg:col-span-7): Conto Economico Eventi & Registro Rimborsi Spese Associativi */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Conto Economico / Bilancio d'Esercizio per Laboratorio */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A2B4C]/10 pb-3">
              <div>
                <h2
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Bilancio d&apos;Esercizio · Conto Economico per Evento
                </h2>
                <p className="text-xs text-[#1A2B4C]/70">
                  Verifica gli incassi reali, le quote spettanti al Partner e la liquidità che entra nella cassa dell&apos;Associazione
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-[#EADDCD] text-[#1A2B4C]">
                Quote Partner da Saldare: €{balanceMetrics.pendingPartnerSettlementsTotal.toFixed(2)}
              </span>
            </div>

            <div className="overflow-x-auto border border-[#1A2B4C]/15 rounded-lg bg-[#EADDCD]/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1A2B4C]/15 bg-[#EADDCD] text-[#1A2B4C]">
                    <th className="py-2.5 px-3 font-semibold">Laboratorio &amp; Partner</th>
                    <th className="py-2.5 px-2 font-semibold text-center">Pax Reali</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Incasso Lordo</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Quota Partner</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Netto Assoc.</th>
                    <th className="py-2.5 px-2.5 font-semibold">Flusso Incasso &amp; Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2B4C]/10">
                  {workshops.map((ws) => {
                    const partner = partners.find((p) => p.id === ws.partnerId);
                    const rec: WorkshopAccountingRecord = accountingMap[ws.id] || {
                      workshopId: ws.id,
                      actualPax: ws.targetPax,
                      collectionMethod:
                        partner?.bureaucracyMode === 'partner-cashdesk-rebill'
                          ? 'partner-cashdesk'
                          : partner?.bureaucracyMode === 'split-checkout'
                          ? 'split-checkout'
                          : 'association-direct',
                      partnerPayoutStatus: 'pending',
                      accountingNotes: '',
                    };
                    const pax = Math.max(0, Number(rec.actualPax ?? ws.targetPax));
                    const gross = pax * ws.ticketPrice;
                    const partnerCut = pax * ws.venueFeePerPax;
                    const assocNet = Math.max(0, gross - partnerCut);
                    const roi = calculateWorkshopRoi(
                      ws.materials,
                      ws.ticketPrice,
                      ws.venueFeePerPax,
                      pax,
                      ws.calculatorLinked ?? true
                    );

                    return (
                      <tr key={ws.id} className="hover:bg-[#EADDCD]/80">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#1A2B4C]">{ws.title}</div>
                          <div className="text-[11px] text-[#1A2B4C]/70">
                            {partner ? partner.name : ws.location} · Biglietto €{ws.ticketPrice}
                          </div>
                          <div className="text-[10px] font-mono text-[#4A6B53]">
                            Materiali S1: €{(roi.fixedCostsTotal + roi.totalVariableMaterialsCost).toFixed(2)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={pax}
                            onChange={(e) =>
                              onUpdateAccountingRecord(ws.id, {
                                actualPax: Math.max(0, Number(e.target.value)),
                              })
                            }
                            aria-label={`Partecipanti effettivi per ${ws.title}`}
                            className="w-14 px-1.5 py-1 text-center font-mono font-bold bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-[#1A2B4C]"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-[#1A2B4C]">
                          €{gross.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[#B85B43]">
                          <div>-€{partnerCut.toFixed(2)}</div>
                          <span className="text-[10px] text-[#1A2B4C]/60">
                            ({ws.venueFeePerPax.toFixed(2)}€/pax)
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-[#4A6B53]">
                          +€{assocNet.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2.5 space-y-1">
                          <select
                            value={rec.collectionMethod}
                            onChange={(e) =>
                              onUpdateAccountingRecord(ws.id, {
                                collectionMethod: e.target
                                  .value as WorkshopAccountingRecord['collectionMethod'],
                              })
                            }
                            aria-label={`Modalità incasso per ${ws.title}`}
                            className="w-full px-2 py-1 text-[10px] font-semibold bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-[#1A2B4C]"
                          >
                            <option value="association-direct">
                              Incassa Associazione → Paga Partner
                            </option>
                            <option value="partner-cashdesk">
                              Incassa Cassa Partner → Nota Associazione
                            </option>
                            <option value="split-checkout">
                              Incasso Separato (Lab + Drink al Bar)
                            </option>
                          </select>

                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateAccountingRecord(ws.id, {
                                  partnerPayoutStatus:
                                    rec.partnerPayoutStatus === 'settled'
                                      ? 'pending'
                                      : 'settled',
                                })
                              }
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                rec.partnerPayoutStatus === 'settled'
                                  ? 'bg-[#4A6B53]/20 text-[#4A6B53]'
                                  : 'bg-[#B85B43]/20 text-[#B85B43]'
                              }`}
                            >
                              {rec.partnerPayoutStatus === 'settled'
                                ? 'Quota Partner Saldata'
                                : 'Quota Partner da Saldare'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Registro Rimborsi Spese a Piè di Lista & Rimborso Chilometrico ACI (Come prelevare dall'Associazione senza P.IVA) */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1A2B4C]/10 pb-3">
              <div>
                <h2
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Registro Giustificativi &amp; Rimborsi Spese Socio (Senza Partita IVA)
                </h2>
                <p className="text-xs text-[#1A2B4C]/70">
                  Ogni fattura Amazon, scontrino materiali o trasferta chilometrica anticipata da te ti permette di trasferire legalmente liquidità dal conto dell&apos;Associazione al tuo conto personale come <strong>Rimborso Spese Documentato (esente IRPEF)</strong>.
                </p>
              </div>
            </div>

            {/* Configurazione Intestazione Nota Spese Associativa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#EADDCD]/70 rounded-xl border border-[#1A2B4C]/15">
              <div>
                <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                  Socio / Operatore Beneficiario del Rimborso
                </label>
                <input
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#1A2B4C] mb-1">
                  Ente / Associazione Erogante
                </label>
                <input
                  type="text"
                  value={associationName}
                  onChange={(e) => setAssociationName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                />
              </div>
            </div>

            {/* Form Inserimento Nuovo Giustificativo o Rimborso Chilometrico ACI */}
            <form
              onSubmit={handleAddVoucher}
              className="p-3.5 bg-[#EADDCD] rounded-xl border border-[#1A2B4C]/15 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1A2B4C]">
                  Aggiungi Pezza Giustificativa o Calcola Rimborso Chilometrico ACI
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('amazon-invoice')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                      vchCategory !== 'mileage-reimbursement'
                        ? 'bg-[#1A2B4C] text-[#EADDCD]'
                        : 'bg-[#F4ECE1] text-[#1A2B4C]'
                    }`}
                  >
                    Fattura / Scontrino
                  </button>
                  <button
                    type="button"
                    data-testid="switch-mileage-calculator-btn"
                    onClick={() => handleCategoryChange('mileage-reimbursement')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold ${
                      vchCategory === 'mileage-reimbursement'
                        ? 'bg-[#B85B43] text-[#EADDCD]'
                        : 'bg-[#F4ECE1] text-[#1A2B4C]'
                    }`}
                  >
                    <Car className="w-3 h-3" />
                    <span>Calcolatore Km ACI</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    Categoria Spesa
                  </label>
                  <select
                    value={vchCategory}
                    onChange={(e) =>
                      handleCategoryChange(
                        e.target.value as ExpenseVoucherCategory
                      )
                    }
                    className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                  >
                    {Object.entries(VOUCHER_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    Data Documento
                  </label>
                  <input
                    type="date"
                    value={vchDate}
                    onChange={(e) => setVchDate(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono text-[#1A2B4C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    Fornitore / Note
                  </label>
                  <input
                    type="text"
                    value={vchSupplierNotes}
                    onChange={(e) => setVchSupplierNotes(e.target.value)}
                    placeholder="Amazon EU, Belle Arti..."
                    className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    N° Fattura / Ricevuta
                  </label>
                  <input
                    type="text"
                    value={vchInvoiceNum}
                    onChange={(e) => setVchInvoiceNum(e.target.value)}
                    placeholder="Es. IT-AMZ-9021"
                    className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono text-[#1A2B4C]"
                  />
                </div>
              </div>

              {vchCategory === 'mileage-reimbursement' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 bg-[#F4ECE1] rounded-lg border border-[#B85B43]/30">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                      Distanza A/R Percorsa (km)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={vchKm}
                      onChange={(e) => handleMileageChange(e.target.value, vchRateKm)}
                      className="w-full px-2 py-1 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded text-xs font-mono font-bold text-[#1A2B4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                      Tariffa ACI (€/km)
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.05}
                      value={vchRateKm}
                      onChange={(e) => handleMileageChange(vchKm, e.target.value)}
                      className="w-full px-2 py-1 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded text-xs font-mono font-bold text-[#1A2B4C]"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-semibold text-[#4A6B53]">
                      Totale Rimborso Trasferta:
                    </span>
                    <span className="text-sm font-mono font-bold text-[#1A2B4C]">
                      €{vchAmount} ({vchKm} km × {vchRateKm}€)
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    Descrizione Analitica (per Nota Rimborso Spese)
                  </label>
                  <input
                    type="text"
                    value={vchDescription}
                    onChange={(e) => setVchDescription(e.target.value)}
                    placeholder="Es. Acquisto 30 tele 30x40 + trasporto A/R..."
                    className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    Laboratorio Collegato
                  </label>
                  <select
                    value={vchWorkshopId}
                    onChange={(e) => setVchWorkshopId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                  >
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                    Importo (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={vchAmount}
                    onChange={(e) => setVchAmount(e.target.value)}
                    aria-label="Importo giustificativo spesa"
                    className="w-full px-2 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-mono font-bold text-[#1A2B4C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    data-testid="add-voucher-submit-btn"
                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-[#1A2B4C] text-[#EADDCD] rounded text-xs font-semibold hover:bg-[#1A2B4C]/90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registra</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Tabella Giustificativi & Rimborsi */}
            <div className="overflow-x-auto border border-[#1A2B4C]/15 rounded-lg bg-[#EADDCD]/50">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1A2B4C]/15 bg-[#EADDCD] text-[#1A2B4C]">
                    <th className="py-2 px-2.5 font-semibold">Data &amp; Doc.</th>
                    <th className="py-2 px-2.5 font-semibold">Fornitore &amp; Descrizione</th>
                    <th className="py-2 px-2 font-semibold text-right">Importo</th>
                    <th className="py-2 px-2.5 font-semibold text-center">Stato Rimborso</th>
                    <th className="py-2 px-2 font-semibold text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2B4C]/10">
                  {vouchers.map((v) => {
                    const isReimbursed = v.reimbursementStatus === 'reimbursed';
                    return (
                      <tr key={v.id} className="hover:bg-[#EADDCD]/80">
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <div className="font-mono font-semibold text-[#1A2B4C]">
                            {v.voucherDate}
                          </div>
                          <div className="text-[10px] font-mono text-[#1A2B4C]/65">
                            {v.invoiceNumber}
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-[#1A2B4C]">
                            {v.notes || 'Fornitore Materiali'}{' '}
                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-[#1A2B4C]/10 text-[#1A2B4C]">
                              {VOUCHER_CATEGORY_LABELS[v.category]}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={v.description}
                            onChange={(e) =>
                              onSaveVoucher({
                                ...v,
                                description: e.target.value,
                                clientUpdatedAt: Date.now(),
                              })
                            }
                            aria-label={`Descrizione giustificativo ${v.invoiceNumber}`}
                            className="w-full bg-transparent text-[11px] text-[#1A2B4C]/80 focus:outline-none focus:underline mt-0.5"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-[#1A2B4C] whitespace-nowrap">
                          €{v.amount.toFixed(2)}
                        </td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleVoucherStatus(v)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                              isReimbursed
                                ? 'bg-[#4A6B53]/20 text-[#4A6B53]'
                                : 'bg-[#B85B43]/20 text-[#B85B43]'
                            }`}
                          >
                            {isReimbursed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Rimborsato</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>Da Rimborsare</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteVoucher(v.id)}
                            aria-label={`Elimina giustificativo ${v.invoiceNumber}`}
                            className="p-1 text-[#B85B43] hover:bg-[#B85B43]/15 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Colonna Destra (lg:col-span-5): Modalità Burocratiche Partner + AI Agent Contabile Low-Token */}
        <div className="lg:col-span-5 space-y-6">
          {/* 3. Modalità Burocratiche e Pagamenti per ciascun Partner */}
          <div className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1A2B4C]/10 pb-3">
              <Building2 className="w-5 h-5 text-[#B85B43]" />
              <div>
                <h2
                  className="text-base font-bold text-[#1A2B4C]"
                  style={{ fontFamily: '"Fraunces", serif' }}
                >
                  Modalità Burocratiche &amp; Incasso per Partner
                </h2>
                <p className="text-xs text-[#1A2B4C]/70">
                  Ogni locale partner ha regole diverse su scontrini, POS e fatturazione: imposta qui il flusso concordato.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {partners.map((partner) => {
                const mode = partner.bureaucracyMode || 'association-receipt';
                return (
                  <div
                    key={partner.id}
                    className="p-3.5 bg-[#EADDCD]/80 rounded-xl border border-[#1A2B4C]/15 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-[#1A2B4C]">
                          {partner.name}
                        </div>
                        <div className="text-[11px] text-[#1A2B4C]/70">
                          Quota F&amp;B: <strong>€{partner.defaultVenueFee.toFixed(2)}/pax</strong> · {partner.commercialDealType}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1A2B4C] text-[#EADDCD]">
                        {partner.logoText}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                        Procedura Burocratica / Incasso Biglietti
                      </label>
                      <select
                        value={mode}
                        onChange={(e) =>
                          onSavePartner({
                            ...partner,
                            bureaucracyMode: e.target
                              .value as PartnerBureaucracyMode,
                          })
                        }
                        aria-label={`Modalità burocratica per ${partner.name}`}
                        className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs font-semibold text-[#1A2B4C]"
                      >
                        {Object.entries(BUREAUCRACY_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-[#1A2B4C] mb-1">
                        Note Fiscali &amp; Accordo Pagamento col Locale
                      </label>
                      <textarea
                        rows={2}
                        value={partner.fiscalNotes ?? partner.commercialDealNotes}
                        onChange={(e) =>
                          onSavePartner({
                            ...partner,
                            fiscalNotes: e.target.value,
                          })
                        }
                        placeholder="Specifica chi batte lo scontrino, quando si salda la quota F&B..."
                        className="w-full px-2.5 py-1.5 bg-[#F4ECE1] border border-[#1A2B4C]/20 rounded text-xs text-[#1A2B4C]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Agente IA Contabile & Fiscale Low-Token (Speciale Associazione senza P.IVA) */}
          <div
            data-testid="accounting-ai-agent-box"
            className="bg-[#F4ECE1] border border-[#1A2B4C]/15 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#1A2B4C]/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#4A6B53]" />
                <div>
                  <h2
                    className="text-base font-bold text-[#1A2B4C]"
                    style={{ fontFamily: '"Fraunces", serif' }}
                  >
                    Agente IA Contabile · Associazione &amp; Rimborsi
                  </h2>
                  <p className="text-[11px] text-[#1A2B4C]/70">
                    Motore leggero Low-Token configurato per la tua gestione tramite Associazione (senza P.IVA)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#4A6B53]/15 text-[#4A6B53]">
                Flash Low-Token
              </span>
            </div>

            {/* Domande Rapide Pre-impostate */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#1A2B4C]/65">
                Domande Rapide sul tuo Bilancio Attuale:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Come posso prelevare i soldi in cassa tramite rimborso spese?',
                  'Come gestisco i pagamenti col Partner se incassa lui alla cassa?',
                  'Quali spese e km posso inserire nella Nota di Rimborso Associativa?',
                ].map((presetQ) => (
                  <button
                    key={presetQ}
                    type="button"
                    onClick={() => handleAskAccountingAgent(presetQ)}
                    disabled={agentLoading}
                    className="text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#EADDCD] hover:bg-[#1A2B4C] hover:text-[#EADDCD] text-[#1A2B4C] transition-colors"
                  >
                    {presetQ}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Domanda Libera */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskAccountingAgent();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                data-testid="accounting-agent-input"
                value={agentQuestion}
                onChange={(e) => setAgentQuestion(e.target.value)}
                placeholder="Chiedi all'Agente Contabile (es. Come rimborso la fattura Amazon?)..."
                className="flex-1 px-3 py-2 bg-[#EADDCD] border border-[#1A2B4C]/20 rounded-lg text-xs text-[#1A2B4C]"
              />
              <button
                type="submit"
                data-testid="accounting-agent-submit-btn"
                disabled={agentLoading || !agentQuestion.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1A2B4C] text-[#EADDCD] rounded-lg text-xs font-semibold hover:bg-[#1A2B4C]/90 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>{agentLoading ? 'Analisi...' : 'Chiedi'}</span>
              </button>
            </form>

            {agentError && (
              <div
                role="alert"
                className="p-2.5 bg-[#B85B43]/15 text-[#B85B43] rounded-lg text-xs"
              >
                {agentError}
              </div>
            )}

            {agentReply && (
              <div
                data-testid="accounting-agent-reply"
                className="p-3.5 bg-[#EADDCD]/90 rounded-xl border border-[#1A2B4C]/15 space-y-2 text-xs text-[#1A2B4C]"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#4A6B53]">
                  Risposta Agente Contabile Associazione:
                </div>
                <p className="leading-relaxed font-medium whitespace-pre-line">
                  {agentReply}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
