"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, MapPin } from "lucide-react";
import { AuthResult, BadgeSubmissionData, submitBadge, uploadFile, getProfile, Address } from "@/lib/api";
import { formatAddress } from "@/components/ui/address-picker";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import { detectFaceInFile } from "@/lib/face-check";
import { compressImage, isSupportedImage, MAX_UPLOAD_BYTES } from "@/lib/image";
import { CameraCapture } from "@/components/ui/camera-capture";
import { ImageCropper } from "@/components/ui/image-cropper";

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
  const [cameraOpen, setCameraOpen] = useState(false);
  // Every photo is aligned in the cropper before it is checked and uploaded, so a
  // badge always prints a square, centred portrait.
  const [cropFile, setCropFile] = useState<File | null>(null);
  // Defaults to accepted - the badge photo doubles as the profile picture unless declined.
  const [usePhotoOnProfile, setUsePhotoOnProfile] = useState(true);
  const [nationalId, setNationalId] = useState("");
  const [legalName, setLegalName] = useState(authResult.user.name || "");

  // Address comes from the profile captured at registration - no map/GPS here.
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

  /** National ID must carry at least 10 digits (separators/spaces don't count). */
  const idDigits = nationalId.replace(/\D/g, "").length;
  const idValid = idDigits >= 10;

  /**
   * Step 1 - accept or reject the photo BEFORE the cropper opens.
   *
   * Checking after cropping meant someone could carefully frame a picture and only
   * then be told it has no usable face. Format, size and face are settled first;
   * only an accepted photo reaches the aligner.
   */
  const acceptPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      if (!isSupportedImage(file)) {
        toastError(t("badge_wizard.errors.bad_format")
          || "That file isn't a supported image. Use a JPG or PNG photo.");
        return;
      }
      let ready = file;
      try {
        ready = await compressImage(file);
      } catch {
        toastError(t("badge_wizard.errors.bad_format")
          || "That file isn't a supported image. Use a JPG or PNG photo.");
        return;
      }
      if (ready.size > MAX_UPLOAD_BYTES) {
        toastError(t("badge_wizard.errors.too_large")
          || "This photo is too large even after compression. Try another one.");
        return;
      }

      const verdict = await detectFaceInFile(ready);
      if (verdict === "no-face") {
        toastError(t("badge_wizard.toasts.no_face")
          || "No face detected in this photo. Use a clear, well-lit photo of your face.");
        return;
      }
      if (verdict === "unclear") {
        toastError(t("badge_wizard.errors.face_unclear")
          || "Your face isn't clear enough. Move closer, hold still and use good lighting.");
        return;
      }
      if (verdict === "multiple") {
        toastError(t("badge_wizard.errors.face_multiple")
          || "More than one face is in this photo. Use a photo of just you.");
        return;
      }

      // Accepted - now let them position it.
      setCropFile(ready);
    } finally {
      setUploadingPhoto(false);
    }
  };

  /**
   * Step 2 - upload the cropped result. Format, size and face were already settled
   * in acceptPhoto, and the crop re-encodes to a small square JPEG, so this only
   * needs a final size guard before sending.
   */
  const handlePhotoFile = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const ready = file.size > MAX_UPLOAD_BYTES ? await compressImage(file) : file;
      if (ready.size > MAX_UPLOAD_BYTES) {
        toastError(t("badge_wizard.errors.too_large")
          || "This photo is too large even after compression. Try another one.");
        return;
      }
      const url = await uploadFile(ready, authResult.accessToken);
      setPhotoUrl(url);
      toastSuccess(t("badge_wizard.toasts.photo_success"));
    } catch (err: any) {
      toastError(uploadErrorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  };

  /** Turn an upload failure into something the user can act on. */
  const uploadErrorMessage = (err: any): string => {
    const status = err?.response?.status;
    if (status === 413) {
      return t("badge_wizard.errors.too_large")
        || "This photo is too large even after compression. Try another one.";
    }
    if (status === 401 || status === 403) {
      return t("badge_wizard.errors.session")
        || "Your session expired. Please sign in again and retry.";
    }
    if (status && status >= 500) {
      return t("badge_wizard.errors.server")
        || "Our server couldn't save the photo. Please try again in a moment.";
    }
    if (!err?.response) {
      // No response at all: offline, or the proxy rejected the body before CORS
      // headers were added (the classic opaque 413).
      return typeof navigator !== "undefined" && navigator.onLine === false
        ? (t("badge_wizard.errors.offline") || "You appear to be offline. Check your connection and try again.")
        : (t("badge_wizard.errors.network") || "Upload failed - the photo may be too large or the connection dropped. Try again.");
    }
    return err?.response?.data?.message
      || t("badge_wizard.toasts.photo_failed")
      || "Photo upload failed. Please try again.";
  };

  const handleIdentitySubmit = () => {
    if (!photoUrl || !nationalId || !legalName) {
      toastError(t("badge_wizard.toasts.validation_error"));
      return;
    }
    if (!idValid) {
      toastError(t("badge_wizard.errors.national_id_min")
        || "The ID number must have at least 10 digits.");
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
      usePhotoOnProfile,
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
      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(f) => acceptPhoto(f)}
        title={t("badge_wizard.fields.take_photo") || "Take your photo"}
      />
      <ImageCropper
        open={!!cropFile}
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onCropped={(cropped) => { setCropFile(null); handlePhotoFile(cropped); }}
      />
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
                    onChange={(e) => {
                      if (!e.target.files?.length) return;
                      const file = e.target.files[0];
                      e.target.value = ""; // rejecting then re-picking the same file must re-fire
                      acceptPhoto(file); // validate first; the cropper opens only if accepted
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

                {/* Real in-app camera (getUserMedia) - works on desktop and mobile,
                    unlike <input capture> which many browsers ignore. */}
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => setCameraOpen(true)}
                  className={`mt-2 flex items-center justify-center gap-2 w-full border border-[#2a2a2a] rounded-xl py-2.5 text-xs font-semibold transition-colors ${uploadingPhoto ? "text-gray-600 cursor-not-allowed" : "text-gray-300 hover:border-[#f97316]/60 hover:text-white cursor-pointer"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("badge_wizard.fields.take_photo") || "Take a photo with the camera"}
                </button>

                {/* Re-open the aligner on the photo already chosen, without re-picking it. */}
                {photoUrl && !uploadingPhoto && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(photoUrl);
                        const blob = await res.blob();
                        setCropFile(new File([blob], "badge-photo.jpg", { type: blob.type || "image/jpeg" }));
                      } catch {
                        toastError(t("badge_wizard.errors.reedit")
                          || "Couldn't open that photo for editing. Pick or take it again.");
                      }
                    }}
                    className="mt-2 flex items-center justify-center gap-2 w-full border border-[#2a2a2a] rounded-xl py-2.5 text-xs font-semibold text-gray-300 hover:border-[#f97316]/60 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t("badge_wizard.fields.edit_photo") || "Reposition or crop this photo"}
                  </button>
                )}

                {/* Consent for this photo to double as the public profile picture. */}
                {photoUrl && (
                  <label className="flex items-start gap-2.5 mt-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={usePhotoOnProfile}
                      onChange={(e) => setUsePhotoOnProfile(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#f97316] cursor-pointer shrink-0"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-gray-200">
                        {t("badge_wizard.fields.photo_on_profile_label") || "Use this photo as my profile picture"}
                      </span>
                      <span className="block text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {t("badge_wizard.fields.photo_on_profile_hint")
                          || "Employers will see it on your public profile. It stays on your badge either way, and you can change this later in Settings."}
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("badge_wizard.fields.national_id_label")}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="1 19... "
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className={`w-full bg-[#1a1a1a] border rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors ${nationalId && !idValid ? "border-red-500/60 focus:border-red-500" : "border-[#2a2a2a] focus:border-[#f97316]"}`}
                />
                {nationalId && !idValid && (
                  <p className="text-[11px] text-red-400 mt-1.5">
                    {t("badge_wizard.errors.national_id_min") || "The ID number must have at least 10 digits."}
                  </p>
                )}
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
                disabled={!photoUrl || !idValid || !legalName}
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
