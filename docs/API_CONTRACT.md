# API Contract

## Current Error Envelope

API errors use this envelope for authentication, authorization, configuration, and validation failures:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message.",
    "details": null
  }
}
```

FastAPI request validation failures use `code: VALIDATION_ERROR` and include a list of field errors in `details`.

## Current Endpoints

### Health Check

HTTP Method: `GET`

Path: `/health`

Authentication: None

Required Role: None

Request: No body.

Validation: No request parameters.

Response:

```json
{
  "service": "raksha-backend",
  "status": "ok",
  "version": "0.1.0",
  "docs_ready": true
}
```

Errors:

- `500 CONFIGURATION_ERROR` through the standard error envelope if an unexpected application configuration error is raised.

Database Effects:

- None.

Workflow Effects:

- None.

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

### Login

HTTP Method: `POST`

Path: `/auth/login`

Authentication: None

Required Role: None

Request:

```json
{
  "email": "doctor@raksha.test",
  "password": "doctor-password"
}
```

Validation:

- `email` is required and must match a basic email shape.
- `password` is required, 1 to 256 characters.

Response:

```json
{
  "token_type": "bearer",
  "access_token": "raksha.v1...",
  "expires_in": 1800,
  "user": {
    "id": "00000000-0000-4000-8000-000000000902",
    "email": "doctor@raksha.test",
    "full_name": "Doctor User",
    "role": "DOCTOR",
    "is_active": true
  }
}
```

Errors:

- `401 INVALID_CREDENTIALS`
- `403 USER_INACTIVE`
- `422 VALIDATION_ERROR`
- `500 CONFIGURATION_ERROR` when `RAKSHA_TOKEN_SECRET` is not configured.

Database Effects:

- Reads `users`.
- Writes `audit_logs` for login success, invalid credentials, or inactive-user login attempt when using the SQLAlchemy audit sink.

Workflow Effects:

- None.

Example:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/auth/login -ContentType application/json -Body '{"email":"doctor@raksha.test","password":"doctor-password"}'
```

### Current User

HTTP Method: `GET`

Path: `/auth/me`

Authentication: Bearer token.

Required Role: Any active authenticated user.

Request: No body.

Validation:

- `Authorization: Bearer <token>` header is required.

Response:

```json
{
  "id": "00000000-0000-4000-8000-000000000902",
  "email": "doctor@raksha.test",
  "full_name": "Doctor User",
  "role": "DOCTOR",
  "is_active": true
}
```

Errors:

- `401 AUTH_REQUIRED`
- `401 INVALID_AUTH_SCHEME`
- `401 INVALID_TOKEN`
- `401 INVALID_TOKEN_SUBJECT`
- `403 USER_INACTIVE`

Database Effects:

- Reads `users`.

Workflow Effects:

- None.

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/auth/me -Headers @{Authorization="Bearer <token>"}
```

### List Users

HTTP Method: `GET`

Path: `/users`

Authentication: Bearer token.

Required Role: `ADMIN`.

Request: No body.

Validation:

- `Authorization: Bearer <token>` header is required.
- Server-side RBAC requires the authenticated user role to be `ADMIN`.

Response:

```json
{
  "users": [
    {
      "id": "00000000-0000-4000-8000-000000000901",
      "email": "admin@raksha.test",
      "full_name": "Admin User",
      "role": "ADMIN",
      "is_active": true
    }
  ]
}
```

Errors:

- `401 AUTH_REQUIRED`
- `401 INVALID_TOKEN`
- `403 INSUFFICIENT_ROLE`
- `403 USER_INACTIVE`

Database Effects:

- Reads `users`.
- Writes `audit_logs` with action `USER_LIST_ACCESSED` when using the SQLAlchemy audit sink.

Workflow Effects:

- None.

Example:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/users -Headers @{Authorization="Bearer <admin-token>"}
```

### Respiratory Risk Triage

HTTP Method: `POST`

Path: `/triage/respiratory-risk`

Authentication: Bearer token.

Required Role: `FRONTLINE_WORKER`, `DOCTOR`, `FACILITY_COORDINATOR`, or `ADMIN`.

Purpose:
Clinical decision support for acute respiratory risk routing. This endpoint does not diagnose, prescribe, or make autonomous clinical decisions.

Request:

