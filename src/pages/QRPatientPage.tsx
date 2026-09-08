/**
 * Public QR code patient information page
 * This page is accessible without authentication and displays limited patient info
 */
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { User, MapPin, AlertTriangle, ArrowLeft } from "lucide-react";
import { Card, Btn, Banner, Spinner, EmptyState } from "../components/ui";
import { rq } from "../lib/http";

interface PatientQRInfo {
  id: string;
  rak_id: string;
  name: string;
  age: number;
  gender: string;
  village: string;
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

    // Public endpoint: must not clear the session on 401.
    rq<PatientQRInfo>("GET", `/qr/patient/${patientId}`, { public: true })
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
                  <span className="capitalize">{(patient.gender ?? "").toLowerCase()}</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600">{patient.village}</span>
            </div>
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
