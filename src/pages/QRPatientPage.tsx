/**
 * Public QR code patient information page
 * This page is accessible without authentication and displays limited patient info
 */
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User, Phone, MapPin, Heart, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Card, Btn, Banner, Spinner, EmptyState } from "../components/ui";
import { rq } from "../lib/http";

interface PatientQRInfo {
  id: string;
  rak_id: string;
  name: string;
  age: number;
  gender: string;
  village: string;
  phone: string;
  emergency_contact: string;
  emergency_phone: string;
  blood_group: string | null;
  conditions: string[];
  allergies: string[];
}

export function QRPatientPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<PatientQRInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setError("No patient ID provided");
      setLoading(false);
      return;
    }

    // Fetch patient info from public QR endpoint (no authentication required)
    rq<PatientQRInfo>("GET", `/qr/patient/${patientId}`)
      .then((data) => {
        setPatient(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch patient info:", err);
        setError(err instanceof Error ? err.message : "Failed to load patient information");
        setLoading(false);
      });
  }, [patientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Spinner label="Loading patient information..." />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <EmptyState
            icon={<AlertTriangle className="h-12 w-12 text-rose-500" />}
            title="Patient Not Found"
            hint={error || "The patient information could not be loaded."}
            action={
              <Link to="/">
                <Btn variant="secondary">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Home
                </Btn>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-950">
              Patient Information
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Scanned via RAKSHA QR Code
            </p>
          </div>
          <Link to="/">
            <Btn variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Home
            </Btn>
          </Link>
        </div>

        {/* Patient Card */}
        <Card>
          <div className="space-y-4">
            {/* Patient Identity */}
            <div className="flex items-start gap-4 pb-4 border-b border-brand-900/10">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-white">
                <User className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl font-bold text-brand-950">
                  {patient.name}
                </h2>
                <p className="font-mono text-xs text-brand-600 mt-1">
                  {patient.rak_id}
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                  <span>{patient.age} years</span>
                  <span>•</span>
                  <span className="capitalize">{patient.gender.toLowerCase()}</span>
                  {patient.blood_group && (
                    <>
                      <span>•</span>
                      <span className="font-semibold">{patient.blood_group}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">{patient.village}</span>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600">{patient.phone || "No phone number"}</span>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 text-sm">
                    Emergency Contact
                  </h3>
                  <p className="text-sm text-amber-800 mt-1">
                    {patient.emergency_contact}
                  </p>
                  <p className="text-sm text-amber-700">
                    {patient.emergency_phone}
                  </p>
                </div>
              </div>
            </div>

            {/* Medical Conditions */}
            {patient.conditions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-slate-400" />
                  <h3 className="font-semibold text-brand-950 text-sm">
                    Known Conditions
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patient.conditions.map((condition, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-800"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Allergies */}
            {patient.allergies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <h3 className="font-semibold text-rose-900 text-sm">
                    Allergies
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patient.allergies.map((allergy, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-medium text-rose-800"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Important Notice */}
        <Banner tone="info">
          <p className="text-sm">
            <strong>Privacy Notice:</strong> This page displays only basic identification 
            information. Full medical records require authenticated access by authorized 
            healthcare providers.
          </p>
        </Banner>
      </div>
    </div>
  );
}
