"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { AuthResult, BadgeSubmissionData, submitBadge, uploadFile } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

const MapPicker = dynamic(
  () => import("@/components/jobs/map-picker").then(m => m.MapPicker),
  { ssr: false, loading: () => <div className="h-[200px] rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-xs text-gray-600">Loading map…</div> }
);

interface Props {
  authResult: AuthResult;
  onComplete: () => void;
}

export function BadgeSubmissionWizard({ authResult, onComplete }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [step, setStep] = useState<"IDENTITY" | "LOCATION" | "COMPLETED">("IDENTITY");
  const [loading, setLoading] = useState(false);

  // Identity fields
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [legalName, setLegalName] = useState(authResult.user.name || "");

  // Location fields
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleIdentitySubmit = () => {
    if (!photoUrl || !nationalId || !legalName) {
      toastError("All identity fields are required.");
      return;
    }
    setStep("LOCATION");
  };

  const handleDetectLocation = () => {
    if (!("geolocation" in navigator)) {
      toastError("Geolocation not supported.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        toastError("Couldn't detect location.");
        setLoading(false);
      }
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    const payload: BadgeSubmissionData = {
      photoUrl,
      nationalId,
      legalName,
      address: { lat: coords?.lat, lng: coords?.lng, address },
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

      setStep("COMPLETED");
      setTimeout(onComplete, 1500);
    } catch (e: any) {
      toastError(e?.response?.data?.message || "Failed to submit badge information.");
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
              {step === "IDENTITY" && "Worker Identity Verification"}
              {step === "LOCATION" && "Real Address Verification"}
              {step === "COMPLETED" && "Badge Generated!"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "IDENTITY" && "Please provide your photo, National ID, and legal name"}
              {step === "LOCATION" && "Select your real address using Google Maps"}
              {step === "COMPLETED" && "Your unique badge is ready."}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
          
          {step === "IDENTITY" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Passport Photo / Selfie
                </label>
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    disabled={uploadingPhoto}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={async (e) => {
                      if (!e.target.files?.length) return;
                      const file = e.target.files[0];
                      setUploadingPhoto(true);
                      try {
                        const url = await uploadFile(file, authResult.accessToken);
                        setPhotoUrl(url);
                        toastSuccess("Photo uploaded successfully");
                      } catch (err) {
                        toastError("Failed to upload photo");
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
                      {uploadingPhoto ? "Uploading..." : photoUrl ? "Photo ready! Tap to change" : "Tap to take selfie or upload"}
                    </span>
                    {!photoUrl && !uploadingPhoto && (
                      <span className="text-xs text-gray-500 mt-1">Clear front-facing photo</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  National ID Number
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
                  Legal Name (Registered Name)
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
                Continue
              </button>
            </div>
          )}

          {step === "LOCATION" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Real Address
                </label>
                <MapPicker
                  lat={coords?.lat ?? null}
                  lng={coords?.lng ?? null}
                  onChange={(lat, lng) => setCoords({ lat, lng })}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleDetectLocation}
                    disabled={loading}
                    className="flex-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] text-gray-300 text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
                    {loading ? "Detecting…" : "Use GPS"}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Or type your address…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || (!coords && !address)}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Submit & Generate Badge
              </button>
            </div>
          )}

          {step === "COMPLETED" && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="text-white font-bold text-lg">Badge Submitted!</h3>
              <p className="text-gray-500 text-xs mt-1">Your badge ID is MPUXXX.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