```json
{
  "patient_id": "00000000-0000-4000-8000-000000000001",
  "encounter_id": "00000000-0000-4000-8000-000000000202",
  "symptom_report_id": "00000000-0000-4000-8000-000000000301",
  "age_months": 485,
  "symptoms": {
    "cough": true,
    "breathlessness": true,
    "fever": true,
    "chest_pain": false,
    "symptom_days": 3,
    "worsening_after_improvement": false
  },
  "vitals": {
    "respiratory_rate": 32,
    "spo2": 91,
    "temperature_c": 38.4,
    "pulse": 112
  },
  "danger_signs": {
    "severe_respiratory_distress": false,
    "cyanosis": false,
    "confusion_or_unresponsive": false,
    "seizures": false,
    "unable_to_drink_or_feed": false,
    "chest_indrawing": false,
    "persistent_chest_pain_or_pressure": false,
    "not_urinating": false,
    "severe_weakness": true
  },
  "comorbidities": ["asthma"]
}
```

Validation:

- `patient_id` is required.
- UUID fields must be valid UUIDs.
- `age_months` must be 0 to 1560 when supplied.
- `respiratory_rate` must be 0 to 120 when supplied.
- `spo2` must be 0 to 100 when supplied.
- `temperature_c` must be 25 to 45 when supplied.
- `pulse` must be 0 to 260 when supplied.
- Unknown request fields are rejected.

Response:

```json
{
  "assessment_id": "00000000-0000-4000-8000-000000000901",
  "model_name": "raksha-respiratory-risk-logistic-baseline",
  "model_version": "2026-09-04.v0",
  "assessed_at": "2026-09-04T12:30:00Z",
  "risk_level": "URGENT",
  "confidence": 0.97,
  "explanation": "Clinical decision support only; not a diagnosis. Human review is required before any clinical decision.",
  "human_review_required": true,
  "clinical_decision_support_only": true,
  "diagnosis": null,
  "treatment_recommendation": null,
  "structured_output": {
    "risk_level": "URGENT",
    "risk_score": 0.97,
    "urgent_review_required": true,
    "prompt_review_required": true,
    "recommended_action": "Route immediately for urgent clinician review or emergency escalation per local protocol.",
    "reasons": ["Severe weakness or unsteadiness is present."],
    "safety_flags": ["SEVERE_WEAKNESS"],
    "missing_inputs": [],
    "feature_contributions": [
      {
        "feature": "danger_signs.severe_weakness",
        "contribution": 2.0,
        "reason": "Severe weakness or unsteadiness is present."
      }
    ],
    "fallback_mode": false,
    "limitations": [
      "This baseline is guideline-informed scaffolding, not a trained or clinically validated model."
    ]
  }
}
```

Fallback Response:

If the triage service is unavailable, the endpoint still returns a structured manual-review response with `model_name: manual-review-fallback`, `confidence: null`, `structured_output.risk_score: null`, `structured_output.fallback_mode: true`, and `human_review_required: true`.

Errors:

- `401 AUTH_REQUIRED`
- `401 INVALID_TOKEN`
- `403 INSUFFICIENT_ROLE`
- `403 USER_INACTIVE`
- `422 VALIDATION_ERROR`

Database Effects:

- Writes `triage_assessments` with model name, model version, risk level, confidence when present, explanation, structured output, and mandatory human-review requirement.
- Writes `audit_logs` with action `AI_RESPIRATORY_TRIAGE_ASSESSED`.

Workflow Effects:

- None. This endpoint does not move appointments, referrals, care plans, or follow-ups.

Example:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/triage/respiratory-risk -Headers @{Authorization="Bearer <token>"} -ContentType application/json -Body '{"patient_id":"00000000-0000-4000-8000-000000000001","age_months":485,"symptoms":{"cough":true,"breathlessness":true},"vitals":{"respiratory_rate":32,"spo2":91},"danger_signs":{}}'
```

## Planned Contract Areas

No workflow transition endpoints are exposed yet. Session 04 implements the backend transition service only. Session 05 exposes respiratory triage decision support only.

Future sessions must document every endpoint with method, path, authentication, required role, request, validation, response, errors, database effects, workflow effects, and examples. Planned API areas include patients, consent, symptoms, vitals, triage, human review, appointments, queue, consultations, diagnostics, referrals, care plans, follow-ups, synchronization, notifications, interoperability mappings, and administration.
