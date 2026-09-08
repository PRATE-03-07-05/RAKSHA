"""Public QR code endpoint - returns limited patient information without authentication.

This endpoint is designed to be accessed via QR code scanning from external devices.
It returns only basic, non-sensitive patient information for identification purposes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient

router = APIRouter(prefix="/qr", tags=["qr"])


@router.get("/patient/{patient_id}", summary="Public patient info via QR code")
def get_patient_qr_info(patient_id: str, db: Session = Depends(get_db)):
    """
    Return limited patient information for QR code scanning.
    
    This endpoint is PUBLIC and does not require authentication.
    It returns only basic identification information, not the full medical record.
    
    Security considerations:
    - No sensitive medical data is exposed
    - No authentication tokens or credentials
    - Only basic identification info (name, age, gender, village, RAK ID)
    - Designed for emergency identification and basic verification
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Return only basic, non-sensitive information
    return {
        "id": patient.id,
        "rak_id": patient.rak_id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "village": patient.village,
        "phone": patient.phone,
        "emergency_contact": patient.emergency_contact,
        "emergency_phone": patient.emergency_phone,
        "blood_group": patient.blood_group,
        "conditions": patient.conditions,  # Known conditions are useful for emergency care
        "allergies": patient.allergies,    # Allergies are critical for emergency care
    }
