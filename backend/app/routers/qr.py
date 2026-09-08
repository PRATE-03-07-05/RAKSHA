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
    
    # Return only basic, non-sensitive information.
    # Phone numbers, emergency contacts, blood group, conditions and allergies
    # are PHI and must never be exposed on a public endpoint.
    return {
        "id": patient.id,
        "rak_id": patient.rak_id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender.value if hasattr(patient.gender, "value") else patient.gender,
        "village": patient.village,
    }
