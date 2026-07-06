"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, MapPin } from "lucide-react";
import { AuthResult, BadgeSubmissionData, submitBadge, uploadFile, getProfile, Address } from "@/lib/api";
import { formatAddress } from "@/components/ui/address-picker";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";

interface Props {
  authResult: AuthResult;
  onComplete: () => void;
}

export function BadgeSubmissionWizard({ authResult, onComplete }: Props) {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<"IDENTITY" | "LOCATION" | "COMPLETED">("IDENTITY");
  const [loading, setLoading] = useState(false);
  const [createdBadgeId, setCreatedBadgeId] = useState<string | null>(null);

  // Identity fields
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [legalName, setLegalName] = useState(authResult.user.name || "");

  // Address comes from the profile captured at registration — no map/GPS here.
  // When launched from the dashboard the caller may not carry the location, so
  // fall back to fetching the freshest profile.
  const initialAddress = (authResult.user.location as Address | null | undefined) ?? null;
  const [savedAddress, setSavedAddress] = useState<Address | null>(initialAddress);
  const [addressLoading, setAddressLoading] = useState(false);

  useEffect(() => {
    if (savedAddress && (savedAddress.label || savedAddress.country)) return;
    const token = authResult.accessToken;
    if (!token) return;
    setAddressLoading(true);
    getProfile(token)
      .then((u) => {
        const loc = (u?.location as Address | null | undefined) ?? null;
        if (loc) setSavedAddress(loc);
      })
      .catch(() => { /* leave empty → shows the "complete your profile" hint */ })
      .finally(() => setAddressLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savedAddressLabel = savedAddress
    ? (savedAddress.label || formatAddress(savedAddress))
    : "";

  const handleIdentitySubmit = () => {
    if (!photoUrl || !nationalId || !legalName) {
      toastError(t("badge_wizard.toasts.validation_error"));
      return;
    }
    setStep("LOCATION");
  };

  const handleSubmit = async () => {
    setLoading(true);
    const payload: BadgeSubmissionData = {
      photoUrl,
      nationalId,
      legalName,
      // Server reuses the profile address; we send it too for completeness.
      address: savedAddress ?? undefined,
    };
    try {
      const updatedUser = await submitBadge(payload, authResult.accessToken);
      authResult.user = updatedUser;
      
      // Update local storage so the session picks up badgeId and badgeUrl
      try {
        const raw = localStorage.getItem("user");
        const parsed = raw ? JSON.parse(raw) : {};
        localStorage.setItem("user", JSON.stringify({ ...parsed, ...updatedUser }));
      } catch (e) {
        // ignore
      }

      setCreatedBadgeId(updatedUser?.badgeId || null);
      setStep("COMPLETED");
    } catch (e: any) {
      toastError(e?.response?.data?.message || t("badge_wizard.toasts.submit_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#2a2a2a] flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">
              {step === "IDENTITY" && t("badge_wizard.identity_title")}
              {step === "LOCATION" && t("badge_wizard.location_title")}
              {step === "COMPLETED" && t("badge_wizard.completed_title")}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "IDENTITY" && t("badge_wizard.identity_subtitle")}
              {step === "LOCATION" && t("badge_wizard.location_subtitle")}
              {step === "COMPLETED" && t("badge_wizard.completed_subtitle")}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
          
          {step === "IDENTITY" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("badge_wizard.fields.photo_label")}
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingPhoto}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={async (e) => {
                      if (!e.target.files?.length) return;
                      const file = e.target.files[0];
                      setUploadingPhoto(true);
                      try {
                        const url = await uploadFile(file, authResult.accessToken);
                        setPhotoUrl(url);
                        toastSuccess(t("badge_wizard.toasts.photo_success"));
                      } catch (err) {
                        toastError(t("badge_wizard.toasts.photo_failed"));
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }}
                  />
                  <div className={`w-full bg-[#1a1a1a] border-2 border-dashed ${photoUrl ? 'border-green-500/50' : 'border-[#2a2a2a] group-hover:border-[#f97316]/50'} rounded-xl px-4 py-6 text-center transition-colors flex flex-col items-center justify-center min-h-[120px]`}>
                    {uploadingPhoto ? (
                      <Loader2 size={24} className="text-[#f97316] animate-spin mb-2" />
                    ) : photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="Uploaded" className="w-16 h-16 rounded-full object-cover mb-2 border-2 border-green-500/30" />
                    ) : (
                      <div className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center mb-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-sm font-medium text-white">
                      {uploadingPhoto ? t("badge_wizard.status.uploading") : photoUrl ? t("badge_wizard.status.photo_ready") : t("badge_wizard.status.photo_placeholder")}
                    </span>
                    {!photoUrl && !uploadingPhoto && (
                      <span className="text-xs text-gray-500 mt-1">{t("badge_wizard.status.photo_hint")}</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("badge_wizard.fields.national_id_label")}
                </label>
                <input
                  type="text"
                  placeholder="1 19... "
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("badge_wizard.fields.legal_name_label")}
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                />
              </div>

              <button
                onClick={handleIdentitySubmit}
                disabled={!photoUrl || !nationalId || !legalName}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors mt-2"
              >
                {t("badge_wizard.continue_btn")}
              </button>
            </div>
          )}

          {step === "LOCATION" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("badge_wizard.fields.address_label")}
                </label>
                {addressLoading ? (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center gap-3 text-sm text-gray-400">
                    <Loader2 size={16} className="text-[#f97316] animate-spin" />
                    {t("badge_wizard.status.address_loading")}
                  </div>
                ) : savedAddressLabel ? (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-start gap-3">
                    <MapPin size={16} className="text-[#f97316] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-white leading-snug">{savedAddressLabel}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {t("badge_wizard.status.address_hint")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 text-xs text-amber-300">
                    {t("badge_wizard.status.address_missing")}
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || addressLoading || !savedAddress}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {t("badge_wizard.submit_btn")}
              </button>
            </div>
          )}

          {step === "COMPLETED" && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="text-white font-bold text-lg">{t("badge_wizard.completed_title")}</h3>
              {createdBadgeId && (
                <p className="text-gray-400 text-sm mt-1">{t("badge_wizard.badge_id_label")} <span className="text-white font-mono font-semibold">{createdBadgeId}</span></p>
              )}
              <div className="flex flex-col gap-3 w-full mt-6">
                {createdBadgeId && (
                  <button
                    onClick={() => router.push(`/verify/${createdBadgeId}`)}
                    className="w-full bg-[#f97316] hover:bg-[#ea6a0a] text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={15} />
                    {t("badge_wizard.view_badge_btn")}
                  </button>
                )}
                <button
                  onClick={onComplete}
                  className="w-full bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-300 text-sm font-medium py-3 rounded-xl transition-colors"
                >
                  {t("badge_wizard.close_btn")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
